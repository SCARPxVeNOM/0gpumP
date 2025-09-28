const NodeMediaServer = require('node-media-server');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

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
    port: process.env.PORT || 8000,
    allow_origin: '*',
    mediaroot: './media'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: false
      }
    ]
  }
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

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 NodeMediaServer running on port ${PORT}`);
  console.log(`📺 RTMP ingest: rtmp://your-domain/live/STREAM_KEY`);
  console.log(`📱 HLS playback: https://your-domain/live/STREAM_KEY.m3u8`);
});

// Start NodeMediaServer
nms.run();

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
