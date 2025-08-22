import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Tele from "../Telematics-bundle-components/TeleIndex";
import { LoadingContainer, notify } from "hcss-components";
import { GenericService } from "../GenericService";
import * as DashJS from "dashjs";

declare var HCSS: any;

interface IDashcamLiveFeedInfoModel {
    GpsSerial: string;
    CameraId: string;
    LiveFeedUrl: string;
}

interface IDashcamLiveFeedModalProps {
    gpsSerial: string;
    equipmentCode: string;
}

interface IDashcamLiveFeedProps {
    selectedCamera: IDashcamLiveFeedInfoModel;
    handleOnStreamUrlExpiration: () => void;
}

class DashcamLiveFeed extends React.Component<IDashcamLiveFeedProps> {
    constructor(props) {
        super(props);

        this.dashJsMediaPlayer = DashJS.MediaPlayer().create();
        this.isInitialStream = true;
    }

    dashJsMediaPlayer: DashJS.MediaPlayerClass;
    videoRef?: HTMLVideoElement;
    isInitialStream: boolean;

    handleOnCloseStream = () => {
        this.dashJsMediaPlayer.destroy(); //Completely destroys the media player and frees all memory
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
        //for debugging
        //this.dashJsMediaPlayer.updateSettings({ debug : {logLevel: 5}});

        //create listener for when stream URL has expired
        this.dashJsMediaPlayer.on(
            DashJS.MediaPlayer.events.ERROR,
            this.handleOnErrorEvent
        );

        //initialize the media player with the current live feed URL
        //initialize should only be called ONCE
        this.dashJsMediaPlayer.initialize(
            this.videoRef,
            this.props.selectedCamera.LiveFeedUrl,
            true
        );
        this.isInitialStream = false;
    };

    componentWillUnmount() {
        this.handleOnCloseStream();
    }

    componentDidUpdate(prevProps: Readonly<IDashcamLiveFeedProps>): void {
        if (this.isInitialStream) {
            this.initializeMediaPlayer();
        }

        if (
            prevProps.selectedCamera.LiveFeedUrl !==
                this.props.selectedCamera.LiveFeedUrl &&
            !this.isInitialStream
        ) {
            this.dashJsMediaPlayer.attachSource(
                this.props.selectedCamera.LiveFeedUrl
            ); //resets the player and sets a new source URL
        }
    }

    render() {
        return (
            <div style={{ position: "relative", textAlign: "center" }}>
                <video
                    ref={(videoRef) =>
                        (this.videoRef = videoRef as HTMLVideoElement)
                    }
                    id={this.props.selectedCamera.CameraId}
                    width="100%"
                    controls
                    autoPlay
                >
                    Your browser does not support 'video' tag.
                </video>
            </div>
        );
    }
}

const DashcamLiveFeedModal = (props: IDashcamLiveFeedModalProps) => {
    const { gpsSerial, equipmentCode } = props;

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
        setIsLoading(true);
        getLiveFeedInfos();
    };

    const handleOnStreamUrlExpiration = () => {
        setIsValidStreamUrl(false);
        //handleGetNewStreamUrls(); //comment out the above line and add this line if we want to skip asking to continue
    };

    const handleOnCameraSelected = (feed: IDashcamLiveFeedInfoModel) => {
        setSelectedCamera(feed);
    };

    const handleOnClose = () => {
        //in the future if we need to call the stop live stream session endpoint do it here
        setIsOpen(false);
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
            />
        );
    }
}

let controller: any;
let container: any;
export function init(gpsSerial: string, equipmentCode: string, element: any) {
    if (controller) {
        ReactDOM.unmountComponentAtNode(container);
    }

    container = element;
    controller = ReactDOM.render(
        <DashcamLiveFeedModalController
            gpsSerial={gpsSerial}
            equipmentCode={equipmentCode}
        />,
        element
    );
}
