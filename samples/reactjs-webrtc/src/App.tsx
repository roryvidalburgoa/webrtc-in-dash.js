import * as React from "react";
import { init, IWebRtcConfig } from "./components/DashcamLiveFeedModal";

declare global {
    var HCSS: any;
    interface Window {
        streamingMode?: "dash" | "webrtc";
    }
}

window.HCSS = {};

const App: React.FC = () => {
    const [showModal, setShowModal] = React.useState(false);
    const [useWebRTC, setUseWebRTC] = React.useState(false);
    const modalContainerRef = React.useRef<HTMLDivElement>(null);

    const handleShowModal = () => {
        // Set the streaming mode globally so the modal can access it
        window.streamingMode = useWebRTC ? "webrtc" : "dash";

        setShowModal(true);
        setTimeout(() => {
            if (modalContainerRef.current) {
                // get serial number from the query string
                const urlParams = new URLSearchParams(window.location.search);
                const apiKey = atob(urlParams.get("apiKey"));
                console.log("APIKey=====>>>", apiKey);
                const serialNumber = urlParams.get("serialNumber");

                const webrtcConfig: IWebRtcConfig | undefined = useWebRTC
                    ? {
                          enabled: true,
                          dashOnFail: false,
                          mode: "socketio",
                          socketUrl: "wss://camera.geometris.com",
                          serialNumber: serialNumber || "100151819016",
                          apiKey: apiKey,
                          cameraIndex: 0,
                          debug: true,
                          iceServers: [
                              { urls: "stun:camera.geometris.com:3478" },
                              {
                                  urls: "turn:camera.geometris.com:3478",
                                  username: "devices",
                                  credential: "A82*ndcBX",
                              },
                          ],
                      }
                    : undefined;
                init(
                    "GPS123456",
                    "Equipment-001",
                    modalContainerRef.current,
                    window.streamingMode,
                    webrtcConfig
                );
            }
        }, 100);
    };

    const handleResetModal = () => {
        setShowModal(false);
    };

    const handleStreamingModeChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setUseWebRTC(e.target.checked);
    };

    return (
        <div className="container" style={{ marginTop: "50px" }}>
            <div className="row">
                <div className="col-md-12">
                    <h1 className="text-center">
                        Dashcam Live Feed Modal Demo
                    </h1>
                    <hr />
                </div>
            </div>

            <div className="row">
                <div className="col-md-12">
                    <div className="panel panel-default">
                        <div className="panel-heading">
                            <h3 className="panel-title">Demo Controls</h3>
                        </div>
                        <div className="panel-body">
                            <p>
                                This demo shows how to use the
                                DashcamLiveFeedModal component with both
                                MPEG-DASH and WebRTC streaming.
                            </p>

                            <div
                                className="well"
                                style={{
                                    backgroundColor: "#f5f5f5",
                                    padding: "15px",
                                    marginBottom: "20px",
                                }}
                            >
                                <h4>Streaming Mode Selection</h4>
                                <div className="form-group">
                                    <label
                                        className="checkbox-inline"
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={useWebRTC}
                                            onChange={handleStreamingModeChange}
                                            disabled={showModal}
                                            style={{
                                                marginRight: "10px",
                                                transform: "scale(1.5)",
                                            }}
                                        />
                                        Use WebRTC with Socket.IO
                                    </label>
                                    <div
                                        style={{
                                            marginTop: "10px",
                                            marginLeft: "25px",
                                        }}
                                    >
                                        <strong>Current Mode: </strong>
                                        <span
                                            className={`label ${
                                                useWebRTC
                                                    ? "label-success"
                                                    : "label-primary"
                                            }`}
                                            style={{ fontSize: "14px" }}
                                        >
                                            {useWebRTC ? "WebRTC" : "MPEG-DASH"}
                                        </span>
                                    </div>
                                </div>

                                {useWebRTC ? (
                                    <div
                                        className="alert alert-success"
                                        style={{ marginTop: "15px" }}
                                    >
                                        <strong>WebRTC Mode:</strong> Will
                                        connect to camera.geometris.com using
                                        WebRTC with Socket.IO
                                        <ul
                                            style={{
                                                marginTop: "10px",
                                                marginBottom: "0",
                                            }}
                                        >
                                            <li>
                                                Server:
                                                wss://camera.geometris.com
                                            </li>
                                            <li>Serial: 100151819016</li>
                                            <li>APIKey: ***************</li>
                                            <li>
                                                STUN/TURN servers configured
                                            </li>
                                        </ul>
                                    </div>
                                ) : (
                                    <div
                                        className="alert alert-info"
                                        style={{ marginTop: "15px" }}
                                    >
                                        <strong>DASH Mode:</strong> Will use
                                        sample MPEG-DASH streams from Akamai
                                        test servers
                                    </div>
                                )}
                            </div>

                            <p>The component will:</p>
                            <ul>
                                <li>
                                    Check browser compatibility (Mac/iPhone
                                    devices are not supported)
                                </li>
                                <li>
                                    {useWebRTC
                                        ? "Connect to WebRTC server via Socket.IO"
                                        : "Load live camera feeds using MPEG-DASH streaming"}
                                </li>
                                <li>
                                    Allow switching between front and rear
                                    cameras
                                </li>
                                <li>
                                    {useWebRTC
                                        ? "Handle WebRTC connection and ICE negotiation"
                                        : "Handle stream URL expiration and renewal"}
                                </li>
                            </ul>

                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleShowModal}
                                disabled={showModal}
                            >
                                {showModal
                                    ? "Modal is Active"
                                    : "Open Dashcam Live Feed Modal"}
                            </button>

                            {showModal && (
                                <button
                                    className="btn btn-warning btn-lg"
                                    style={{ marginLeft: "10px" }}
                                    onClick={handleResetModal}
                                >
                                    Reset Modal
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-md-12">
                    <div className="panel panel-info">
                        <div className="panel-heading">
                            <h3 className="panel-title">Component Props</h3>
                        </div>
                        <div className="panel-body">
                            <h4>DashcamLiveFeedModal Props:</h4>
                            <table className="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Prop</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th>Example Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <code>gpsSerial</code>
                                        </td>
                                        <td>string</td>
                                        <td>GPS device serial number</td>
                                        <td>GPS123456</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <code>equipmentCode</code>
                                        </td>
                                        <td>string</td>
                                        <td>Equipment identifier</td>
                                        <td>Equipment-001</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <code>streamingMode</code>
                                        </td>
                                        <td>'dash' | 'webrtc'</td>
                                        <td>Streaming protocol to use</td>
                                        <td>{useWebRTC ? "webrtc" : "dash"}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <div ref={modalContainerRef} id="modal-container"></div>
            )}

            <div className="row" style={{ marginTop: "30px" }}>
                <div className="col-md-12">
                    <div className="panel panel-default">
                        <div className="panel-body text-center">
                            <h4>Source Code</h4>
                            <p>
                                <a
                                    href="https://github.com/roryvidalburgoa/webrtc-in-dash.js/tree/webrtc-socketio/samples/reactjs-webrtc"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-link"
                                    style={{ fontSize: "16px" }}
                                >
                                    <i className="glyphicon glyphicon-link"></i>{" "}
                                    View on GitHub
                                </a>
                            </p>
                            <p className="text-muted">
                                https://github.com/roryvidalburgoa/webrtc-in-dash.js/tree/webrtc-socketio/samples/reactjs-webrtc
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
