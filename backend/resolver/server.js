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
import { Innertube } from 'youtubei.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.RESOLVER_API_KEY || 'rhymic-resolver-key';

// ── InnerTube singleton ──────────────────────────────────────────────────────
// Create one instance and reuse it. YT.js handles session/cookie management.
let innertube = null;
let innertubeInitTime = 0;
const INNERTUBE_TTL = 3600 * 1000; // Reinitialize every 1 hour

async function getInnertube() {
  if (!innertube || Date.now() - innertubeInitTime > INNERTUBE_TTL) {
    console.log('[Resolver] Initializing Innertube...');
    innertube = await Innertube.create({
      // Use the ANDROID client - less likely to be rate limited
      client_type: 'ANDROID',
      generate_session_locally: true,
    });
    innertubeInitTime = Date.now();
    console.log('[Resolver] Innertube initialized.');
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
  res.json({ status: 'ok', initialized: innertube !== null });
});

// ── Main resolver endpoint ────────────────────────────────────────────────────
app.get('/resolve/:videoId', requireAuth, async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  console.log(`[Resolver] Resolving: ${videoId}`);
  
  // Try different clients in order of reliability
  const clients = ['ANDROID', 'TV', 'WEB_REMIX'];
  let lastError = null;

  for (const clientType of clients) {
    try {
      console.log(`[Resolver] Attempting with client: ${clientType}`);
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId, clientType);
      
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
      
      // Try to decipher the best format
      for (const format of audioFormats.slice(0, 3)) {
        try {
          const streamUrl = format.decipher(yt.session.player);
          if (streamUrl) {
            console.log(`[Resolver] SUCCESS (${clientType}): ${format.mime_type}, ${format.bitrate}bps`);
            return res.json({
              url: streamUrl,
              mimeType: format.mime_type,
              bitrate: format.bitrate,
              client: clientType
            });
          }
        } catch (e) {
          console.warn(`[Resolver] Decipher failed for format on ${clientType}: ${e.message}`);
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

app.listen(PORT, () => {
  console.log(`[Resolver] Running on port ${PORT}`);
});
