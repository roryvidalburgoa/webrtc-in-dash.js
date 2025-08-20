# React dashjs WebRTC Demo

A React-based demo application showcasing the dashjs-webrtc-socketio package with WebRTC streaming capabilities via Socket.io and traditional DASH playback.

## Features

- WebRTC streaming via Socket.io signaling
- DASH adaptive streaming playback
- Camera switching for WebRTC streams
- ICE/STUN/TURN server configuration
- Debug mode for troubleshooting
- Responsive design

## Installation

This demo uses the dash.js WebRTC Socket.io tarball package:

```bash
# From the main project root, create the tarball
cd ..
npm pack

# Install dependencies in the React demo
cd react-dashjs-demo
npm install ../dashjs-webrtc-socketio-4.4.2.tgz
npm install

# Start development server
npm start
```

The app will be available at http://localhost:3000

## Build for Production

```bash
npm run build
```

## Usage

### WebRTC Socket.io Mode

1. Enter your Socket.io server URL (e.g., `wss://camera.geometris.com`)
2. Enter the device serial number and PIN
3. Configure ICE servers if needed (JSON format)
4. Click "Connect WebRTC" to start streaming
5. Use "Switch Camera" to toggle between front/back cameras

### DASH Streaming Mode

1. Enter a DASH manifest URL in the DASH Stream URL field
2. Click "Load DASH Stream" to start playback
3. The player will automatically handle adaptive bitrate switching

## Configuration

### Default Settings

Click "Load Defaults" to populate fields with production settings:
- Socket URL: `wss://camera.geometris.com`
- Serial Number: `100151819016`
- PIN: `94627`
- ICE Servers: Google STUN + custom TURN server

### Debug Settings

Click "Load Debug" for local development:
- Socket URL: `http://localhost`
- Debug Serial/PIN for testing

### Sample DASH URLs

Click "Sample DASH URLs" to cycle through test streams:
- Big Buck Bunny
- Live Simulator
- Envivio Test Stream
- BBC Test Stream

## Technologies Used

- React 19 with TypeScript
- dashjs-webrtc-socketio package (installed from tarball)
- Socket.io client for WebRTC signaling
- Webpack 5 for bundling

## Development

To update the dash.js library after making changes:

```bash
# In the main project root
npm run build
npm pack

# In the react-dashjs-demo directory
npm uninstall dashjs-webrtc-socketio
npm install ../dashjs-webrtc-socketio-4.4.2.tgz
```

## Package Structure

```
react-dashjs-demo/
├── src/
│   ├── App.tsx          # Main React component
│   ├── App.css          # Styles
│   └── index.tsx        # Entry point
├── public/
│   └── index.html       # HTML template
├── webpack.config.js    # Webpack configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

## WebRTC Handler API

The app demonstrates usage of the WebRTC handler API:

```typescript
// Get WebRTC handler
const handler = player.getWebRtcHandler();

// Check connection state
if (handler.isConnected()) {
  // Switch camera
  handler.switchCamera();
  
  // Get detailed state
  const state = handler.getConnectionState();
}
```

## Troubleshooting

### Connection Issues

- Verify ICE servers are accessible
- Check firewall settings for UDP traffic
- Enable debug mode to see detailed logs in browser console
- Ensure device is online and serial/PIN are correct

### Common Errors

- **"Connection timeout"**: Device not responding within 30 seconds
- **"Invalid ICE servers"**: Check JSON formatting in ICE servers field
- **"Connection failed"**: Network or ICE negotiation failure

## License

BSD-3-Clause