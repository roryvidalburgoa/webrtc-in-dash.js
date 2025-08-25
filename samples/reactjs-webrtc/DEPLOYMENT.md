# Dashcam Live Feed Application - Deployment Guide

## Production Build

The production build has been generated in the `dist` folder with the following files:

- `index.html` - Main HTML file
- `bundle.js` - Minified JavaScript bundle (includes React, dashjs-webrtc-socketio, and all application code)
- `bundle.js.LICENSE.txt` - License information for bundled libraries
- Font files for Bootstrap icons (`.eot`, `.svg`, `.ttf`, `.woff`, `.woff2`)

## Deployment Options

### Option 1: Static Web Server

Simply copy all files from the `dist` folder to any static web server:

```bash
# Example with nginx
cp -r dist/* /var/www/html/

# Example with Apache
cp -r dist/* /var/www/html/dashcam-app/
```

### Option 2: Node.js Express Server

```javascript
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Option 3: Python Simple HTTP Server (for testing)

```bash
cd dist
python -m http.server 8000
# Or for Python 2
python -m SimpleHTTPServer 8000
```

### Option 4: Cloud Deployment

#### AWS S3 + CloudFront
1. Upload all files from `dist` to an S3 bucket
2. Enable static website hosting on the bucket
3. Configure CloudFront distribution for HTTPS

#### Netlify
1. Drag and drop the `dist` folder to Netlify
2. Or use Netlify CLI: `netlify deploy --dir=dist`

#### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod dist`

#### GitHub Pages
1. Create a new repository
2. Push the `dist` folder contents to the `gh-pages` branch
3. Enable GitHub Pages from repository settings

## Requirements

- Modern web browser with WebRTC support (Chrome, Firefox, Edge)
- HTTPS connection (required for WebRTC in production)
- Network access to:
  - `wss://camera.geometris.com` (for WebRTC mode)
  - DASH streaming servers (for DASH mode)

## Features

- **DASH Streaming**: Uses sample streams from Akamai test servers
- **WebRTC Streaming**: Connects to camera.geometris.com via Socket.IO
- **Camera Switching**: Toggle between front (0) and rear (1) cameras
- **Browser Compatibility Check**: Warns users on unsupported OS (Mac/iPhone)

## Configuration

The application uses the following WebRTC configuration:
- Server: `wss://camera.geometris.com`
- Serial Number: `100151819016`
- APIKey: `ne83247hdhiwe384jdh`
- STUN/TURN servers configured for ICE negotiation

To modify these settings, edit `src/components/DashcamLiveFeedModal.tsx` before building.

## Build Size

- Total build size: ~950 KB (minified)
- Includes: React 17, dashjs-webrtc-socketio, Bootstrap 3, jQuery

## Browser Console

Enable browser console to see debug logs for WebRTC connections and streaming events.

## Troubleshooting

1. **WebRTC not connecting**: Ensure HTTPS is enabled and the device credentials are correct
2. **DASH streams not playing**: Check network access to Akamai test servers
3. **Video element errors**: Ensure browser supports HTML5 video and WebRTC

## Support

For issues with the dashjs-webrtc-socketio package, refer to the package documentation.