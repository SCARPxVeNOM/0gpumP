const NodeMediaServer = require('node-media-server');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('media'));

// NodeMediaServer configuration for Render
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8001, // Use different port for NodeMediaServer
    allow_origin: '*',
    mediaroot: './media'
  },
};

// Create NodeMediaServer instance
const nms = new NodeMediaServer(config);

// Express routes for health check and info
app.get('/', (req, res) => {
  res.json({
    status: 'NodeMediaServer running',
    rtmp: `rtmp://${req.get('host')}/live/STREAM_KEY`,
    hls: `https://${req.get('host')}/live/STREAM_KEY.m3u8`
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve HLS files
app.get('/live/:streamKey.m3u8', (req, res) => {
  const streamKey = req.params.streamKey;
  const filePath = path.join(__dirname, 'media', 'live', streamKey, 'index.m3u8');
  res.sendFile(filePath);
});

app.get('/live/:streamKey/:segment', (req, res) => {
  const streamKey = req.params.streamKey;
  const segment = req.params.segment;
  const filePath = path.join(__dirname, 'media', 'live', streamKey, segment);
  res.sendFile(filePath);
});

// Start the Express server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log(`📺 RTMP ingest: rtmp://your-domain/live/STREAM_KEY`);
  console.log(`📱 HLS playback: https://your-domain/live/STREAM_KEY.m3u8`);
});

// Start NodeMediaServer
try {
  nms.run();
  console.log('✅ NodeMediaServer started successfully');
} catch (error) {
  console.error('❌ NodeMediaServer failed to start:', error.message);
  // Continue without NodeMediaServer for now
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down NodeMediaServer...');
  nms.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down NodeMediaServer...');
  nms.stop();
  process.exit(0);
});