declare module 'dashjs' {
    export interface MediaPlayerClass {
        initialize(view: HTMLVideoElement, source: string, autoPlay: boolean): void;
        attachSource(source: string): void;
        destroy(): void;
        on(event: string, handler: Function): void;
        off(event: string, handler: Function): void;
        updateSettings(settings: any): void;
    }

    export interface MediaPlayerErrorEvent {
        error: {
            code: string;
            message: string;
        };
    }

    export interface ErrorEvent {
        error?: any;
    }

    export interface MediaPlayer {
        (): MediaPlayerStatic;
        events: {
            ERROR: string;
            [key: string]: string;
        };
        errors: {
            DOWNLOAD_ERROR_ID_MANIFEST_CODE: string;
            [key: string]: string;
        };
    }

    export interface MediaPlayerStatic {
        create(): MediaPlayerClass;
    }

    const MediaPlayer: MediaPlayer;
    export { MediaPlayer };
}

// The dashjs-webrtc-socketio package likely has the same API as dashjs
declare module 'dashjs-webrtc-socketio' {
    export * from 'dashjs';
}