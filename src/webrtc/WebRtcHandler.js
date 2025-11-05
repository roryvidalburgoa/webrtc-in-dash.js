/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
import { WHPPClient } from '@eyevinn/whpp-client';
import io from 'socket.io-client';
import FactoryMaker from '../core/FactoryMaker';

function WebRtcHandler() {

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
        pendingIceCandidates = [];

    function setup() {
        debugLog = function (message, data) {
            if (webRtcConfig && webRtcConfig.debug) {
                const timestamp = new Date().toISOString();
                console.log(`[WebRTC ${timestamp}] ${message}`, data || '');
            }
        };
    }

    function setConfig(config) {
        if (config.videoModel) {
            videoModel = config.videoModel;
        }
        if (config.webRtcConfig) {
            webRtcConfig = config.webRtcConfig;
            // Update the selectedCameraSerial and current apiKey when config changes
            if (webRtcConfig.serialNumber) {
                selectedCameraSerial = webRtcConfig.serialNumber;
            }
            if (webRtcConfig.apiKey) {
                apiKey = webRtcConfig.apiKey;
            }
            // Configure retry parameters
            if (webRtcConfig.maxRetries !== undefined) {
                maxRetries = webRtcConfig.maxRetries;
            }
            if (webRtcConfig.retryDelay !== undefined) {
                retryDelay = webRtcConfig.retryDelay;
            }
            debugLog('WebRTC config set', {
                ...webRtcConfig,
                apiKey: apiKey ? '***' : 'not set',
                maxRetries: maxRetries,
                retryDelay: retryDelay
            });
        }
    }

    function loadFromManifest(manifest) {
        debugLog('loadFromManifest called', { mode: webRtcConfig?.mode, hasManifest: !!manifest });

        // Check if we're using socket.io mode (no manifest required)
        if (webRtcConfig && webRtcConfig.mode === 'socketio') {
            debugLog('Socket.io mode detected, setting up client');
            return setupSocketIoClient();
        }

        // Original WHPP logic
        let webRtcAdaptationSet;
        const periods = manifest.Period_asArray;
        for (let i = periods.length - 1; i >= 0 && !webRtcAdaptationSet; i--) {
            webRtcAdaptationSet = periods[i].AdaptationSet_asArray
                .find((adaptationSet) => adaptationSet.mimeType === 'video RTP/AVP');
        }

        if (webRtcAdaptationSet && webRtcAdaptationSet['xlink:actuate'] === 'onRequest') {
            return setupClient(webRtcAdaptationSet);
        } else {
            return false;
        }
    }

    function setupClient(webRtcAdaptationSet) {
        const success = _initializeWebRtcPeer(webRtcAdaptationSet['xlink:rel']);
        if (success) {
            const channelUrl = webRtcAdaptationSet['xlink:href'];
            const client = new WHPPClient(webRtcPeer, new URL(channelUrl));
            client.connect()
                .then(() => console.log('WebRTC connected.'))
                .catch(console.warn);
            return true;
        }
        return false;
    }

    function _initializeWebRtcPeer(sessionNegotiationProtocol) {
        switch (sessionNegotiationProtocol) {
            case 'urn:ietf:params:whip:whpp':
                webRtcPeer = new RTCPeerConnection();
                webRtcPeer.ontrack = (evt) => {
                    if (evt.streams && evt.streams[0]) {
                        videoModel.getElement().srcObject = evt.streams[0];
                    }
                };
                return true;
            default:
                // TODO: implement proper error handling
                console.error(`Unknown WebRTC session negotiation protocol '${sessionNegotiationProtocol}'.`);
                return false;
        }
    }

    function setupSocketIoClient() {
        debugLog('setupSocketIoClient called');

        if (!webRtcConfig || !webRtcConfig.socketUrl) {
            console.error('Socket.io URL not configured');
            debugLog('ERROR: Socket.io URL not configured', webRtcConfig);
            return false;
        }

        // Always use the latest values from webRtcConfig
        selectedCameraSerial = webRtcConfig.serialNumber;
        apiKey = webRtcConfig.apiKey;

        if (!selectedCameraSerial) {
            console.error('Serial number not provided');
            debugLog('ERROR: Serial number not provided');
            return false;
        }

        debugLog('Connecting to Socket.io', {
            url: webRtcConfig.socketUrl,
            serialNumber: selectedCameraSerial,
            apiKey: apiKey ? '***' : 'not set',
            cameraIndex: webRtcConfig.cameraIndex
        });

        // Close existing socket if any
        if (socket) {
            debugLog('Closing existing socket connection');
            socket.disconnect();
            socket = null;
        }

        // Initialize new socket connection
        socket = io(webRtcConfig.socketUrl);

        // Setup socket event handlers
        socket.on('connect', () => {
            console.log('Socket.io connected', socket.id);
            debugLog('Socket connected successfully', { socketId: socket.id });

            const role = 'customer';
            debugLog('Emitting register event', { role: role, apiKey: apiKey ? '***' : 'not set' });
            socket.emit('register', role, role, apiKey);

            // Check if device is connected
            if (selectedCameraSerial) {
                debugLog('Checking device connection', { serial: selectedCameraSerial });
                socket.emit('isDeviceConnected', {
                    apiKey: apiKey,
                    serial: selectedCameraSerial
                });
            } else {
                debugLog('WARNING: No serial number configured');
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.io disconnected', reason);
            debugLog('Socket disconnected', { reason });
        });

        socket.on('connect_error', (error) => {
            debugLog('Socket connection error', { error: error.message });
        });

        socket.on('deviceConnected', (isDeviceConnected) => {
            console.log('Device connected:', isDeviceConnected);
            debugLog('Received deviceConnected event', {
                isConnected: isDeviceConnected,
                serial: selectedCameraSerial
            });

            if (isDeviceConnected && selectedCameraSerial) {
                debugLog('Device is connected, requesting video call');
                requestVideoCall();
            } else {
                debugLog('Device not connected or no serial', {
                    isDeviceConnected,
                    hasSerial: !!selectedCameraSerial
                });
            }
        });

        socket.on('cameras', (cameras) => {
            console.log('Available cameras:', cameras);
            debugLog('Received cameras list', { count: cameras?.length || 0, cameras });

            if (cameras && cameras.length > 0) {
                const cameraExists = cameras.some(cam => cam.serial === selectedCameraSerial);
                debugLog('Checking if our camera exists', {
                    ourSerial: selectedCameraSerial,
                    exists: cameraExists
                });

                if (cameraExists) {
                    debugLog('Camera found in list, requesting video call');
                    requestVideoCall();
                } else {
                    debugLog('Camera NOT found in list');
                }
            } else {
                debugLog('No cameras available');
            }
        });

        socket.on('signal', (data) => {
            debugLog('Received signal', {
                hasDescription: !!data?.description,
                descriptionType: data?.description?.type,
                hasCandidate: !!data?.candidate
            });
            handleSocketSignal(data);
        });

        socket.on('forcedDisconnect', (data) => {
            console.log('Forced disconnect:', data);
            debugLog('Forced disconnect received', data);
            destroy();
        });

        // Log all socket events for debugging
        if (webRtcConfig.debug) {
            const originalEmit = socket.emit;
            socket.emit = function (...args) {
                debugLog('Socket EMIT', { event: args[0], data: args.slice(1) });
                return originalEmit.apply(socket, args);
            };
        }

        return true;
    }

    function requestVideoCall() {
        debugLog('requestVideoCall called');

        if (!socket || !selectedCameraSerial) {
            console.error('Socket not connected or no camera selected');
            debugLog('ERROR: Cannot request video call', {
                hasSocket: !!socket,
                hasSerial: !!selectedCameraSerial
            });
            return;
        }

        // Close existing connection if any
        if (webRtcPeer) {
            debugLog('Closing existing peer connection');
            webRtcPeer.close();
            webRtcPeer = null;
        }

        // Clear any pending ICE candidates from previous connection
        if (pendingIceCandidates.length > 0) {
            debugLog('Clearing pending ICE candidates from previous connection', {
                count: pendingIceCandidates.length
            });
            pendingIceCandidates = [];
        }

        // Create new peer connection
        debugLog('Creating new peer connection');
        createSocketIoPeerConnection();

        const payload = {
            target: selectedCameraSerial,
            apiKey: apiKey,
            cameraIndex: webRtcConfig.cameraIndex || 0
        };

        console.log('Requesting video call to', selectedCameraSerial);
        debugLog('Emitting requestVideoCall', payload);
        waitingForOffer = true;
        socket.emit('requestVideoCall', payload);
    }

    function createSocketIoPeerConnection() {
        // Enhanced ICE server configuration for restrictive networks
        const defaultIceServers = [
            // Primary STUN servers (Geometris)
            { urls: 'stun:camera.geometris.com:3478' },
            { urls: 'stun:13.64.128.177:3478' }, // IPv4 fallback for camera.geometris.com

            // UDP TURN servers (Geometris) - Standard WebRTC transport
            {
                urls: 'turn:camera.geometris.com:3478',
                username: 'devices',
                credential: 'A82*ndcBX'
            },
            {
                urls: 'turn:13.64.128.177:3478', // IPv4 fallback for camera.geometris.com
                username: 'devices',
                credential: 'A82*ndcBX'
            },

            // TCP TURN servers (Geometris) - Firewall-friendly fallback
            // Port 8443 disguises TURN traffic, helping bypass restrictive firewalls
            {
                urls: 'turn:camera.geometris.com:8443?transport=tcp',
                username: 'devices',
                credential: 'A82*ndcBX'
            },
            {
                urls: 'turn:13.64.128.177:8443?transport=tcp', // IPv4 fallback
                username: 'devices',
                credential: 'A82*ndcBX'
            },

            // TLS TURN servers (Geometris) - Encrypted fallback for maximum compatibility
            // Port 5349 is standard TURNS (TURN over TLS)
            {
                urls: 'turns:camera.geometris.com:5349?transport=tcp',
                username: 'devices',
                credential: 'A82*ndcBX'
            },
            {
                urls: 'turns:13.64.128.177:5349?transport=tcp', // IPv4 fallback
                username: 'devices',
                credential: 'A82*ndcBX'
            },

            // Public STUN servers (Google) - backup/fallback
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];

        const iceServers = webRtcConfig.iceServers || defaultIceServers;

        debugLog('Creating RTCPeerConnection', {
            iceServers: iceServers.map(server => ({
                urls: server.urls,
                hasCredentials: !!(server.username && server.credential)
            })),
            configuration: {
                iceServers: iceServers,
                iceCandidatePoolSize: 10
            }
        });

        webRtcPeer = new RTCPeerConnection({
            iceServers: iceServers,
            iceCandidatePoolSize: 10
        });

        webRtcPeer.onicecandidate = (event) => {
            if (event.candidate && socket) {
                debugLog('Sending ICE candidate', {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                });
                socket.emit('signal', {
                    role: 'admin',
                    candidate: event.candidate,
                    target: selectedCameraSerial,
                    apiKey: apiKey
                });
            } else if (!event.candidate) {
                debugLog('ICE gathering complete');
            }
        };
        
        /**
         * ICE connection state change event handler. Called whenever the ICE connection
         * state changes. Possible states are:
         *
         * - 'new': The ICE connection has just been created.
         * - 'checking': The ICE connection is being checked.
         * - 'connected': The ICE connection has been established successfully.
         * - 'completed': The ICE connection has been fully established and is ready for use.
         * - 'failed': The ICE connection failed to establish.
         * - 'disconnected': The ICE connection was closed.
         *
         * @param {Event} event - The event object containing the new state of the ICE connection.
         */

        webRtcPeer.oniceconnectionstatechange = () => {
            const state = webRtcPeer.iceConnectionState;
            debugLog('ICE connection state changed', {
                state: state,
                retryCount: connectionRetryCount,
                maxRetries: maxRetries
            });

            if (state === 'failed') {
                console.error('WebRTC: ICE connection failed. Check your network connectivity and ICE server configuration.');
                debugLog('ICE failure - possible causes:', {
                    message: 'Check firewall settings, STUN/TURN server availability, and network connectivity',
                    iceServers: iceServers.map(s => s.urls),
                    retryCount: connectionRetryCount
                });

                // Retry logic for restrictive networks
                if (connectionRetryCount < maxRetries) {
                    connectionRetryCount++;
                    console.log(`WebRTC: Retrying connection (attempt ${connectionRetryCount}/${maxRetries})...`);
                    debugLog('Scheduling connection retry', {
                        attempt: connectionRetryCount,
                        maxRetries: maxRetries,
                        delay: retryDelay
                    });

                    retryTimeout = setTimeout(() => {
                        debugLog('Executing retry', { attempt: connectionRetryCount });
                        retryConnection();
                    }, retryDelay);
                } else {
                    console.error(`WebRTC: Connection failed after ${maxRetries} attempts`);
                    debugLog('Max retries reached, giving up', {
                        attempts: connectionRetryCount
                    });
                }
            } else if (state === 'disconnected') {
                debugLog('ICE disconnected - device peer disconnected - connection may recover');
            } else if (state === 'connected' || state === 'completed') {
                debugLog('ICE connection established successfully');
                // Reset retry counter on successful connection
                connectionRetryCount = 0;
                clearTimeouts();
            }
        };

        webRtcPeer.onconnectionstatechange = () => {
            const state = webRtcPeer.connectionState;
            debugLog('Connection state changed', { state: state });

            if (state === 'failed') {
                console.error('WebRTC: Connection failed. The peer connection has failed and cannot recover.');
                // Clean up the failed connection
                if (webRtcPeer) {
                    webRtcPeer.close();
                }
            }
        };

        webRtcPeer.onsignalingstatechange = () => {
            debugLog('Signaling state changed', { state: webRtcPeer.signalingState });
        };

        webRtcPeer.ontrack = (event) => {
            debugLog('Track received', {
                kind: event.track.kind,
                id: event.track.id,
                streams: event.streams.length
            });

            if (event.streams && event.streams[0]) {
                const videoElement = videoModel.getElement();
                debugLog('Setting video srcObject', {
                    hasVideoElement: !!videoElement,
                    streamActive: event.streams[0].active
                });
                videoElement.srcObject = event.streams[0];

                // Log when video starts playing
                videoElement.onloadedmetadata = () => {
                    debugLog('Video metadata loaded', {
                        width: videoElement.videoWidth,
                        height: videoElement.videoHeight
                    });
                };

                videoElement.onplaying = () => {
                    debugLog('Video started playing');
                };
            }
        };

        return webRtcPeer;
    }

    function clearTimeouts() {
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
    }

    function retryConnection() {
        debugLog('retryConnection called', {
            hasSocket: !!socket,
            hasSerial: !!selectedCameraSerial,
            attempt: connectionRetryCount
        });

        if (!socket || !selectedCameraSerial) {
            console.error('Cannot retry: Socket not connected or no camera selected');
            return;
        }

        // Close existing peer connection
        if (webRtcPeer) {
            debugLog('Closing failed peer connection before retry');
            try {
                webRtcPeer.close();
            } catch (e) {
                debugLog('Error closing peer connection', { error: e.message });
            }
            webRtcPeer = null;
        }

        // Clear any pending ICE candidates from failed connection
        if (pendingIceCandidates.length > 0) {
            debugLog('Clearing pending ICE candidates from failed connection', {
                count: pendingIceCandidates.length
            });
            pendingIceCandidates = [];
        }

        // Create new peer connection
        debugLog('Creating new peer connection for retry');
        createSocketIoPeerConnection();

        // Request new video call
        const payload = {
            target: selectedCameraSerial,
            apiKey: apiKey,
            cameraIndex: webRtcConfig.cameraIndex || 0
        };

        console.log(`Requesting video call (retry ${connectionRetryCount}/${maxRetries})`);
        debugLog('Emitting requestVideoCall for retry', payload);
        waitingForOffer = true;
        socket.emit('requestVideoCall', payload);
    }

    function handleSocketSignal(data) {
        // Handle case where peer connection is closed or doesn't exist when receiving an offer
        if (!webRtcPeer || webRtcPeer.signalingState === 'closed') {
            if (data.description && data.description.type === 'offer') {
                debugLog('Received offer but peer connection is closed/missing, recreating', {
                    hasPeer: !!webRtcPeer,
                    signalingState: webRtcPeer?.signalingState
                });
                createSocketIoPeerConnection();
            } else {
                debugLog('WARNING: Received signal but no peer connection exists');
                return;
            }
        }

        if (data.description) {
            const description = data.description;
            waitingForOffer = false;  // We received the offer
            debugLog('Processing remote description', {
                type: description.type,
                currentState: webRtcPeer.signalingState
            });

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

                    if (description.type === 'offer' &&
                        (webRtcPeer.signalingState === 'have-remote-offer' ||
                            webRtcPeer.signalingState === 'have-local-pranswer')) {
                        debugLog('Creating answer for offer');
                        return webRtcPeer.createAnswer();
                    }
                    debugLog('Not creating answer', {
                        descriptionType: description.type,
                        signalingState: webRtcPeer.signalingState
                    });
                    return null;
                })
                .then((answer) => {
                    if (answer && webRtcPeer.signalingState !== 'stable') {
                        debugLog('Setting local description (answer)', {
                            type: answer.type
                        });
                        return webRtcPeer.setLocalDescription(answer);
                    }
                    if (answer) {
                        debugLog('Not setting local description', {
                            hasAnswer: true,
                            signalingState: webRtcPeer.signalingState
                        });
                    }
                    return null;
                })
                .then(() => {
                    if (webRtcPeer.localDescription) {
                        debugLog('Sending answer back to server', {
                            type: webRtcPeer.localDescription.type
                        });
                        socket.emit('signal', {
                            role: 'admin',
                            description: webRtcPeer.localDescription,
                            target: selectedCameraSerial,
                            apiKey: apiKey
                        });
                    }
                })
                .catch((err) => {
                    console.error('Signal handling error:', err);
                    debugLog('ERROR in signal handling', {
                        error: err.message,
                        stack: err.stack
                    });
                });
        }

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
                return;
            }

            // Add the candidate immediately if remote description is already set
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
    }

    function switchCamera() {
        if (!socket || !selectedCameraSerial) {
            console.error('Socket not connected or no camera selected');
            return;
        }

        const cameraIndex = webRtcConfig.cameraIndex === 0 ? 1 : 0;
        webRtcConfig.cameraIndex = cameraIndex;

        const payload = {
            apiKey: apiKey,
            cameraIndex: cameraIndex,
            target: selectedCameraSerial
        };

        console.log('Switching camera to index', cameraIndex);
        socket.emit('switchCamera', payload);
    }

    function loadFromUrl(/* url */) {
        debugLog('loadFromUrl called', { mode: webRtcConfig?.mode });

        // For socket.io mode, URL isn't used for manifest
        if (webRtcConfig && webRtcConfig.mode === 'socketio') {
            debugLog('Socket.io mode, setting up client');
            return setupSocketIoClient();
        }
        return false;
    }

    function isConnected() {
        // Check if we have an active WebRTC connection
        if (webRtcPeer) {
            const connectionState = webRtcPeer.connectionState;
            const iceState = webRtcPeer.iceConnectionState;

            debugLog('Connection check', {
                connectionState: connectionState,
                iceState: iceState,
                hasSocket: !!socket,
                socketConnected: socket?.connected
            });

            // Don't consider closed states as connected
            if (connectionState === 'closed' || connectionState === 'failed' ||
                iceState === 'closed' || iceState === 'failed') {
                return false;
            }

            // Connection is established if peer connection is connected or completed
            return (connectionState === 'connected' ||
                iceState === 'connected' ||
                iceState === 'completed');
        }
        return false;
    }

    function getConnectionState() {
        if (!webRtcPeer) {
            return { state: 'disconnected', details: 'No peer connection' };
        }

        return {
            state: webRtcPeer.connectionState,
            iceState: webRtcPeer.iceConnectionState,
            signalingState: webRtcPeer.signalingState,
            socketConnected: socket?.connected || false,
            hasVideo: !!videoModel?.getElement()?.srcObject,
            waitingForOffer: waitingForOffer
        };
    }

    function destroy() {
        debugLog('Destroying WebRTC handler');

        // Clear any pending timeouts
        clearTimeouts();

        if (webRtcPeer) {
            debugLog('Closing peer connection');
            webRtcPeer.close();
            webRtcPeer = null;

            // Safely reset video element
            try {
                const videoElement = videoModel?.getElement();
                if (videoElement && videoElement.srcObject) {
                    // Stop all tracks before removing
                    const stream = videoElement.srcObject;
                    if (stream && stream.getTracks) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                    videoElement.srcObject = null;
                }
            } catch (e) {
                debugLog('Error resetting video element', { error: e.message });
            }
        }
        if (socket) {
            debugLog('Disconnecting socket');
            socket.disconnect();
            socket = null;
        }

        // Reset connection variables
        selectedCameraSerial = null;
        apiKey = null;
        waitingForOffer = false;
        connectionRetryCount = 0;
        pendingIceCandidates = [];
    }

    instance = {
        setConfig,
        loadFromManifest,
        loadFromUrl,
        switchCamera,
        isConnected,
        getConnectionState,
        destroy
    };

    setup();

    return instance;
}

WebRtcHandler.__dashjs_factory_name = 'WebRtcHandler';
export default FactoryMaker.getSingletonFactory(WebRtcHandler);
