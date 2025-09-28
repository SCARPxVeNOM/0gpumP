const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('media'));

// Create media directory if it doesn't exist
const fs = require('fs');
const mediaDir = path.join(__dirname, 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

// Express routes
app.get('/', (req, res) => {
  res.json({
    status: 'Simple Streaming Server running',
    message: 'This server accepts RTMP streams and serves them as HLS',
    rtmp: `rtmp://${req.get('host')}/live/STREAM_KEY`,
    hls: `https://${req.get('host')}/live/STREAM_KEY.m3u8`,
    note: 'Use OBS with HLS output for best results'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Simple streaming server is running'
  });
});

// Serve HLS files
app.get('/live/:streamKey.m3u8', (req, res) => {
  const streamKey = req.params.streamKey;
  const filePath = path.join(__dirname, 'media', 'live', streamKey, 'index.m3u8');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ 
      error: 'Stream not found', 
      message: 'No active stream with this key',
      streamKey: streamKey
    });
  }
});

app.get('/live/:streamKey/:segment', (req, res) => {
  const streamKey = req.params.streamKey;
  const segment = req.params.segment;
  const filePath = path.join(__dirname, 'media', 'live', streamKey, segment);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ 
      error: 'Segment not found',
      message: 'Stream segment not available',
      streamKey: streamKey,
      segment: segment
    });
  }
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Simple Streaming Server running on port ${PORT}`);
  console.log(`📺 RTMP ingest: rtmp://your-domain/live/STREAM_KEY`);
  console.log(`📱 HLS playback: https://your-domain/live/STREAM_KEY.m3u8`);
  console.log(`💡 Note: Use OBS with HLS output for best results`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Simple Streaming Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down Simple Streaming Server...');
  process.exit(0);
});