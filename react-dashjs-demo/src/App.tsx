import React, { useState, useRef, useEffect } from 'react';
import './App.css';

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
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [pendingConnection, setPendingConnection] = useState(false);
  
  // Form state
  const [socketUrl, setSocketUrl] = useState('wss://camera.geometris.com');
  const [serialNumber, setSerialNumber] = useState('100151819016');
  const [pin, setPin] = useState('94627');
  const [cameraIndex, setCameraIndex] = useState(0);
  const [debugMode, setDebugMode] = useState(true);
  const [dashUrl, setDashUrl] = useState('https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd');
  const [iceServers, setIceServers] = useState(JSON.stringify([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:camera.geometris.com:3478" },
    {
      urls: "turn:camera.geometris.com:3478",
      username: "devices",
      credential: "A82*ndcBX"
    }
  ], null, 2));

  useEffect(() => {
    // Wait for dashjs to be loaded
    const checkDashjs = setInterval(() => {
      if (window.dashjs) {
        console.log('dashjs library loaded and ready');
        clearInterval(checkDashjs);
      }
    }, 100);

    return () => {
      clearInterval(checkDashjs);
      if (playerRef.current) {
        try {
          playerRef.current.reset();
        } catch (e) {
          console.log('Error cleaning up player:', e);
        }
      }
    };
  }, []);

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log('State Update - isConnected:', isConnected, 'isWebRTCMode:', isWebRTCMode);
  }, [isConnected, isWebRTCMode]);

  const showStatus = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setStatusMessage(message);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
    }, 5000);
  };

  const connectSocketIo = () => {
    if (!socketUrl || !serialNumber || !pin) {
      showStatus('Please fill in all required fields', 'error');
      return;
    }

    // Make sure dashjs is loaded
    if (!window.dashjs) {
      showStatus('dashjs library not loaded yet. Please try again.', 'error');
      return;
    }

    if (isConnected) {
      disconnect();
    }

    let parsedIceServers;
    try {
      parsedIceServers = iceServers.trim() ? JSON.parse(iceServers) : [
        { urls: "stun:camera.geometris.com:3478" },
        {
          urls: "turn:camera.geometris.com:3478",
          username: "devices",
          credential: "A82*ndcBX"
        },
        { urls: "stun:stun.l.google.com:19302" }
      ];
    } catch (e) {
      showStatus('Invalid ICE servers JSON format', 'error');
      return;
    }

    if (!playerRef.current) {
      playerRef.current = window.dashjs.MediaPlayer().create();
    }

    console.log('Initializing WebRTC with settings:', {
      mode: 'socketio',
      socketUrl,
      serialNumber,
      pin: '***',
      cameraIndex,
      debug: debugMode
    });

    // Configure player for socket.io WebRTC
    playerRef.current.updateSettings({
      webRtc: {
        enabled: true,
        dashOnFail: false,
        mode: 'socketio',
        socketUrl,
        serialNumber,
        pin,
        cameraIndex,
        debug: debugMode,
        iceServers: parsedIceServers
      }
    });

    // Initialize player with dummy URL (not used in socket.io mode)
    if (videoRef.current) {
      playerRef.current.initialize(videoRef.current, 'socket.io', false);
    }

    setPendingConnection(true);
    setIsWebRTCMode(true);
    showStatus('Connecting to WebRTC server...', 'success');

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
          console.log('Connection state:', connectionState);
        }

        if (handler.isConnected()) {
          const video = videoRef.current;
          if (video && video.srcObject && (video.srcObject as MediaStream).active) {
            // Connection successful - clear interval first
            clearInterval(checkConnection);
            
            console.log('WebRTC Connection established! Setting states...');
            
            // Update all states together
            setPendingConnection(false);
            setIsConnected(true);
            setIsWebRTCMode(true);
            
            showStatus(`Connected to device ${serialNumber}`, 'success');
            
            // Start monitoring the connection
            startConnectionMonitoring();
            
            return; // Exit the interval
          } else {
            if (checkAttempts % 4 === 0) {
              console.log('WebRTC connected, waiting for video stream...');
            }
          }
        } else if (connectionState.state === 'failed' || connectionState.iceState === 'failed') {
          clearInterval(checkConnection);
          setPendingConnection(false);
          showStatus('Connection failed - check network and ICE servers', 'error');
          disconnect();
          return;
        } else if (connectionState.state === 'new' && connectionState.waitingForOffer && checkAttempts > 10) {
          if (checkAttempts % 4 === 0) {
            showStatus('Waiting for device response...', 'info');
          }
        }

        if (checkAttempts >= maxCheckAttempts) {
          clearInterval(checkConnection);
          setPendingConnection(false);
          showStatus('Connection timeout - device did not respond', 'error');
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
          const handler = playerRef.current.getWebRtcHandler && playerRef.current.getWebRtcHandler();
          if (handler) {
            const state = handler.getConnectionState();
            
            // Check if connection has failed or closed
            if (state.state === 'failed' || state.state === 'closed' || !handler.isConnected()) {
              console.log('Connection lost, cleaning up. State:', state);
              clearInterval(monitorInterval);
              
              // Update states
              setIsConnected(false);
              setIsWebRTCMode(false);
              showStatus('Connection lost', 'error');
              
              // Clean up the handler
              try {
                handler.destroy();
              } catch (e) {
                console.log('Error destroying handler:', e);
              }
            }
          }
        } catch (e) {
          console.log('Error monitoring connection:', e);
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
        const handler = playerRef.current.getWebRtcHandler && playerRef.current.getWebRtcHandler();
        if (handler && handler.destroy) {
          handler.destroy();
        }
      } catch (e) {
        console.log('No WebRTC handler to destroy');
      }
      
      try {
        // Reset the player
        playerRef.current.reset();
      } catch (e) {
        console.log('Error resetting player:', e);
      }
      
      setIsConnected(false);
      setIsWebRTCMode(false);
      showStatus('Disconnected', 'success');
    }
  };

  const switchCamera = () => {
    if (playerRef.current && isConnected) {
      const handler = playerRef.current.getWebRtcHandler();
      if (handler && handler.switchCamera) {
        handler.switchCamera();
        showStatus('Switching camera...', 'success');
      } else {
        showStatus('WebRTC handler not available', 'error');
      }
    } else {
      showStatus('Not connected', 'error');
    }
  };

  const loadDashStream = () => {
    if (!dashUrl) {
      showStatus('Please enter a DASH manifest URL', 'error');
      return;
    }

    // Make sure dashjs is loaded
    if (!window.dashjs) {
      showStatus('dashjs library not loaded yet. Please try again.', 'error');
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
        console.log('Error resetting player:', e);
      }
    }

    if (videoRef.current) {
      try {
        console.log('Creating new DASH player...');
        
        // Create a fresh player instance for DASH
        const newPlayer = window.dashjs.MediaPlayer().create();
        
        // Configure the player
        newPlayer.updateSettings({
          debug: {
            logLevel: debugMode ? 4 : 0
          },
          streaming: {
            abr: {
              autoSwitchBitrate: {
                video: true,
                audio: true
              }
            }
          }
        });

        console.log('Loading DASH stream:', dashUrl);
        showStatus('Loading DASH stream...', 'info');

        // Initialize with video element and URL
        newPlayer.initialize(videoRef.current, dashUrl, true);

        // Set up event listeners
        newPlayer.on(window.dashjs.MediaPlayer.events.PLAYBACK_STARTED, () => {
          showStatus('DASH stream playing', 'success');
          // Don't set isConnected for DASH - that's for WebRTC only
        });

        newPlayer.on(window.dashjs.MediaPlayer.events.ERROR, (e: any) => {
          console.error('DASH playback error:', e);
          if (e.error && e.error.message) {
            showStatus('DASH playback error: ' + e.error.message, 'error');
          } else {
            showStatus('DASH playback error', 'error');
          }
        });

        // Store the player reference
        playerRef.current = newPlayer;
        
        console.log('DASH player initialized successfully');
      } catch (e: any) {
        console.error('Failed to load DASH stream:', e);
        showStatus('Failed to load DASH stream: ' + e.message, 'error');
      }
    } else {
      showStatus('Video element not ready', 'error');
    }
  };

  const loadDefaults = () => {
    setSocketUrl('wss://camera.geometris.com');
    setSerialNumber('100151819016');
    setPin('94627');
    setIceServers(JSON.stringify([
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:camera.geometris.com:3478" },
      {
        urls: "turn:camera.geometris.com:3478",
        username: "devices",
        credential: "A82*ndcBX"
      }
    ], null, 2));
    setDashUrl('https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd');
  };

  const loadDebugDefaults = () => {
    setSocketUrl('http://localhost');
    setSerialNumber('100151819016');
    setPin('24816');
    setIceServers(JSON.stringify([
      { urls: "stun:stun.l.google.com:19302" }
    ], null, 2));
  };

  const loadSampleDashUrls = () => {
    const sampleUrls = [
      'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
      'https://livesim.dashif.org/livesim/testpic_2s/Manifest.mpd',
      'https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd',
      'https://rdmedia.bbc.co.uk/dash/ondemand/bbb/2/client_manifest-common_init.mpd'
    ];

    const currentIndex = sampleUrls.indexOf(dashUrl);
    const nextIndex = (currentIndex + 1) % sampleUrls.length;
    setDashUrl(sampleUrls[nextIndex]);
    showStatus(`Sample URL loaded: ${nextIndex + 1} of ${sampleUrls.length}`, 'info');
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h2>dashjs WebRTC Socket.io Player</h2>
          <span className={`connection-indicator ${isConnected ? 'connected' : ''}`}></span>
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
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="100150660001"
              />
            </div>

            <div className="form-group">
              <label>PIN</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="94627"
              />
            </div>

            <div className="form-group">
              <label>Camera Index</label>
              <select value={cameraIndex} onChange={(e) => setCameraIndex(Number(e.target.value))}>
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
            <label>DASH Stream URL (for testing DASH playback)</label>
            <input
              type="text"
              value={dashUrl}
              onChange={(e) => setDashUrl(e.target.value)}
              placeholder="https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"
            />
            <small>Enter a DASH manifest URL to test traditional DASH streaming</small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
              Enable Debug Logging (Check browser console for detailed logs)
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
          </div>

          <div className="btn-group">
            <button onClick={loadDefaults} className="btn btn-secondary">
              Load Defaults
            </button>
            <button onClick={loadDebugDefaults} className="btn btn-secondary">
              Load Debug
            </button>
            <button onClick={loadSampleDashUrls} className="btn btn-secondary">
              Sample DASH URLs
            </button>
            <button onClick={loadDashStream} className="btn btn-success">
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
            autoPlay 
            playsInline 
            muted 
            controls
          />
        </div>

        <div className="info-panel">
          <h4>Usage Instructions:</h4>
          <ul>
            <li>Enter your Socket.io server URL (e.g., wss://camera.geometris.com)</li>
            <li>Enter the device serial number and PIN</li>
            <li>Optionally configure ICE servers in JSON format</li>
            <li>Click "Connect" to start the WebRTC stream</li>
            <li>Use "Switch Camera" to toggle between front and back cameras</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App;