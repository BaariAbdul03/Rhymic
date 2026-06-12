/**
 * RhyMic Audio Resolver Service
 * 
 * A lightweight Node.js microservice that uses youtubei.js to resolve
 * YouTube audio stream URLs. This runs as a separate Render service to get
 * a fresh IP pool not flagged by YouTube (unlike the main Flask backend IP).
 * 
 * Flask calls this service internally to get stream URLs.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Innertube } from 'youtubei.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.RESOLVER_API_KEY || 'rhymic-resolver-key';

// ── InnerTube singleton ──────────────────────────────────────────────────────
let innertube = null;
let innertubeInitTime = 0;
let refreshInterval = null;
const INNERTUBE_TTL = 3600 * 1000; // Reinitialize every 1 hour

async function getInnertube() {
  if (!innertube || Date.now() - innertubeInitTime > INNERTUBE_TTL) {
    console.log('[Resolver] Initializing Innertube...');
    const b64Oauth = process.env.YT_OAUTH_CREDENTIALS;

    // ── 1. Use saved OAuth credentials (best, skips device flow) ─────────────
    if (b64Oauth) {
      try {
        const credentials = JSON.parse(Buffer.from(b64Oauth, 'base64').toString('utf-8'));
        innertube = await Innertube.create({
          client_type: 'TV_EMBEDDED',
          generate_session_locally: true,
        });
        await innertube.session.signIn(credentials);
        if (typeof innertube.session.oauth.cacheCredentials === 'function') {
          await innertube.session.oauth.cacheCredentials();
        }
        console.log('[Resolver] Innertube initialized with TV_EMBEDDED OAuth2.');
      } catch (err) {
        console.error('[Resolver] OAuth init failed:', err.message);
        innertube = null;
      }
    }

    // ── 2. No OAuth credentials → ALWAYS run device flow ─────────────────────
    // Cookies alone do not work on datacenter IPs. YouTube blocks at the
    // network level regardless of cookie validity. The TV device flow creates
    // a proper OAuth session YouTube trusts from any IP, including cloud infra.
    if (!innertube && !b64Oauth) {
      console.log('[Resolver] No YT_OAUTH_CREDENTIALS found. Starting OAuth2 TV Device Flow...');
      console.log('[Resolver] NOTE: Once authorized, save the Base64 output as YT_OAUTH_CREDENTIALS.');
      try {
        innertube = await Innertube.create({
          client_type: 'TV_EMBEDDED',
          generate_session_locally: true,
        });
        innertube.session.on('auth-pending', (data) => {
          console.log('\n\n======================================================');
          console.log('[Resolver] ACTION REQUIRED: Authorize this service!');
          console.log(`[Resolver] 1. Open in browser: ${data.verification_url}`);
          console.log(`[Resolver] 2. Enter code:      ${data.user_code}`);
          console.log('[Resolver] Use a BURNER Google account!');
          console.log('======================================================\n\n');
        });
        innertube.session.on('auth', ({ credentials }) => {
          console.log('[Resolver] OAuth2: Successfully authenticated!');
          const b64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
          console.log('\n======================================================');
          console.log('[Resolver] SAVE THIS AS YT_OAUTH_CREDENTIALS ENV VAR:');
          console.log(b64);
          console.log('======================================================\n');
        });
        innertube.session.on('update-credentials', ({ credentials }) => {
          console.log('[Resolver] OAuth2 credentials refreshed.');
          const b64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
          console.log('\n======================================================');
          console.log('[Resolver] UPDATE YT_OAUTH_CREDENTIALS WITH THIS VALUE:');
          console.log(b64);
          console.log('======================================================\n');
        });
        await innertube.session.signIn();
      } catch (err) {
        console.error('[Resolver] Device flow failed:', err.message);
        innertube = null;
      }
    }

    // ── 3. Final unauthenticated fallback ─────────────────────────────────────
    if (!innertube) {
      console.log('[Resolver] Fallback to unauthenticated ANDROID client.');
      innertube = await Innertube.create({
        client_type: 'ANDROID',
        generate_session_locally: true,
      });
    }

    innertubeInitTime = Date.now();
    console.log('[Resolver] Innertube initialization complete.');

    // Proactive OAuth token refresh (every 60 seconds)
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
      try {
        if (innertube && innertube.session.logged_in) {
          const tokens = innertube.session.oauth?.oauth2_tokens || innertube.session.oauth?.credentials;
          const expiryStr = tokens?.expiry_date || tokens?.expiry;
          if (expiryStr) {
            const expiryTime = new Date(expiryStr).getTime();
            if (Date.now() > expiryTime - 5 * 60 * 1000) {
              console.log('[Resolver] Proactively refreshing OAuth credentials...');
              if (typeof innertube.session.oauth.refreshAccessToken === 'function') {
                await innertube.session.oauth.refreshAccessToken();
              } else if (typeof innertube.session.oauth.refreshIfRequired === 'function') {
                await innertube.session.oauth.refreshIfRequired();
              }
            }
          }
        }
      } catch (e) {
        console.error('[Resolver] Proactive refresh failed:', e.message);
      }
    }, 60 * 1000);
  }
  return innertube;
}

// Initialize on startup
getInnertube().catch(e => console.error('[Resolver] Init failed:', e));

// ── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const key = req.headers['x-resolver-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', initialized: innertube !== null, authenticated: innertube?.session?.logged_in || false });
});

  // ── Main resolver endpoint ────────────────────────────────────────────────────
app.get('/resolve/:videoId', requireAuth, async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  console.log(`[Resolver] Resolving: ${videoId}`);
  
  // Try different clients in order of reliability
  // iOS currently returns directly usable audio formats for public music
  // videos. Keep authenticated Android/TV clients as fallbacks.
  const clients = ['IOS', 'ANDROID', 'YTMUSIC_ANDROID', 'TV_EMBEDDED'];
  let lastError = null;

  for (const clientType of clients) {
    try {
      console.log(`[Resolver] Attempting with client: ${clientType}`);
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId, { client: clientType });
      
      const streamingData = info.streaming_data;
      if (!streamingData) {
        console.warn(`[Resolver] No streaming data for ${videoId} with client ${clientType}`);
        continue;
      }
      
      // Get all formats (adaptive and regular)
      const formats = [
        ...(streamingData.adaptive_formats || []),
        ...(streamingData.formats || [])
      ];
      
      // Filter for anything with audio
      const audioFormats = formats.filter(f => f.has_audio);
      
      if (audioFormats.length === 0) {
        console.warn(`[Resolver] No audio formats for ${videoId} with client ${clientType}`);
        continue;
      }
      
      // Sort by bitrate (highest first)
      audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      
      // Try up to 3 best formats
      for (const format of audioFormats.slice(0, 3)) {
        try {
          // First try to decipher (for encrypted streams)
          let streamUrl = null;
          try {
            streamUrl = await format.decipher(yt.session.player);
          } catch (decipherErr) {
            // Decipher failed (e.g., player JS not extracted) — try raw URL
            console.warn(`[Resolver] Decipher failed, trying raw URL: ${decipherErr.message}`);
          }
          
          // Fall back to the pre-signed URL if available (ANDROID_MUSIC / ANDROID clients)
          if (!streamUrl && format.url) {
            streamUrl = format.url;
            console.log(`[Resolver] Using pre-signed URL (no decipher needed).`);
          }

          if (streamUrl) {
            console.log(`[Resolver] SUCCESS (${clientType}): ${format.mime_type}, ${format.bitrate}bps`);
            return res.json({
              url: streamUrl,
              format: format.mime_type,
              bitrate: format.bitrate,
              client: clientType
            });
          }
        } catch (e) {
          console.warn(`[Resolver] Format processing failed on ${clientType}: ${e.message}`);
        }
      }
    } catch (err) {
      console.error(`[Resolver] Client ${clientType} failed:`, err.message);
      lastError = err.message;
      // If we're getting bot detection, re-init might help
      if (err.message?.includes('bot') || err.message?.includes('Sign in')) {
        innertube = null;
      }
    }
  }
  
  return res.status(500).json({ 
    error: 'All clients failed to resolve stream', 
    details: lastError 
  });
});

// Bind to 127.0.0.1 (localhost only) so Render's external port scanner
// does not detect this internal service and trigger a network reconfiguration
// restart. Only Gunicorn on 0.0.0.0:$PORT is the public-facing process.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Resolver] Running on 127.0.0.1:${PORT}`);
});
