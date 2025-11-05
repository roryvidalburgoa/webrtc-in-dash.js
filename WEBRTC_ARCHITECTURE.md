# WebRTC Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Signaling Flow](#signaling-flow)
4. [Device-Initiated Offer Pattern](#device-initiated-offer-pattern)
5. [ICE Candidate Race Condition](#ice-candidate-race-condition)
6. [Solution Implementation](#solution-implementation)
7. [Testing and Debugging](#testing-and-debugging)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This WebRTC implementation uses a **3-way architecture** for video streaming from Android devices to web viewers. The system employs a **Device-Initiated Offer** pattern where the device (camera) creates the WebRTC offer and the viewer creates the answer.

### Key Files
- **Viewer**: `src/webrtc/WebRtcHandler.js` (JavaScript/Browser)
- **Device**: `D:\01\working\trackmetris\Server\Skyonics\GeometrisVideo\RealDeviceWebRTC\WebRTCHelper.java` (Android)
- **Signaling Server**: `D:\01\working\trackmetris\Server\Skyonics\swebrtc\server.js` (Node.js/Socket.io)

---

## Architecture Components

```
┌─────────────────┐          ┌──────────────────────┐          ┌─────────────────┐
│     Viewer      │◄────────►│  Signaling Server    │◄────────►│     Device      │
│   (Browser)     │ Socket.io│    (Node.js)         │ Socket.io│   (Android)     │
│ WebRtcHandler.js│          │    server.js         │          │ WebRTCHelper.java│
└─────────────────┘          └──────────────────────┘          └─────────────────┘
         │                                                              │
         │                                                              │
         └──────────────────────────────────────────────────────────────┘
                       WebRTC Peer Connection
                  (Direct media after signaling)
```

### Component Responsibilities

#### 1. Viewer (Browser)
- **File**: `src/webrtc/WebRtcHandler.js`
- **Role**: Media sink (receives video)
- **Responsibilities**:
  - Connect to signaling server via Socket.io
  - Request video call from specific device
  - Wait for device's offer
  - Create and send answer
  - Handle ICE candidates
  - Display video stream

#### 2. Device (Android)
- **File**: `WebRTCHelper.java`
- **Role**: Media source (sends video)
- **Responsibilities**:
  - Connect to signaling server
  - Register with serial number
  - Listen for video call requests
  - Create and send offer
  - Handle viewer's answer
  - Stream video frames

#### 3. Signaling Server (Node.js)
- **File**: `server.js`
- **Role**: Signaling relay and access control
- **Responsibilities**:
  - Authenticate devices and viewers
  - Maintain device registry
  - Enforce access control (customer owns device)
  - Relay WebRTC signaling messages
  - Manage viewer-device pairing
  - Track usage statistics

---

## Signaling Flow

### Phase 1: Registration

#### Device Registration
```javascript
// Device → Server
socket.emit('register', 'client', serialNumber)

// Server:
// - Validates device serial number
// - Removes existing connection with same serial
// - Maps device to owner (customer)
// - Broadcasts updated camera list
```

**Server Code** (`server.js:326-382`):
- Stores in `mapSerialNumberToCameraData`
- Associates device with customer

#### Viewer Registration
```javascript
// Viewer → Server
socket.emit('register', role, serialNumber, { apiKey: '...' })

// Server:
// - Validates role (ADMIN or CUSTOMER)
// - Validates API key
// - Loads accessible devices for customer
// - Grants access based on ownership
```

**Server Code** (`server.js:385-446`):
- ADMIN: Access to all devices
- CUSTOMER: Access only to owned devices
- Stores in `mapSocketIdToViewerData`

### Phase 2: Device Discovery

```javascript
// Viewer → Server
socket.emit('isDeviceConnected', {
    serial: 'device-serial',
    apiKey: 'viewer-api-key'
})

// Server → Viewer
socket.emit('deviceConnected', true/false)
```

**Features**:
- Rate limiting: 10 requests per 5 seconds per device
- Validates viewer has access to device
- Returns device online status

### Phase 3: Video Call Initiation (Device-Initiated Offer)

#### Step 1: Viewer Requests Call
```javascript
// Viewer → Server (WebRtcHandler.js:277-310)
socket.emit('requestVideoCall', {
    target: 'device-serial',
    apiKey: 'viewer-api-key',
    cameraIndex: 0  // 0=front, 1=back
})

// Viewer sets: waitingForOffer = true
```

#### Step 2: Server Forwards to Device
```javascript
// Server → Device (server.js:610-727)
io.to(deviceSocketId).emit('requestVideoCall', {
    target: 'device-serial',
    cameraIndex: 0
})

// Server:
// - Validates viewer authentication
// - Kicks off any existing viewer
// - Creates bidirectional pairing:
//   - mapCameraSocketIdToViewerSocketId
//   - mapViewerSocketIdToCameraSocketId
// - Sanitizes request (removes PIN/API key)
```

#### Step 3: Device Creates OFFER
```java
// Device (WebRTCHelper.java:378-490)
peerConnection.createOffer(new CustomSdpObserver() {
    @Override
    public void onCreateSuccess(SessionDescription sessionDescription) {
        peerConnection.setLocalDescription(..., sessionDescription);
        socket.emit("signal", new SignalData(
            serialNumber,
            "client",
            sessionDescription  // type: "offer"
        ).toJson());
    }
}, mediaConstraints);

// ICE candidate gathering starts automatically
```

#### Step 4: Server Forwards Offer
```javascript
// Server → Viewer (server.js:817-930)
io.to(viewerSocketId).emit('signal', {
    description: { type: 'offer', sdp: '...' }
})
```

#### Step 5: Viewer Creates ANSWER
```javascript
// Viewer (WebRtcHandler.js:557-633)
webRtcPeer.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => {
        // Process queued ICE candidates (see fix below)
        return webRtcPeer.createAnswer();
    })
    .then((answer) => {
        return webRtcPeer.setLocalDescription(answer);
    })
    .then(() => {
        socket.emit('signal', {
            role: 'admin',
            target: deviceSerial,
            apiKey: apiKey,
            description: webRtcPeer.localDescription  // type: "answer"
        });
    });
```

#### Step 6: Server Forwards Answer
```javascript
// Server → Device (server.js:817-930)
io.to(deviceSocketId).emit('signal', {
    role: 'admin',
    description: { type: 'answer', sdp: '...' }
})
```

#### Step 7: Device Receives ANSWER
```java
// Device (WebRTCHelper.java:492-568)
if (!"client".equals(signalData.getRole())) {
    // Only accept signals from non-client roles (i.e., "admin")
    if (signalData.getDescription() != null) {
        peerConnection.setRemoteDescription(
            new CustomSdpObserver(),
            signalData.getDescription()
        );
        started = true;
    }
}
```

### Phase 4: ICE Candidate Exchange (Bidirectional)

Both peers exchange ICE candidates to establish peer-to-peer connectivity:

```javascript
// Device → Server → Viewer
socket.emit('signal', {
    role: 'client',
    candidate: { sdpMid, sdpMLineIndex, candidate }
})

// Viewer → Server → Device
socket.emit('signal', {
    role: 'admin',
    target: deviceSerial,
    apiKey: apiKey,
    candidate: { sdpMid, sdpMLineIndex, candidate }
})
```

**Server** relays candidates bidirectionally using pairing maps.

### Phase 5: Media Connection Established

Once ICE negotiation completes:
- Direct peer-to-peer connection established (may use TURN relay)
- Video/audio flows directly between device and viewer
- Signaling server no longer involved in media

---

## Device-Initiated Offer Pattern

### Why Device Creates the Offer?

This is the **correct pattern** for device-to-viewer streaming:

1. **Media Capabilities**: Device knows what codecs, resolutions, and tracks it can provide
2. **Asymmetric Roles**:
   - Device is media source (sendonly)
   - Viewer is media sink (recvonly)
3. **Firewall Traversal**: Works better with TURN server setup for devices behind NAT
4. **Standard for IP Cameras**: Industry-standard pattern for streaming devices

### Role-Based Filtering

Prevents devices from connecting to each other:

```java
// Device (WebRTCHelper.java:527)
if (!"client".equals(signalData.getRole())) {
    // Only process signals from "admin" role
    // Ignores signals from other "client" devices
}
```

- Device sends with `role: "client"`
- Viewer sends with `role: "admin"`
- Device ignores other devices

---

## ICE Candidate Race Condition

### The Problem

**Critical bug discovered**: Viewer was dropping device ICE candidates that arrived before `setRemoteDescription` was called.

#### Timing Issue
```
Device Timeline:
1. createOffer()
2. setLocalDescription(offer) ← ICE gathering starts
3. emit('signal', offer)
4. onicecandidate fires → sends candidates IMMEDIATELY

Viewer Timeline:
1. Receives offer via 'signal' event
2. setRemoteDescription(offer) ← May happen AFTER candidates arrive!
3. createAnswer()
4. setLocalDescription(answer)

RACE CONDITION: Device candidates arrive before step 2!
```

#### Original Buggy Code

**WebRtcHandler.js (before fix)**:
```javascript
if (data.candidate) {
    if (webRtcPeer.remoteDescription) {
        webRtcPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
        debugLog('WARNING: Received ICE candidate before remote description was set, queuing...');
        // ⚠️ DOESN'T ACTUALLY QUEUE - CANDIDATES ARE LOST!
    }
}
```

### Symptoms

1. Device sends video frames but viewer receives nothing
2. Device sends empty candidate lists (separate network issue)
3. ICE connection fails with state: `failed` or `disconnected`
4. Console shows: "Received ICE candidate before remote description was set"

---

## Solution Implementation

### Changes Made (2025-01-XX)

Implemented **ICE candidate queuing** to fix race condition.

#### 1. Added Pending Candidates Queue

**File**: `src/webrtc/WebRtcHandler.js:51`

```javascript
let instance,
    videoModel,
    webRtcPeer,
    socket,
    webRtcConfig,
    selectedCameraSerial,
    apiKey,
    debugLog,
    waitingForOffer = false,
    connectionRetryCount = 0,
    maxRetries = 3,
    retryDelay = 10000,
    connectionTimeout = null,
    retryTimeout = null,
    pendingIceCandidates = [];  // ← NEW: Queue for early candidates
```

#### 2. Modified Candidate Handling

**File**: `src/webrtc/WebRtcHandler.js:643-663`

```javascript
if (data.candidate) {
    debugLog('Received ICE candidate', {
        candidate: data.candidate.candidate,
        signalingState: webRtcPeer.signalingState,
        remoteDescriptionSet: !!webRtcPeer.remoteDescription
    });

    // Queue candidates if remote description is not set yet
    if (!webRtcPeer.remoteDescription) {
        debugLog('Queuing ICE candidate - remote description not set yet', {
            queueLength: pendingIceCandidates.length + 1
        });
        pendingIceCandidates.push(data.candidate);
        return;  // Early return - don't process yet
    }

    // Add candidate immediately if remote description is already set
    webRtcPeer.addIceCandidate(new RTCIceCandidate(data.candidate))
        .then(() => {
            debugLog('ICE candidate added successfully');
        })
        .catch((err) => {
            console.error('ICE candidate error:', err);
            debugLog('ERROR adding ICE candidate', {
                error: err.message,
                candidate: data.candidate
            });
        });
}
```

#### 3. Process Queued Candidates After setRemoteDescription

**File**: `src/webrtc/WebRtcHandler.js:587-613`

```javascript
webRtcPeer.setRemoteDescription(new RTCSessionDescription(description))
    .then(() => {
        debugLog('Remote description set successfully', {
            newState: webRtcPeer.signalingState
        });

        // Process queued ICE candidates now that remote description is set
        if (pendingIceCandidates.length > 0) {
            debugLog('Processing queued ICE candidates', {
                count: pendingIceCandidates.length
            });

            const candidatesToProcess = [...pendingIceCandidates];
            pendingIceCandidates = [];

            candidatesToProcess.forEach((candidate, index) => {
                webRtcPeer.addIceCandidate(new RTCIceCandidate(candidate))
                    .then(() => {
                        debugLog('Queued ICE candidate added successfully', {
                            index: index + 1,
                            total: candidatesToProcess.length
                        });
                    })
                    .catch((err) => {
                        console.error('Error adding queued ICE candidate:', err);
                        debugLog('ERROR adding queued ICE candidate', {
                            error: err.message,
                            index: index + 1,
                            candidate: candidate
                        });
                    });
            });
        }

        // Continue with answer creation...
    });
```

#### 4. Clear Queue on Connection Cleanup

**Multiple locations**:

- `destroy()` function (line 804)
- `requestVideoCall()` before new connection (lines 297-303)
- `retryConnection()` before retry (lines 549-555)

```javascript
// Clear any pending ICE candidates
if (pendingIceCandidates.length > 0) {
    debugLog('Clearing pending ICE candidates', {
        count: pendingIceCandidates.length
    });
    pendingIceCandidates = [];
}
```

### How It Works Now

```
Device sends candidates → Arrive at viewer

IF remote description not set:
    └─> Queue candidate in pendingIceCandidates[]
    └─> Log: "Queuing ICE candidate - remote description not set yet"

ELSE:
    └─> Add candidate immediately
    └─> Log: "ICE candidate added successfully"

When setRemoteDescription succeeds:
    └─> Process all queued candidates
    └─> Log: "Processing queued ICE candidates (count: N)"
    └─> Add each candidate to peer connection
    └─> Clear queue
```

---

## Testing and Debugging

### Build the Project

```bash
npm run build
```

### Enable Debug Mode

```javascript
player.updateSettings({
    webRtc: {
        enabled: true,
        mode: 'socketio',
        debug: true,  // ← Enable detailed logging
        socketUrl: 'wss://camera.geometris.com',
        serialNumber: '100151819016',
        apiKey: 'your-api-key',
        cameraIndex: 0,
        maxRetries: 3,
        retryDelay: 2000
    }
});
```

### Expected Log Messages

#### Successful Connection Flow

```
[WebRTC] Socket connected successfully
[WebRTC] Received deviceConnected event: true
[WebRTC] Creating new peer connection
[WebRTC] Received signal: offer
[WebRTC] Queuing ICE candidate - remote description not set yet (queueLength: 1)
[WebRTC] Queuing ICE candidate - remote description not set yet (queueLength: 2)
[WebRTC] Queuing ICE candidate - remote description not set yet (queueLength: 3)
[WebRTC] Remote description set successfully
[WebRTC] Processing queued ICE candidates (count: 3)
[WebRTC] Queued ICE candidate added successfully (1/3)
[WebRTC] Queued ICE candidate added successfully (2/3)
[WebRTC] Queued ICE candidate added successfully (3/3)
[WebRTC] Creating answer for offer
[WebRTC] Setting local description (answer)
[WebRTC] Sending answer back to server
[WebRTC] ICE candidate added successfully
[WebRTC] ICE connection state changed: connected
[WebRTC] Track received: video
[WebRTC] Video started playing
```

### Key Debug Indicators

| Log Message | Meaning |
|-------------|---------|
| `Queuing ICE candidate` | Candidate arrived early (expected behavior) |
| `Processing queued ICE candidates` | Queue being processed after setRemoteDescription |
| `ICE connection state changed: connected` | ✓ Connection successful |
| `ICE connection state changed: failed` | ✗ Connection failed (network/ICE server issue) |
| `WARNING: Received ICE candidate before remote description` | ⚠️ Old bug - should not appear with fix |

---

## Troubleshooting

### Issue 1: Still No Video After Fix

**Possible causes**:

1. **Device not generating ICE candidates**
   - Check device logs for ICE gathering state
   - Verify STUN/TURN servers reachable from device
   - Device only has 1 STUN + 1 TURN server (no fallbacks)

2. **Firewall blocking UDP**
   - Verify UDP traffic allowed on viewer network
   - Try TCP TURN fallback (already configured on viewer)

3. **ICE servers unreachable**
   - Test: `ping camera.geometris.com`
   - Test: `nc -u camera.geometris.com 3478`

### Issue 2: ICE Connection Fails

**Check ICE connection state**:

```javascript
webRtcPeer.oniceconnectionstatechange = () => {
    console.log('ICE State:', webRtcPeer.iceConnectionState);
    console.log('Gathering State:', webRtcPeer.iceGatheringState);
    console.log('Signaling State:', webRtcPeer.signalingState);
};
```

**States**:
- `new` → `checking` → `connected` = ✓ Success
- `new` → `checking` → `failed` = ✗ Network/ICE issue
- `new` → `checking` → `disconnected` = ⚠️ May recover

### Issue 3: Device Sends Empty Candidate Lists

**Device-side problem** - not related to viewer queue fix.

**Diagnosis**:

Add logging to device (WebRTCHelper.java):

```java
webRtcPeer.onIceGatheringStateChange = () -> {
    Log.d(TAG, "ICE gathering state: " + peerConnection.iceGatheringState());
};

webRtcPeer.onIceCandidate = (event) -> {
    if (event.candidate != null) {
        Log.d(TAG, "Generated ICE candidate: " + event.candidate.candidate);
        socket.emit("signal", new SignalData(...).toJson());
    } else {
        Log.d(TAG, "ICE gathering complete");
    }
};
```

**If no candidates generated**:
1. STUN/TURN servers unreachable from device
2. Network interface not available
3. Android permissions issue

**Solution**: Add Google STUN as fallback on device:

```java
add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer());
add(PeerConnection.IceServer.builder("stun:"+stunserver_url+":"+stunserver_port).createIceServer());
```

### Issue 4: Connection Works Then Stops

**Check device timeout**:

```java
// WebRTCHelper.java:294-306
if(System.currentTimeMillis() - callStartedTimeMs < AppConfig.WEBRTC_TIMEOUT) {
    // Send frames
} else {
    Log.d(TAG, "Call duration exceeded time limit. Ending Call.");
    cleanupWebRTCResources();
}
```

Device has a **built-in timeout** (`AppConfig.WEBRTC_TIMEOUT`). Connection automatically ends after this period.

### Issue 5: Multiple Retries Failing

**Check retry configuration**:

```javascript
webRtc: {
    maxRetries: 3,      // Increase for unreliable networks
    retryDelay: 2000,   // Increase for slow networks (try 5000)
}
```

**Logs to watch**:
- `Retrying connection (attempt N/M)`
- `Connection failed after N attempts`
- `ICE failure - possible causes`

---

## ICE Server Configuration

### Viewer (Comprehensive Fallbacks)

**File**: `src/webrtc/WebRtcHandler.js:314-360`

```javascript
const defaultIceServers = [
    // Primary STUN
    { urls: 'stun:camera.geometris.com:3478' },
    { urls: 'stun:13.64.128.177:3478' },

    // UDP TURN (standard)
    {
        urls: 'turn:camera.geometris.com:3478',
        username: 'devices',
        credential: 'A82*ndcBX'
    },

    // TCP TURN (firewall-friendly)
    {
        urls: 'turn:camera.geometris.com:8443?transport=tcp',
        username: 'devices',
        credential: 'A82*ndcBX'
    },

    // TLS TURN (encrypted, maximum compatibility)
    {
        urls: 'turns:camera.geometris.com:5349?transport=tcp',
        username: 'devices',
        credential: 'A82*ndcBX'
    },

    // Public STUN (backup)
    { urls: 'stun:stun.l.google.com:19302' }
];
```

**Why so many?**
- Corporate firewalls may block UDP
- TCP TURN on port 8443 bypasses many firewalls
- TLS TURN provides encrypted fallback
- Multiple redundancy for reliability

### Device (Minimal Configuration)

**File**: `WebRTCHelper.java:382-396`

```java
rtcConfig = new PeerConnection.RTCConfiguration(
    new ArrayList<PeerConnection.IceServer>() {{
        add(PeerConnection.IceServer.builder("stun:"+stunserver_url+":"+stunserver_port)
            .createIceServer());
        add(PeerConnection.IceServer.builder("turn:"+turnserver_url+":"+turnserver_port)
            .setUsername(turnserver_username)
            .setPassword(turnserver_password)
            .createIceServer());
    }}
);
```

**Why minimal?**
- Devices typically have good network connectivity
- Reduces complexity on resource-constrained devices
- Single STUN + single TURN (UDP) sufficient for most cases

**Recommendation**: Add Google STUN as fallback for redundancy.

---

## Security Features

### Authentication & Authorization

**Server** (`server.js`):

1. **Device Authentication**:
   - Validates serial number against database
   - Associates device with customer/owner

2. **Viewer Authentication**:
   - **ADMIN**: PIN-based, access to all devices
   - **CUSTOMER**: API key-based, access only to owned devices
   - **Admin API Key**: Special customer access to all devices

3. **Request Validation**:
   - Every action validated: `isDeviceConnected`, `requestVideoCall`, `signal`, `switchCamera`
   - Validates viewer owns/can access target device

4. **Credential Sanitization**:
   - Server strips API keys/PINs before forwarding to devices
   - Prevents credential leakage

### Rate Limiting

**File**: `server.js:250-254, 497-533`

```javascript
const RATE_LIMIT_WINDOW_MS = 5000;  // 5 seconds
const RATE_LIMIT_MAX_VIOLATIONS = 10;

// Disconnects clients exceeding 10 requests per 5 seconds
```

### Session Management

- Enforces **1-viewer-per-device** connection
- Kicks off previous viewer when new one connects
- Sends `forcedDisconnect` to previous viewer

---

## Statistics Tracking

**Server** tracks usage for billing/analytics:

1. **Device Connections** (line 375)
2. **Viewer Connections** (line 431)
3. **Video Call Sessions** (line 692)
4. **Video Stream Sessions** (line 764)
   - Hybrid client/server detection
   - Auto-cleanup on disconnect

**Batch submission** to API endpoint every 5 minutes or 100 sessions.

---

## Summary

This WebRTC implementation uses a **well-architected 3-way signaling system** with:

✅ **Device-initiated offer pattern** (correct for streaming scenarios)
✅ **Centralized signaling server** for pairing and access control
✅ **Role-based authentication** and authorization
✅ **ICE candidate queuing** (fixed race condition)
✅ **Comprehensive ICE server fallbacks** for viewer compatibility
✅ **Rate limiting** and security measures
✅ **Usage statistics tracking**

### Recent Fix (2025-01-XX)

Fixed critical **ICE candidate race condition** where candidates arriving before `setRemoteDescription` were being dropped. Implemented queuing mechanism to ensure all candidates are processed in correct order.

**Result**: Significantly improved connection success rate in restrictive network environments.

---

## References

- WebRTC Specification: https://www.w3.org/TR/webrtc/
- ICE RFC: https://tools.ietf.org/html/rfc8445
- TURN RFC: https://tools.ietf.org/html/rfc5766
- Socket.io Documentation: https://socket.io/docs/

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Authors**: Development Team
