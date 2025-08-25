import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Tele from "../Telematics-bundle-components/TeleIndex";
import { LoadingContainer } from "../mocks/hcss-components";
import { GenericService } from "../GenericService";
import * as DashJS from "dashjs-webrtc-socketio";

declare var HCSS: any;

declare global {
    interface Window {
        streamingMode?: "dash" | "webrtc";
    }
}

interface IWebRtcConfig {
    enabled: boolean;
    dashOnFail?: boolean;
    mode?: "socketio" | "whpp";
    socketUrl?: string;
    serialNumber?: string;
    apiKey?: string;
    cameraIndex?: number;
    debug?: boolean;
    iceServers?: Array<{
        urls: string;
        username?: string;
        credential?: string;
    }>;
}

interface IDashcamLiveFeedInfoModel {
    GpsSerial: string;
    CameraId: string;
    LiveFeedUrl: string;
}

interface IDashcamLiveFeedModalProps {
    gpsSerial: string;
    equipmentCode: string;
    streamingMode?: "dash" | "webrtc";
    webRtcConfig?: IWebRtcConfig;
}

interface IDashcamLiveFeedProps {
    selectedCamera: IDashcamLiveFeedInfoModel;
    handleOnStreamUrlExpiration: () => void;
    streamingMode?: "dash" | "webrtc";
    webRtcConfig?: IWebRtcConfig;
}

class DashcamLiveFeed extends React.Component<IDashcamLiveFeedProps> {
    constructor(props) {
        super(props);
        this.isInitialStream = true;
    }

    // Get streaming mode from props or window fallback
    getStreamingMode = (): "dash" | "webrtc" => {
        return this.props.streamingMode || window.streamingMode || "dash";
    };

    dashJsMediaPlayer: DashJS.MediaPlayerClass | null = null;
    videoRef?: HTMLVideoElement;
    isInitialStream: boolean;

    handleOnCloseStream = () => {
        if (this.dashJsMediaPlayer) {
            const streamingMode = this.getStreamingMode();
            
            // For WebRTC mode, ensure we properly close the connection
            if (streamingMode === "webrtc") {
                try {
                    // Get the WebRTC handler and destroy it if it exists
                    const handler = (this.dashJsMediaPlayer as any).getWebRtcHandler?.();
                    if (handler) {
                        console.log("Destroying WebRTC handler and closing connection");
                        handler.destroy();
                    }
                } catch (error) {
                    console.error("Error destroying WebRTC handler:", error);
                }
            }
            
            // Destroy the media player completely
            this.dashJsMediaPlayer.destroy(); //Completely destroys the media player and frees all memory
            this.dashJsMediaPlayer = null;
        }
        
        // Clear video reference
        this.videoRef = null;
    };

    handleOnErrorEvent = (e: DashJS.ErrorEvent) => {
        var event = e as DashJS.MediaPlayerErrorEvent;
        if (
            event.error.code ===
            DashJS.MediaPlayer.errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE
        ) {
            this.props.handleOnStreamUrlExpiration();
        }
    };

    initializeMediaPlayer = () => {
        if (!this.videoRef) {
            console.error("Video element not ready");
            return;
        }

        //for debugging
        //this.dashJsMediaPlayer.updateSettings({ debug : {logLevel: 5}});

        // create the dash media player here instead of the constructor for recreating it in case of mode change
        if (!this.dashJsMediaPlayer) {
            this.dashJsMediaPlayer = DashJS.MediaPlayer().create();
        }

        // Check if we're in WebRTC mode
        const streamingMode = this.getStreamingMode();

        //create listener for when stream URL has expired (DASH mode)
        if (streamingMode === "dash") {
            this.dashJsMediaPlayer.on(
                DashJS.MediaPlayer.events.ERROR,
                this.handleOnErrorEvent
            );

            console.log("Using standard DASH mode");
        } else {
            if (streamingMode === "webrtc") {
                console.log("Configuring player for WebRTC mode");

                // Use WebRTC config from props, with defaults as fallback
                const webRtcConfig = this.props.webRtcConfig || {
                    enabled: true,
                    dashOnFail: false,
                    mode: "socketio",
                    socketUrl: "wss://camera.geometris.com",
                    serialNumber: "100151819016",
                    apiKey: "ne83247hdhiwe384jdh",
                    cameraIndex: parseInt(this.props.selectedCamera.CameraId) || 0,
                    debug: true,
                    iceServers: [
                        { urls: "stun:camera.geometris.com:3478" },
                        {
                            urls: "turn:camera.geometris.com:3478",
                            username: "devices",
                            credential: "A82*ndcBX",
                        },
                    ],
                };

                // Merge camera index from selected camera if not explicitly set in config
                const finalWebRtcConfig = {
                    ...webRtcConfig,
                    cameraIndex: webRtcConfig.cameraIndex !== undefined 
                        ? webRtcConfig.cameraIndex 
                        : parseInt(this.props.selectedCamera.CameraId) || 0,
                };

                // Configure WebRTC settings
                this.dashJsMediaPlayer.updateSettings({
                    webRtc: finalWebRtcConfig,
                    streaming: {
                        delay: {
                            liveDelay: 4,
                        },
                        buffer: {
                            fastSwitchEnabled: true,
                        },
                    },
                    debug: { logLevel: streamingMode === "webrtc" ? 3 : 0 },
                });
            }
        }

        //initialize the media player
        //initialize should only be called ONCE
        if (streamingMode === "dash") {
            // For DASH, initialize the media player with the current live feed URL
            this.dashJsMediaPlayer.initialize(
                this.videoRef,
                this.props.selectedCamera.LiveFeedUrl,
                true
            );
        } else if (streamingMode === "webrtc") {
            // For WebRTC, we need a different initialization approach
            const socketUrl = this.props.webRtcConfig?.socketUrl || "wss://camera.geometris.com";
            
            // Ensure video element is properly set before initialization
            try {
                // Set up error handling
                this.dashJsMediaPlayer.on(
                    DashJS.MediaPlayer.events.ERROR,
                    (e: DashJS.ErrorEvent) => {
                        console.error("WebRTC Player Error:", e);
                    }
                );
                
                // Initialize with video element - let dash.js handle the timing
                this.dashJsMediaPlayer.initialize(
                    this.videoRef,
                    socketUrl, // Pass the socketUrl for WebRTC mode
                    true // Auto play when ready
                );
            } catch (error) {
                console.error("Failed to initialize WebRTC player:", error);
            }
        }

        this.isInitialStream = false;
    };

    componentDidMount() {
        // Don't initialize here - wait for the ref callback in render
        // This prevents race conditions with the video element
    }

    componentWillUnmount() {
        console.log("DashcamLiveFeed component unmounting, closing stream");
        this.handleOnCloseStream();
    }

    componentDidUpdate(prevProps: Readonly<IDashcamLiveFeedProps>): void {
        // Don't initialize here if it's the initial stream - that's handled in the ref callback
        // This prevents duplicate initialization

        const streamingMode = this.getStreamingMode();
        if (streamingMode === "dash") {
            // For DASH, check if URL changed
            if (
                prevProps.selectedCamera.LiveFeedUrl !==
                this.props.selectedCamera.LiveFeedUrl
            ) {
                this.dashJsMediaPlayer.attachSource(
                    this.props.selectedCamera.LiveFeedUrl
                ); //resets the player and sets a new source URL
            }
        } else if (streamingMode === "webrtc") {
            // Handle camera switching
            if (
                prevProps.selectedCamera.CameraId !==
                    this.props.selectedCamera.CameraId &&
                !this.isInitialStream &&
                this.dashJsMediaPlayer
            ) {
                if (streamingMode === "webrtc") {
                    // For WebRTC, use the WebRTC handler's switchCamera method
                    console.log(
                        "Switching WebRTC camera to index:",
                        this.props.selectedCamera.CameraId
                    );

                    try {
                        // Get the WebRTC handler from the player
                        const handler =
                            (this.dashJsMediaPlayer as any).getWebRtcHandler &&
                            (this.dashJsMediaPlayer as any).getWebRtcHandler();

                        if (handler && handler.switchCamera) {
                            // Use the switchCamera method if available
                            handler.switchCamera();
                            console.log("Camera switched using WebRTC handler");
                        } else {
                            // Fallback to updating settings if handler not available
                            console.log(
                                "WebRTC handler not available, updating settings instead"
                            );
                            this.dashJsMediaPlayer.updateSettings({
                                webRtc: {
                                    cameraIndex:
                                        parseInt(
                                            this.props.selectedCamera.CameraId
                                        ) || 0,
                                },
                            });
                        }
                    } catch (e) {
                        console.error("Error switching camera:", e);
                        // Fallback to updating settings
                        this.dashJsMediaPlayer.updateSettings({
                            webRtc: {
                                cameraIndex:
                                    parseInt(
                                        this.props.selectedCamera.CameraId
                                    ) || 0,
                            },
                        });
                    }
                }
            }
        }
    }

    render() {
        return (
            <div style={{ position: "relative", textAlign: "center" }}>
                <video
                    ref={(videoRef) => {
                        if (videoRef && !this.videoRef) {
                            // Store the video reference
                            this.videoRef = videoRef as HTMLVideoElement;

                            // Initialize player only once when video element is first available
                            if (this.isInitialStream) {
                                // Use a longer timeout to ensure the DOM is fully ready
                                // Increased timeout for WebRTC mode
                                const initDelay = this.getStreamingMode() === "webrtc" ? 500 : 200;
                                setTimeout(() => {
                                    if (this.videoRef) {
                                        console.log(
                                            `Video element ready, initializing ${this.getStreamingMode()} player`
                                        );
                                        this.initializeMediaPlayer();
                                    }
                                }, initDelay);
                            }
                        }
                    }}
                    id={this.props.selectedCamera.CameraId}
                    width="100%"
                    controls
                    autoPlay
                    muted
                    playsInline
                >
                    Your browser does not support 'video' tag.
                </video>
            </div>
        );
    }
}

const DashcamLiveFeedModal = (props: IDashcamLiveFeedModalProps) => {
    const { gpsSerial, equipmentCode, streamingMode, webRtcConfig } = props;

    const [isOpen, setIsOpen] = React.useState(true);
    const [isLoading, setIsLoading] = React.useState(true);
    const [liveFeedInfos, setLiveFeedInfos] = React.useState<
        IDashcamLiveFeedInfoModel[]
    >([]);
    const [isValidStreamUrl, setIsValidStreamUrl] = React.useState(true);
    const [isCompatibleOS, setIsCompatibleOS] = React.useState(true);
    const [selectedCamera, setSelectedCamera] =
        React.useState<IDashcamLiveFeedInfoModel>();
    const [errorText, setErrorText] = React.useState<string>();

    React.useEffect(() => {
        const browserInfo = getBrowserInfo();

        if (
            browserInfo.os.toLowerCase().includes("mac") ||
            browserInfo.os.toLowerCase().includes("iphone")
        ) {
            setIsCompatibleOS(false);
        } else {
            getLiveFeedInfos();
        }
    }, []);

    const getLiveFeedInfos = () => {
        const url =
            !!location && !!location.origin
                ? `${location.origin}/api/v1/Dashcams/${gpsSerial}/LiveFeedInfos`
                : `api/v1/Dashcams/${gpsSerial}/LiveFeedInfos`;
        GenericService.get(url, "GET", {})
            .then((response: IDashcamLiveFeedInfoModel[]) => {
                if (!!!response || response.length == 0) {
                    setErrorText("Error retrieving Livestream");
                }

                if (selectedCamera !== undefined) {
                    let updatedSelectedCamera = response.find(
                        (x) => x.CameraId === selectedCamera.CameraId
                    );
                    setSelectedCamera(updatedSelectedCamera);
                } else {
                    setSelectedCamera(response[0]); //default selected camera to the first in the list
                }
                setLiveFeedInfos(response);
            })
            .fail((err: any) => {
                if (!!err.responseJSON) {
                    setErrorText(err.responseJSON);
                } else if (!!err.responseText) {
                    setErrorText(err.responseText);
                } else {
                    setErrorText("No camera found");
                }
            })
            .always(() => {
                setIsValidStreamUrl(true);
                setIsLoading(false);
            });
    };

    const getBrowserInfo = () => {
        var ua = navigator.userAgent,
            tem,
            M =
                ua.match(
                    /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
                ) || [];
        var NameBrowser: any = undefined;
        var VersionBrowser: any = undefined;

        if (/trident/i.test(M[1])) {
            tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
            NameBrowser = "IE";
            VersionBrowser = tem[1] || "";
        }

        if (M[1] === "Chrome") {
            tem = ua.match(/\bOPR|Edge\/(\d+)/);

            if (tem == null) {
                //Chrome
                NameBrowser = M[1];
                VersionBrowser = M[2];
            } else {
                if (tem[0].indexOf("Edge") > -1) {
                    //Edge
                    NameBrowser = "Edge";
                    VersionBrowser = tem[1];
                } else {
                    // if(tem != null)
                    NameBrowser = tem[0];

                    if (tem[1] != undefined) VersionBrowser = tem[1];
                    else {
                        if (NameBrowser == "OPR")
                            //Opera
                            VersionBrowser = tem.input.substring(
                                tem.input.indexOf("OPR/") + 4
                            );
                    } //else
                } //else
            } //else
        } //if(M[1]==='Chrome')
        else {
            //Firefox
            M = M[2]
                ? [M[1], M[2]]
                : [navigator.appName, navigator.appVersion, "-?"];
            if ((tem = ua.match(/version\/(\d+)/i)) != null) {
                M.splice(1, 1, tem[1]);
            }
            NameBrowser = M[0];
            VersionBrowser = M[1];
        }

        // Look for OS-Name
        var firstBracket = ua.indexOf("(");
        var secondBracket = ua.indexOf(")");
        var NameOS = ua.substring(firstBracket + 1, secondBracket);
        var isDesktop = false;
        ["linux", "windows", "mac"].forEach(function (os) {
            if (NameOS.toLowerCase().includes(os.toLowerCase())) {
                isDesktop = true;
            }
        });
        ["android", "iphone"].forEach(function (os) {
            if (NameOS.toLowerCase().includes(os.toLowerCase())) {
                isDesktop = false;
            }
        });
        //MyPrint("getBrowserInfo() name is '" + NameBrowser + "', version is '" + VersionBrowser + "', os is '" + NameOS + "'");
        return {
            name: NameBrowser,
            version: VersionBrowser,
            os: NameOS,
            isDesktop: isDesktop,
        };
    };

    const handleGetNewStreamUrls = () => {
        console.log("Getting new stream URLs, resetting player");
        setIsLoading(true);
        // Force remount of DashcamLiveFeed component to ensure clean state
        setSelectedCamera(undefined);
        setTimeout(() => {
            getLiveFeedInfos();
        }, 100);
    };

    const handleOnStreamUrlExpiration = () => {
        setIsValidStreamUrl(false);
        //handleGetNewStreamUrls(); //comment out the above line and add this line if we want to skip asking to continue
    };

    const handleOnCameraSelected = (feed: IDashcamLiveFeedInfoModel) => {
        setSelectedCamera(feed);
    };

    const handleOnClose = () => {
        console.log("Modal closing, cleaning up resources");
        //in the future if we need to call the stop live stream session endpoint do it here
        setIsOpen(false);
        // The DashcamLiveFeed component will handle cleanup in its componentWillUnmount
    };

    if (isCompatibleOS) {
        return (
            <Tele.Modal.InfoModal
                id="dashcam-livefeed-modal"
                title={`${equipmentCode}: Live Feed`}
                backdrop="static"
                toShow={isOpen}
                onClose={handleOnClose}
            >
                <div className="row">
                    <div className="col-xs-12">
                        <LoadingContainer isLoading={isLoading} size={2}>
                            <div className="row" style={{ minHeight: "50px" }}>
                                {isValidStreamUrl ? (
                                    <div className="col-xs-12">
                                        {!isLoading &&
                                            liveFeedInfos.length === 0 && (
                                                <h3 className="text-center text-muted">
                                                    {errorText}
                                                </h3>
                                            )}
                                        {liveFeedInfos.length > 0 &&
                                            !!selectedCamera && (
                                                <div
                                                    key={`div-feed-${gpsSerial}`}
                                                >
                                                    <DashcamLiveFeed
                                                        key={`feed-${gpsSerial}`}
                                                        selectedCamera={
                                                            selectedCamera
                                                        }
                                                        handleOnStreamUrlExpiration={() =>
                                                            handleOnStreamUrlExpiration()
                                                        }
                                                        streamingMode={streamingMode}
                                                        webRtcConfig={webRtcConfig}
                                                    />
                                                </div>
                                            )}
                                        {liveFeedInfos.length > 0 && (
                                            <ul
                                                className="nav nav-pills"
                                                style={{
                                                    marginTop: "5px",
                                                    marginLeft: "0px",
                                                }}
                                            >
                                                {liveFeedInfos.map((feed) => (
                                                    <li
                                                        key={`button-${feed.CameraId}`}
                                                        className={
                                                            feed.CameraId ===
                                                            selectedCamera?.CameraId
                                                                ? "active"
                                                                : ""
                                                        }
                                                        onClick={() =>
                                                            handleOnCameraSelected(
                                                                feed
                                                            )
                                                        }
                                                    >
                                                        <a>
                                                            {feed.CameraId ===
                                                            "0"
                                                                ? "Front Facing"
                                                                : "Rear Facing"}{" "}
                                                            Camera
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className="col-xs-12"
                                        style={{ textAlign: "center" }}
                                    >
                                        <h3>
                                            Continue live feed?{" "}
                                            <a
                                                onClick={() =>
                                                    handleGetNewStreamUrls()
                                                }
                                            >
                                                Yes
                                            </a>
                                        </h3>
                                    </div>
                                )}
                            </div>
                        </LoadingContainer>
                    </div>
                </div>
            </Tele.Modal.InfoModal>
        );
    } else {
        return (
            <Tele.Modal.InfoModal
                id="dashcam-livefeed-modal"
                title={`${equipmentCode}: Live Feed`}
                backdrop="static"
                toShow={isOpen}
                onClose={handleOnClose}
            >
                <div className="row">
                    <div className="col-xs-12" style={{ textAlign: "center" }}>
                        <h4>
                            Your operating system is not compatible with
                            MPEG-DASH video streams.
                        </h4>
                    </div>
                </div>
            </Tele.Modal.InfoModal>
        );
    }
};

class DashcamLiveFeedModalController extends React.Component<IDashcamLiveFeedModalProps> {
    render() {
        return (
            <DashcamLiveFeedModal
                gpsSerial={this.props.gpsSerial}
                equipmentCode={this.props.equipmentCode}
                streamingMode={this.props.streamingMode}
                webRtcConfig={this.props.webRtcConfig}
            />
        );
    }
}

let controller: any;
let container: any;

export function init(
    gpsSerial: string, 
    equipmentCode: string, 
    element: any,
    streamingMode?: "dash" | "webrtc",
    webRtcConfig?: IWebRtcConfig
) {
    if (controller) {
        console.log("Unmounting existing controller");
        ReactDOM.unmountComponentAtNode(container);
        // Small delay to ensure cleanup completes
        setTimeout(() => {
            container = element;
            controller = ReactDOM.render(
                <DashcamLiveFeedModalController
                    gpsSerial={gpsSerial}
                    equipmentCode={equipmentCode}
                    streamingMode={streamingMode}
                    webRtcConfig={webRtcConfig}
                />,
                element
            );
        }, 100);
    } else {
        container = element;
        controller = ReactDOM.render(
            <DashcamLiveFeedModalController
                gpsSerial={gpsSerial}
                equipmentCode={equipmentCode}
                streamingMode={streamingMode}
                webRtcConfig={webRtcConfig}
            />,
            element
        );
    }
}

// Export the config interface for external use
export type { IWebRtcConfig };
