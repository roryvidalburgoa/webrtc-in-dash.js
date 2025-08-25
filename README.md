# dash.js with WebRTC Socket.io Support

This is a fork of [dash.js](https://github.com/Dash-Industry-Forum/dash.js) that extends the DASH Industry Forum reference player with WebRTC streaming capabilities using Socket.io signaling, specifically designed for Geometris camera servers.

## Features

- Full dash.js MPEG-DASH playback capabilities
- WebRTC streaming via Socket.io signaling
- Direct peer-to-peer connections with STUN/TURN support
- Camera switching functionality (front/back)
- Automatic fallback to DASH when WebRTC fails
- Compatible with Geometris camera infrastructure

## Installation

Install the package using a tarball file:

1. **Create the tarball package:**
```bash
npm pack
```
This creates `dashjs-webrtc-socketio-4.4.2.tgz` in the project root directory.

2. **Install in your project:**
```bash
npm install /path/to/dashjs-webrtc-socketio-4.4.2.tgz
```

3. **Include in your HTML:**
```html
<script src="node_modules/dashjs-webrtc-socketio/dist/dash.all.min.js"></script>
```

## Usage Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebRTC Socket.io Streaming</title>
</head>
<body>
    <video id="videoPlayer" controls autoplay muted></video>
    
    <script src="node_modules/dashjs-webrtc-socketio/dist/dash.all.min.js"></script>
    <script>
        // Create and configure the player
        const player = dashjs.MediaPlayer().create();
        
        // Configure WebRTC Socket.io settings
        player.updateSettings({
            webRtc: {
                enabled: true,
                mode: 'socketio', // socketio is required to use this mode and the rest of settings below
                socketUrl: 'wss://camera.geometris.com',
                serialNumber: '100151819016',   // Your device serial number
                apiKey: 'ne83247hdhiwe384jdh',  // Your device apiKey
                cameraIndex: 0,                 // 0 for front, 1 for back camera
                debug: true,                    // Enable debug logging
                iceServers: [
                    { urls: "stun:camera.geometris.com:3478" },
                    {
                        urls: "turn:camera.geometris.com:3478",
                        username: "devices",
                        credential: "A82*ndcBX"
                    }
                ]
            }
        });
        
        // Initialize the player
        const videoElement = document.querySelector("#videoPlayer");
        const autoPlay = true;
        player.initialize(videoElement, 'wss://camera.geometris.com', autoPlay);
        
        // Example of access WebRTC handler for camera switching
        setTimeout(() => {
            const handler = player.getWebRtcHandler();
            if (handler && handler.isConnected()) {
                // Switch to back camera after 5 seconds
                handler.switchCamera();
            }
        }, 5000);
    </script>
</body>
</html>
```

## WebRTC Handler API

The WebRTC handler can be accessed via `player.getWebRtcHandler()` and provides:

- `isConnected()` - Check if WebRTC connection is active
- `switchCamera()` - Toggle between front/back cameras
- `getConnectionState()` - Get detailed connection status
- `destroy()` - Clean up and close connection

## Connection States

- **new** - Peer connection created
- **connecting** - ICE gathering in progress
- **connected** - Successfully streaming
- **failed** - Connection failed
- **closed** - Connection closed

## React Demo

A complete React demo application is available in the `react-dashjs-demo` directory:

```bash
cd react-dashjs-demo
npm install
npm start
```

Open http://localhost:3000 to test WebRTC streaming with a full UI.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Build distribution files
npm run build

# Run tests
npm run test

# Generate documentation
npm run doc
```

## License

This fork maintains the original [BSD license](LICENSE.md) from dash.js.

## Credits

Based on [dash.js](https://github.com/Dash-Industry-Forum/dash.js) by the DASH Industry Forum.
WebRTC Socket.io integration developed for Geometris camera systems.