# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of dash.js that extends it with WebRTC streaming capabilities. The project implements the DASH Industry Forum reference player with additional support for WebRTC playback through both:
1. WHPP (WebRTC HTTP Playback Protocol) for manifest-based WebRTC streaming
2. Socket.io signaling for direct peer-to-peer WebRTC connections with STUN/TURN support

## Commands

### Development
- `npm install` - Install dependencies
- `npm run start` - Start webpack dev server with hot reload (http://localhost:3000)
- `npm run dev` - Build and watch distribution files in development mode
- `npm run build` - Build production distribution files to dist/

### Testing
- `npm run test` - Run unit tests with Mocha
- `npm run test-browserunit` - Run unit tests in browser with Karma
- `npm run test-functional` - Run functional tests with Selenium
- `npm run coverage` - Generate test coverage report

### Code Quality
- `npm run lint` - Run ESLint on source files (src/**/*.js and test files)

### Documentation
- `npm run doc` - Generate JSDoc API documentation

### WebRTC Testing
For WebRTC functionality testing:
1. **WHPP mode**: `npm run start` then open http://localhost:3000/samples/webrtc/webrtc.html
2. **Socket.io mode**: `npm run start` then open http://localhost:3000/samples/webrtc/webrtc-socketio.html
3. Production mode: `npm run prepack` then open the respective HTML files locally

## Architecture

### Core Components

**MediaPlayer** (src/streaming/MediaPlayer.js) - Main player interface that orchestrates playback. Handles initialization, stream loading, and coordinates between different handlers (DASH, MSS, WebRTC).

**WebRtcHandler** (src/webrtc/WebRtcHandler.js) - Manages WebRTC streaming when enabled. Supports two modes:
- **WHPP mode**: Detects WebRTC adaptation sets in manifests and establishes WHPP connections
- **Socket.io mode**: Creates direct peer connections using Socket.io for signaling with ICE/STUN/TURN support

**Stream/StreamProcessor** (src/streaming/) - Core streaming pipeline that manages buffer controllers, fragment loading, and adaptive bitrate logic. Extended to support WebRTC alongside traditional DASH streaming.

### WebRTC Integration

WebRTC support is enabled via settings and supports two operational modes:

#### WHPP Mode (Manifest-based)
```javascript
player.updateSettings({
    webRtc: {
        enabled: true,
        dashOnFail: true  // Falls back to DASH if WebRTC fails
    }
});
```
When a manifest contains a WebRTC adaptation set with `mimeType="video RTP/AVP"` and WHPP endpoint, the WebRtcHandler takes over playback using @eyevinn/whpp-client.

#### Socket.io Mode (Direct P2P)
```javascript
player.updateSettings({
    webRtc: {
        enabled: true,
        mode: 'socketio',
        socketUrl: 'wss://camera.geometris.com',
        serialNumber: '100150660001',
        pin: '94627',
        cameraIndex: 0,  // 0 for front, 1 for back camera
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "turn:server:3478", username: "user", credential: "pass" }
        ]
    }
});
```
In Socket.io mode, no manifest is required. The player establishes a direct WebRTC connection using Socket.io for signaling and the configured ICE servers for NAT traversal.

#### Accessing WebRTC Handler
The WebRTC handler can be accessed programmatically for advanced control:
```javascript
const handler = player.getWebRtcHandler();
if (handler) {
    handler.switchCamera();  // Toggle between cameras in Socket.io mode
}
```

### Module System

The project uses Webpack for bundling with separate configs for dev (webpack.dev.js) and production (webpack.prod.js). Source code follows ES6 modules with FactoryMaker pattern for dependency injection.

## Code Style

- ESLint configuration enforces 4-space indentation and single quotes
- All source files require BSD-3 license header
- Follow existing patterns for new components (FactoryMaker for singletons, proper event handling)
- Unit tests required for new functionality

## Key Files for WebRTC Implementation

- **src/webrtc/WebRtcHandler.js** - Core WebRTC handler supporting both WHPP and Socket.io modes
- **src/core/Settings.js** - Configuration schema including WebRTC settings
- **src/streaming/controllers/StreamController.js** - Modified to bypass manifest loading for Socket.io mode and expose WebRTC handler
- **src/streaming/MediaPlayer.js** - Exposes getWebRtcHandler() method for accessing WebRTC functionality
- **samples/webrtc/webrtc.html** - WHPP mode sample application
- **samples/webrtc/webrtc-socketio.html** - Socket.io mode sample with full UI controls

## WebRTC Socket.io Protocol

The Socket.io implementation follows this signaling flow:
1. **Connection**: Client connects to socket server and registers with role, serial number, and PIN
2. **Device Discovery**: Server sends 'cameras' event with available devices
3. **Call Initiation**: Client sends 'requestVideoCall' with target device and camera index
4. **ICE/SDP Exchange**: Bidirectional 'signal' events for WebRTC negotiation
5. **Camera Control**: 'switchCamera' event to toggle between front/back cameras
6. **Disconnection**: 'forcedDisconnect' event when connection needs to be terminated

## WebRTC Handler API

The WebRTC handler exposes several methods for connection management:

```javascript
const handler = player.getWebRtcHandler();

// Check if connected
if (handler.isConnected()) {
    console.log('WebRTC is connected');
}

// Get detailed connection state
const state = handler.getConnectionState();
// Returns: {
//   state: 'connected',
//   iceState: 'connected',
//   signalingState: 'stable',
//   socketConnected: true,
//   hasVideo: true,
//   waitingForOffer: false
// }

// Switch camera (Socket.io mode only)
handler.switchCamera();

// Destroy connection
handler.destroy();
```

## Connection State Management

The WebRTC implementation includes robust connection state tracking:

### Connection States
- **new**: Peer connection created but not yet connected
- **connecting**: ICE gathering and negotiation in progress
- **connected**: WebRTC connection established successfully
- **failed**: Connection failed and cannot recover
- **closed**: Connection has been closed

### UI Button Management
The sample application (webrtc-socketio.html) implements proper button state management:
- Connect button: Enabled only when disconnected
- Disconnect button: Enabled only when connected
- Switch Camera button: Enabled only when connected

### Connection Timeout Handling
- Connection attempts timeout after 30 seconds
- Progress updates shown every 2 seconds during connection
- Proper cleanup on timeout or failure

## Troubleshooting WebRTC Issues

### ICE Connection Failures
If you encounter ICE connection failures:
1. Check firewall settings - ensure UDP traffic is allowed
2. Verify STUN/TURN servers are accessible
3. Test with Google's public STUN server: `stun:stun.l.google.com:19302`
4. Enable debug mode to see detailed ICE candidate exchange

### Common Error Messages
- **"Connection timeout - device did not respond"**: Device is offline or unreachable
- **"Connection failed - check network and ICE servers"**: ICE negotiation failed
- **"Serial number not provided"**: UI validation error
- **"Socket.io URL not configured"**: Missing socket server URL

### Debug Mode
Enable debug logging for detailed connection information:
```javascript
player.updateSettings({
    webRtc: {
        debug: true,
        // ... other settings
    }
});
```

Check browser console for `[WebRTC]` prefixed messages showing:
- Socket connection events
- ICE candidate exchange
- SDP offer/answer flow
- Connection state changes