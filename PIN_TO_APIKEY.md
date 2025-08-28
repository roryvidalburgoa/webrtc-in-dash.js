# PIN to API Key Migration Guide

## What Changed?

The WebRTC Socket.io connection method has been updated. Instead of using a PIN code to connect to cameras, you now use an API Key.

## Old Way (PIN)
```javascript
player.updateSettings({
    webRtc: {
        enabled: true,
        mode: 'socketio',
        socketUrl: 'wss://camera.geometris.com',
        serialNumber: '100151819016',
        pin: '1234',  // ❌ No longer used
        cameraIndex: 0
    }
});
```

## New Way (API Key)
```javascript
player.updateSettings({
    webRtc: {
        enabled: true,
        mode: 'socketio',
        socketUrl: 'wss://camera.geometris.com',
        serialNumber: '100151819016',
        apiKey: 'ey78ohn3556jb044677',  // ✅ Use API Key instead
        cameraIndex: 0
    }
});
```

## Why This Change?

- **Unified Access Control**: Each Geometris API subscriber receives their own API Key that provides access to all Geometris APIs and services (Video API, WebRTC, etc.)
- **Customer-Specific Access**: The WebRTC service will only stream video from dash cameras that belong to the customer who owns the API Key
- **Better Security**: API Keys provide stronger authentication than simple PIN codes
- **Service Integration**: One API Key works across all Geometris services, simplifying integration

## How It Works

When you connect using your API Key:
1. The system verifies your API Key is valid
2. It checks that the requested camera (by serial number) belongs to your account
3. Only cameras registered to your API Key will stream video to you

## Getting Your API Key

Your API Key is provided when you subscribe to Geometris API services. This single key gives you access to:
- WebRTC live streaming
- Video API
- Other Geometris services

## Quick Summary

- Replace `pin: '1234'` with `apiKey: 'your-api-key-here'`
- Your API Key only works with cameras registered to your account
- The same API Key works across all Geometris services