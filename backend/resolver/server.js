import express from 'express';
import { Innertube } from 'youtubei.js';

const app = express();
app.use(express.json());

const PORT = 3001; // Internal port for the unified service
const API_KEY = process.env.RESOLVER_API_KEY || 'rhymic-resolver-key';

let innertube = null;

async function getInnertube() {
  if (!innertube) {
    innertube = await Innertube.create({ client_type: 'ANDROID' });
  }
  return innertube;
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/resolve/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const key = req.headers['x-resolver-key'];
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId, 'TV'); // TV client is often very stable
    const streamingData = info.streaming_data;
    if (!streamingData) throw new Error('No streaming data');

    const formats = [
      ...(streamingData.adaptive_formats || []),
      ...(streamingData.formats || [])
    ].filter(f => f.has_audio);

    formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    
    for (const format of formats.slice(0, 3)) {
      try {
        const streamUrl = format.decipher(yt.session.player);
        if (streamUrl) {
          return res.json({ url: streamUrl, mimeType: format.mime_type });
        }
      } catch (e) {}
    }
    throw new Error('Could not decipher any format');
  } catch (err) {
    console.error(`[Resolver] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`[Resolver] Internal service on ${PORT}`));
