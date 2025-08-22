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
        waitingForOffer = false;

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
            debugLog('WebRTC config set', {
                ...webRtcConfig,
                apiKey: apiKey ? '***' : 'not set'
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
        const iceServers = webRtcConfig.iceServers || [
            { urls: 'stun:stun.l.google.com:19302' }
        ];

        debugLog('Creating RTCPeerConnection', {
            iceServers: iceServers,
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

        webRtcPeer.oniceconnectionstatechange = () => {
            const state = webRtcPeer.iceConnectionState;
            debugLog('ICE connection state changed', { state: state });

            if (state === 'failed') {
                console.error('WebRTC: ICE connection failed. Check your network connectivity and ICE server configuration.');
                debugLog('ICE failure - possible causes:', {
                    message: 'Check firewall settings, STUN/TURN server availability, and network connectivity',
                    iceServers: iceServers
                });
                // Optionally retry or notify the user
            } else if (state === 'disconnected') {
                debugLog('ICE disconnected - connection may recover');
            } else if (state === 'connected' || state === 'completed') {
                debugLog('ICE connection established successfully');
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

    function handleSocketSignal(data) {
        if (!webRtcPeer) {
            debugLog('WARNING: Received signal but no peer connection exists');
            return;
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

            // Only add ICE candidates after remote description is set
            if (webRtcPeer.remoteDescription) {
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
            } else {
                debugLog('WARNING: Received ICE candidate before remote description was set, queuing...');
                // You might want to queue these and add them later
            }
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
