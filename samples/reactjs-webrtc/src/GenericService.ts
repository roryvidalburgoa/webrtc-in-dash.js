interface IDashcamLiveFeedInfoModel {
    GpsSerial: string;
    CameraId: string;
    LiveFeedUrl: string;
}

const mockLiveFeedData: IDashcamLiveFeedInfoModel[] = [
    {
        GpsSerial: "GPS123456",
        CameraId: "0",
        LiveFeedUrl: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd"
    },
    {
        GpsSerial: "GPS123456",
        CameraId: "1",
        LiveFeedUrl: "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd"
    }
];

export class GenericService {
    static get(url: string, method: string, params: any): JQuery.jqXHR<any> {
        console.log(`GenericService.get called with URL: ${url}`);
        
        const deferred = $.Deferred<IDashcamLiveFeedInfoModel[]>();
        
        setTimeout(() => {
            if (url.includes('/api/v1/Dashcams/') && url.includes('/LiveFeedInfos')) {
                // Check if we're in WebRTC mode
                const streamingMode = (window as any).streamingMode || 'dash';
                
                if (streamingMode === 'webrtc') {
                    // For WebRTC, we don't need actual URLs, just camera identifiers
                    const webRtcData: IDashcamLiveFeedInfoModel[] = [
                        {
                            GpsSerial: "GPS123456",
                            CameraId: "0",
                            LiveFeedUrl: "webrtc://camera0" // Placeholder URL for WebRTC
                        },
                        {
                            GpsSerial: "GPS123456",
                            CameraId: "1",
                            LiveFeedUrl: "webrtc://camera1" // Placeholder URL for WebRTC
                        }
                    ];
                    console.log('Returning WebRTC camera data');
                    deferred.resolve(webRtcData);
                } else {
                    console.log('Returning DASH stream URLs');
                    deferred.resolve(mockLiveFeedData);
                }
            } else {
                deferred.reject({
                    responseJSON: "Mock error: Endpoint not found",
                    responseText: "Mock error: Endpoint not found"
                });
            }
        }, 500);
        
        return deferred as any;
    }
}