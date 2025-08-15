# dash.js WebRTC Socket.io & DASH Streaming Deployment

This folder contains all necessary files to deploy the dash.js WebRTC Socket.io & DASH streaming demo to a cloud web server.

## Contents

```
dashjsDeploy/
├── index.html              # Main application (webrtc-socketio.html)
├── dist/
│   └── dash.all.min.js    # Minified dash.js library with WebRTC support
├── lib/
│   ├── bootstrap.min.css  # Bootstrap CSS framework
│   ├── main.css           # Application styles
│   └── img/
│       └── dashjs-logo.png # dash.js logo
└── README.md              # This file
```

## Deployment Instructions

### 1. Simple Static Hosting (Netlify, Vercel, GitHub Pages, etc.)

Simply upload the entire `dashjsDeploy` folder contents to your static hosting service.

### 2. Apache/Nginx Web Server

1. Upload all files to your web server document root
2. Ensure the following MIME types are configured:
   - `.js` → `application/javascript`
   - `.css` → `text/css`
   - `.html` → `text/html`

### 3. AWS S3 Static Website

```bash
# Create S3 bucket
aws s3 mb s3://your-dashjs-demo

# Upload files
aws s3 sync . s3://your-dashjs-demo --acl public-read

# Configure website hosting
aws s3 website s3://your-dashjs-demo --index-document index.html
```

### 4. Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

Build and run:
```bash
docker build -t dashjs-demo .
docker run -p 80:80 dashjs-demo
```

## Configuration

### Default WebRTC Settings
- **Socket Server**: wss://camera.geometris.com
- **Serial Number**: 100151819016
- **PIN**: 94627
- **Camera Index**: 0 (Front) or 1 (Back)

### Default DASH Stream
- **URL**: https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd

### ICE Servers (for WebRTC)
```json
[
  { "urls": "stun:stun.l.google.com:19302" },
  { "urls": "stun:camera.geometris.com:3478" },
  { 
    "urls": "turn:camera.geometris.com:3478",
    "username": "devices",
    "credential": "*******"
  }
]
```

## Usage

1. **WebRTC Streaming**:
   - Enter Socket.io server URL, serial number, and PIN
   - Click "Connect WebRTC" to start streaming
   - Use "Switch Camera" to toggle between cameras

2. **DASH Streaming**:
   - Enter a DASH manifest URL
   - Click "Load DASH Stream" to play
   - Use "Sample DASH URLs" to cycle through test streams

## URL Parameters

You can pre-configure the application using URL parameters:

- `?serialnumber=XXX` - Pre-fill device serial number
- `?pin=XXX` - Pre-fill PIN
- `?debug=1` - Load debug settings
- `?qa=0` - Load production defaults

Example: `https://yourdomain.com/?serialnumber=100151819016&pin=94627`

## CORS Considerations

For WebRTC Socket.io connections, ensure your server allows:
- WebSocket connections from your domain
- Appropriate CORS headers for Socket.io

For DASH streaming, the manifest and segments must be:
- Served with appropriate CORS headers
- Or hosted on the same domain

## Browser Requirements

- **Chrome/Edge**: Full support for WebRTC and DASH
- **Firefox**: Full support for WebRTC and DASH
- **Safari**: WebRTC support (DASH via MSE)

## External Dependencies

The application loads these resources from CDNs:
- Socket.io client library (v4.6.0)
- Font Awesome icons (v6.0.0-beta3)

Ensure your deployment environment allows loading from:
- `https://cdn.socket.io`
- `https://cdnjs.cloudflare.com`

## Security Notes

1. **HTTPS Required**: WebRTC requires HTTPS for camera/microphone access
2. **WSS Protocol**: Use `wss://` (not `ws://`) for secure WebSocket connections
3. **CORS Policy**: Configure appropriate CORS headers on your server
4. **Content Security Policy**: May need adjustment for CDN resources

## Support

For issues related to:
- dash.js: https://github.com/Dash-Industry-Forum/dash.js
- WebRTC: Check browser console for detailed debug logs
- Socket.io: Ensure server is accessible and properly configured

## License

This demo uses dash.js, which is licensed under the BSD 3-Clause License.