import React, { useState, useRef, useEffect } from "react";
import "./App.css";

declare global {
    interface Window {
        dashjs: any;
    }
}

const App: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isWebRTCMode, setIsWebRTCMode] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [statusType, setStatusType] = useState<"info" | "error" | "success">(
        "info"
    );
    const [pendingConnection, setPendingConnection] = useState(false);

    // Form state
    const [socketUrl, setSocketUrl] = useState("wss://camera.geometris.com");
    const [serialNumber, setSerialNumber] = useState("100151819016");
    const [apiKey, setApiKey] = useState("ne83247hdhiwe384jdh");
    const [cameraIndex, setCameraIndex] = useState(0);
    const [debugMode, setDebugMode] = useState(true);
    const [autoPlay, setAutoPlay] = useState(true);

    // Predefined DASH URLs
    const dashUrls = [
        {
            label: "Big Buck Bunny (30fps)",
            url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
        },
        {
            label: "Live Simulator (2s segments)",
            url: "https://livesim.dashif.org/livesim/testpic_2s/Manifest.mpd",
        },
        {
            label: "Envivio Test Stream",
            url: "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd",
        },
        {
            label: "Tears of Steel (4K)",
            url: "https://dash.akamaized.net/dash264/TestCasesIOP33/adapatationSetSwitching/5/manifest.mpd",
        },
        {
            label: "Sintel (Multi-audio)",
            url: "https://dash.akamaized.net/dash264/TestCases/2c/qualcomm/1/MultiResMPEG2.mpd",
        },
        { label: "Custom URL", url: "custom" },
    ];

    const [selectedDashOption, setSelectedDashOption] = useState(
        "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"
    );
    const [customDashUrl, setCustomDashUrl] = useState("");
    const [iceServers, setIceServers] = useState(
        JSON.stringify(
            [
                { urls: "stun:camera.geometris.com:3478" },
                {
                    urls: "turn:camera.geometris.com:3478",
                    username: "devices",
                    credential: "A82*ndcBX",
                },
            ],
            null,
            2
        )
    );

    useEffect(() => {
        // Wait for dashjs to be loaded
        const checkDashjs = setInterval(() => {
            if (window.dashjs) {
                console.log("dashjs library loaded and ready");
                clearInterval(checkDashjs);
            }
        }, 100);

        return () => {
            clearInterval(checkDashjs);
            if (playerRef.current) {
                try {
                    playerRef.current.reset();
                } catch (e) {
                    console.log("Error cleaning up player:", e);
                }
            }
        };
    }, []);

    // Debug effect to monitor state changes
    useEffect(() => {
        console.log(
            "State Update - isConnected:",
            isConnected,
            "isWebRTCMode:",
            isWebRTCMode
        );
    }, [isConnected, isWebRTCMode]);

    const showStatus = (
        message: string,
        type: "info" | "error" | "success" = "info"
    ) => {
        setStatusMessage(message);
        setStatusType(type);
        setTimeout(() => {
            setStatusMessage("");
        }, 5000);
    };

    const connectSocketIo = () => {
        if (!socketUrl || !serialNumber || !apiKey) {
            showStatus("Please fill in all required fields", "error");
            return;
        }

        // Make sure dashjs is loaded
        if (!window.dashjs) {
            showStatus(
                "dashjs library not loaded yet. Please try again.",
                "error"
            );
            return;
        }

        if (isConnected) {
            disconnect();
        }

        let parsedIceServers;
        try {
            parsedIceServers = iceServers.trim()
                ? JSON.parse(iceServers)
                : [
                      { urls: "stun:camera.geometris.com:3478" },
                      {
                          urls: "turn:camera.geometris.com:3478",
                          username: "devices",
                          credential: "A82*ndcBX",
                      },
                      { urls: "stun:stun.l.google.com:19302" },
                  ];
        } catch (e) {
            showStatus("Invalid ICE servers JSON format", "error");
            return;
        }

        if (!playerRef.current) {
            playerRef.current = window.dashjs.MediaPlayer().create();
        }

        console.log("Initializing WebRTC with settings:", {
            mode: "socketio",
            socketUrl,
            serialNumber,
            apiKey: "***",
            cameraIndex,
            debug: debugMode,
        });

        // Configure player for socket.io WebRTC
        playerRef.current.updateSettings({
            webRtc: {
                enabled: true,
                dashOnFail: false,
                mode: "socketio",
                socketUrl,
                serialNumber,
                apiKey: apiKey,
                cameraIndex,
                debug: debugMode,
                iceServers: parsedIceServers,
            },
            streaming: {
                delay: {
                    liveDelay: 4,
                },
                buffer: {
                    fastSwitchEnabled: true,
                },
            },
        });

        // Initialize player with dummy URL (not used in socket.io mode)
        // The third parameter controls autoPlay
        if (videoRef.current) {
            playerRef.current.initialize(
                videoRef.current,
                "wss://camera.geometris.com",
                autoPlay
            );

            // If autoPlay is false, we need to manually handle play after connection
            if (!autoPlay) {
                console.log(
                    "AutoPlay is disabled. Video will not play automatically."
                );
            }
        }

        setPendingConnection(true);
        setIsWebRTCMode(true);
        showStatus("Connecting to WebRTC server...", "success");

        // Wait for device connection
        waitForDeviceConnection();
    };

    const waitForDeviceConnection = () => {
        let checkAttempts = 0;
        const maxCheckAttempts = 60; // 30 seconds with 500ms intervals

        const checkConnection = setInterval(() => {
            checkAttempts++;
            const handler = playerRef.current?.getWebRtcHandler();

            if (handler) {
                const connectionState = handler.getConnectionState();

                if (checkAttempts % 4 === 0) {
                    console.log("Connection state:", connectionState);
                }

                if (handler.isConnected()) {
                    const video = videoRef.current;
                    if (
                        video &&
                        video.srcObject &&
                        (video.srcObject as MediaStream).active
                    ) {
                        // Connection successful - clear interval first
                        clearInterval(checkConnection);

                        console.log(
                            "WebRTC Connection established! Setting states..."
                        );

                        // Update all states together
                        setPendingConnection(false);
                        setIsConnected(true);
                        setIsWebRTCMode(true);

                        // Show appropriate message based on autoPlay setting
                        if (autoPlay) {
                            showStatus(
                                `Connected to device ${serialNumber} - Video playing`,
                                "success"
                            );
                        } else {
                            showStatus(
                                `Connected to device ${serialNumber} - Click "Play Video" to start`,
                                "success"
                            );
                        }

                        // Start monitoring the connection
                        startConnectionMonitoring();

                        return; // Exit the interval
                    } else {
                        if (checkAttempts % 4 === 0) {
                            console.log(
                                "WebRTC connected, waiting for video stream..."
                            );
                        }
                    }
                } else if (
                    connectionState.state === "failed" ||
                    connectionState.iceState === "failed"
                ) {
                    clearInterval(checkConnection);
                    setPendingConnection(false);
                    showStatus(
                        "Connection failed - check network and ICE servers",
                        "error"
                    );
                    disconnect();
                    return;
                } else if (
                    connectionState.state === "new" &&
                    connectionState.waitingForOffer &&
                    checkAttempts > 10
                ) {
                    if (checkAttempts % 4 === 0) {
                        showStatus("Waiting for device response...", "info");
                    }
                }

                if (checkAttempts >= maxCheckAttempts) {
                    clearInterval(checkConnection);
                    setPendingConnection(false);
                    showStatus(
                        "Connection timeout - device did not respond",
                        "error"
                    );
                    disconnect();
                    return;
                }
            }
        }, 500);
    };

    const startConnectionMonitoring = () => {
        const monitorInterval = setInterval(() => {
            if (playerRef.current) {
                try {
                    const handler =
                        playerRef.current.getWebRtcHandler &&
                        playerRef.current.getWebRtcHandler();
                    if (handler) {
                        const state = handler.getConnectionState();

                        // Check if connection has failed or closed
                        if (
                            state.state === "failed" ||
                            state.state === "closed" ||
                            !handler.isConnected()
                        ) {
                            console.log(
                                "Connection lost, cleaning up. State:",
                                state
                            );
                            clearInterval(monitorInterval);

                            // Update states
                            setIsConnected(false);
                            setIsWebRTCMode(false);
                            showStatus("Connection lost", "error");

                            // Clean up the handler
                            try {
                                handler.destroy();
                            } catch (e) {
                                console.log("Error destroying handler:", e);
                            }
                        }
                    }
                } catch (e) {
                    console.log("Error monitoring connection:", e);
                    clearInterval(monitorInterval);
                }
            }
        }, 2000); // Check every 2 seconds

        // Store the interval ID in a ref so we can clear it later
        (window as any).connectionMonitorInterval = monitorInterval;
    };

    const disconnect = () => {
        setPendingConnection(false);

        // Clear connection monitoring if running
        if ((window as any).connectionMonitorInterval) {
            clearInterval((window as any).connectionMonitorInterval);
            (window as any).connectionMonitorInterval = null;
        }

        if (playerRef.current) {
            try {
                // Try to get WebRTC handler if in WebRTC mode
                const handler =
                    playerRef.current.getWebRtcHandler &&
                    playerRef.current.getWebRtcHandler();
                if (handler && handler.destroy) {
                    handler.destroy();
                }
            } catch (e) {
                console.log("No WebRTC handler to destroy");
            }

            try {
                // Reset the player
                playerRef.current.reset();
            } catch (e) {
                console.log("Error resetting player:", e);
            }

            setIsConnected(false);
            setIsWebRTCMode(false);
            showStatus("Disconnected", "success");
        }
    };

    const switchCamera = () => {
        if (playerRef.current && isConnected) {
            const handler = playerRef.current.getWebRtcHandler();
            if (handler && handler.switchCamera) {
                handler.switchCamera();
                showStatus("Switching camera...", "success");
            } else {
                showStatus("WebRTC handler not available", "error");
            }
        } else {
            showStatus("Not connected", "error");
        }
    };

    const loadDashStream = () => {
        // Determine which URL to use
        const urlToLoad =
            selectedDashOption === "custom"
                ? customDashUrl
                : selectedDashOption;

        if (!urlToLoad) {
            showStatus(
                "Please select a DASH stream or enter a custom URL",
                "error"
            );
            return;
        }

        // Make sure dashjs is loaded
        if (!window.dashjs) {
            showStatus(
                "dashjs library not loaded yet. Please try again.",
                "error"
            );
            return;
        }

        // Disconnect any existing connections
        if (isConnected) {
            disconnect();
        }

        // Clear WebRTC mode since we're switching to DASH
        setIsWebRTCMode(false);

        // Clean up existing player if any
        if (playerRef.current) {
            try {
                playerRef.current.reset();
                playerRef.current = null;
            } catch (e) {
                console.log("Error resetting player:", e);
            }
        }

        if (videoRef.current) {
            try {
                console.log("Creating new DASH player...");

                // Create a fresh player instance for DASH
                const newPlayer = window.dashjs.MediaPlayer().create();

                // Configure the player
                newPlayer.updateSettings({
                    debug: {
                        logLevel: debugMode ? 4 : 0,
                    },
                    streaming: {
                        abr: {
                            autoSwitchBitrate: {
                                video: true,
                                audio: true,
                            },
                        },
                    },
                });

                console.log("Loading DASH stream:", urlToLoad);
                showStatus("Loading DASH stream...", "info");

                // Initialize with video element and URL
                newPlayer.initialize(videoRef.current, urlToLoad, true);

                // Set up event listeners
                newPlayer.on(
                    window.dashjs.MediaPlayer.events.PLAYBACK_STARTED,
                    () => {
                        showStatus("DASH stream playing", "success");
                        // Don't set isConnected for DASH - that's for WebRTC only
                    }
                );

                newPlayer.on(
                    window.dashjs.MediaPlayer.events.ERROR,
                    (e: any) => {
                        console.error("DASH playback error:", e);
                        if (e.error && e.error.message) {
                            showStatus(
                                "DASH playback error: " + e.error.message,
                                "error"
                            );
                        } else {
                            showStatus("DASH playback error", "error");
                        }
                    }
                );

                // Store the player reference
                playerRef.current = newPlayer;

                console.log("DASH player initialized successfully");
            } catch (e: any) {
                console.error("Failed to load DASH stream:", e);
                showStatus("Failed to load DASH stream: " + e.message, "error");
            }
        } else {
            showStatus("Video element not ready", "error");
        }
    };

    const loadDefaults = () => {
        setSocketUrl("wss://camera.geometris.com");
        setSerialNumber("100151819016");
        setApiKey("n4kwk2930jwjs9394");
        setIceServers(
            JSON.stringify(
                [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:camera.geometris.com:3478" },
                    {
                        urls: "turn:camera.geometris.com:3478",
                        username: "devices",
                        credential: "A82*ndcBX",
                    },
                ],
                null,
                2
            )
        );
        setSelectedDashOption(
            "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"
        );
        setCustomDashUrl("");
    };

    const loadDebugDefaults = () => {
        setSocketUrl("http://localhost");
        setSerialNumber("100151819016");
        setApiKey("kiu3ik398jfj28484ks");
        setIceServers(
            JSON.stringify([{ urls: "stun:stun.l.google.com:19302" }], null, 2)
        );
    };

    return (
        <div className="App">
            <div className="container">
                <header className="header">
                    <h2>dashjs WebRTC Socket.io Player</h2>
                    <span
                        className={`connection-indicator ${
                            isConnected ? "connected" : ""
                        }`}
                    ></span>
                </header>

                <div className="control-panel">
                    <h3>Connection Settings</h3>

                    <div className="settings-row">
                        <div className="form-group">
                            <label>Socket Server URL</label>
                            <input
                                type="text"
                                value={socketUrl}
                                onChange={(e) => setSocketUrl(e.target.value)}
                                placeholder="wss://camera.geometris.com"
                            />
                        </div>

                        <div className="form-group">
                            <label>Device Serial Number</label>
                            <input
                                type="text"
                                value={serialNumber}
                                onChange={(e) =>
                                    setSerialNumber(e.target.value)
                                }
                                placeholder="100150660001"
                            />
                        </div>

                        <div className="form-group">
                            <label>APIKey</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="ne83247hdhiwe384jdh"
                            />
                        </div>

                        <div className="form-group">
                            <label>Camera Index</label>
                            <select
                                value={cameraIndex}
                                onChange={(e) =>
                                    setCameraIndex(Number(e.target.value))
                                }
                            >
                                <option value="0">Camera 0 (Front)</option>
                                <option value="1">Camera 1 (Back)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>ICE Servers (JSON)</label>
                        <textarea
                            value={iceServers}
                            onChange={(e) => setIceServers(e.target.value)}
                            rows={6}
                            placeholder='[{"urls": "stun:stun.l.google.com:19302"}]'
                        />
                    </div>

                    <div className="form-group">
                        <label>DASH Stream (for testing DASH playback)</label>
                        <select
                            value={selectedDashOption}
                            onChange={(e) =>
                                setSelectedDashOption(e.target.value)
                            }
                            style={{ width: "100%", padding: "8px" }}
                        >
                            {dashUrls.map((item) => (
                                <option key={item.url} value={item.url}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                        {selectedDashOption === "custom" && (
                            <div style={{ marginTop: "10px" }}>
                                <input
                                    type="text"
                                    value={customDashUrl}
                                    onChange={(e) =>
                                        setCustomDashUrl(e.target.value)
                                    }
                                    placeholder="Enter custom DASH manifest URL"
                                    style={{ width: "100%" }}
                                />
                            </div>
                        )}
                        <small>
                            Select a test stream or choose "Custom URL" to enter
                            your own
                        </small>
                    </div>

                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={debugMode}
                                onChange={(e) => setDebugMode(e.target.checked)}
                            />
                            Enable Debug Logging (Check browser console for
                            detailed logs)
                        </label>
                    </div>

                    <div className="btn-group">
                        <button
                            onClick={connectSocketIo}
                            disabled={isConnected || pendingConnection}
                            className="btn btn-primary"
                        >
                            Connect WebRTC
                        </button>
                        <div
                            className="form-check"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                marginLeft: "15px",
                            }}
                        >
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id="autoPlayCheck"
                                checked={autoPlay}
                                onChange={(e) => setAutoPlay(e.target.checked)}
                                style={{ marginRight: "5px" }}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="autoPlayCheck"
                                style={{ marginBottom: 0 }}
                            >
                                Auto Play
                            </label>
                        </div>
                        <button
                            onClick={disconnect}
                            disabled={!isConnected && !pendingConnection}
                            className="btn btn-danger"
                        >
                            Disconnect
                        </button>
                        <button
                            onClick={switchCamera}
                            disabled={!isConnected || !isWebRTCMode}
                            className="btn btn-info"
                            title={`isConnected: ${isConnected}, isWebRTCMode: ${isWebRTCMode}`}
                        >
                            Switch Camera
                        </button>
                        {isConnected && !autoPlay && (
                            <button
                                onClick={() => {
                                    if (videoRef.current) {
                                        videoRef.current.play();
                                        showStatus("Playing video", "success");
                                    }
                                }}
                                className="btn btn-success"
                            >
                                Play Video
                            </button>
                        )}
                    </div>

                    <div className="btn-group">
                        <button
                            onClick={loadDefaults}
                            className="btn btn-secondary"
                        >
                            Load Defaults
                        </button>
                        <button
                            onClick={loadDebugDefaults}
                            className="btn btn-secondary"
                        >
                            Load Debug
                        </button>
                        <button
                            onClick={loadDashStream}
                            className="btn btn-success"
                        >
                            Load DASH Stream
                        </button>
                    </div>

                    {statusMessage && (
                        <div className={`status-message ${statusType}`}>
                            {statusMessage}
                        </div>
                    )}
                </div>

                <div className="video-container">
                    <video
                        ref={videoRef}
                        autoPlay={autoPlay}
                        playsInline
                        muted
                        controls
                    />
                </div>

                <div className="info-panel">
                    <h4>Usage Instructions:</h4>
                    <ul>
                        <li>
                            Enter your Socket.io server URL (e.g.,
                            wss://camera.geometris.com)
                        </li>
                        <li>Enter the device serial number and apiKey</li>
                        <li>Optionally configure ICE servers in JSON format</li>
                        <li>Click "Connect" to start the WebRTC stream</li>
                        <li>
                            Use "Switch Camera" to toggle between front and back
                            cameras
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default App;
