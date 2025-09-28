# Livestream Deployment Guide

## Overview
You now have two services:
1. **Main Backend** (with Socket.IO chat) - `server.js`
2. **Streaming Service** (NodeMediaServer) - `streaming-server.js`

## Step 1: Deploy Main Backend to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `0g-pump-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=4000
   ```

6. Deploy and note the URL: `https://0g-pump-backend.onrender.com`

## Step 2: Deploy Streaming Service to Render

1. Create a new repository for streaming service OR use the same repo
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Web Service"
4. Configure:
   - **Name**: `0g-pump-streaming`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node streaming-server.js`
   - **Plan**: Free

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=8000
   ```

6. Deploy and note the URL: `https://0g-pump-streaming.onrender.com`

## Step 3: Update Frontend Environment Variables

Create `.env.local` in your project root:

```env
# Backend API (with Socket.IO chat)
NEXT_PUBLIC_API_URL=https://0g-pump-backend.onrender.com

# Streaming service (NodeMediaServer)
NEXT_PUBLIC_LIVE_BASE_URL=https://0g-pump-streaming.onrender.com

# Chat service (same as backend)
NEXT_PUBLIC_CHAT_URL=https://0g-pump-backend.onrender.com
```

## Step 4: Test the Setup

### For Broadcasting (OBS):
1. Open OBS Studio
2. Go to Settings → Stream
3. Set Service: Custom
4. Set Server: `rtmp://0g-pump-streaming.onrender.com/live`
5. Set Stream Key: `coin123` (or any key you want)
6. Start Streaming

### For Viewing:
1. Go to your Next.js app
2. Click "Livestreams" in sidebar
3. You should see the live stream and chat

## URLs Summary:
- **RTMP Ingest**: `rtmp://0g-pump-streaming.onrender.com/live/STREAM_KEY`
- **HLS Playback**: `https://0g-pump-streaming.onrender.com/live/STREAM_KEY.m3u8`
- **Chat**: `https://0g-pump-backend.onrender.com/socket.io/`

## Troubleshooting:
- If streaming doesn't work, check Render logs
- Make sure both services are running
- Check CORS settings if chat doesn't work
- Verify environment variables are set correctly
