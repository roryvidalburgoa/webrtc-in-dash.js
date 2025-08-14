# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of dash.js that extends it with WebRTC streaming capabilities. The project implements the DASH Industry Forum reference player with additional support for WebRTC playback through the WHPP (WebRTC HTTP Playback Protocol).

## Commands

### Development
- `npm install` - Install dependencies
- `npm run start` - Start webpack dev server with hot reload (http://localhost:3000)
- `npm run dev` - Build and watch distribution files in development mode
- `npm run build` - Build production distribution files to dist/

### Testing
- `npm run test` - Run unit tests with Mocha
- `npm run test-browserunit` - Run unit tests in browser with Karma
- `npm run test-functional` - Run functional tests with Selenium
- `npm run coverage` - Generate test coverage report

### Code Quality
- `npm run lint` - Run ESLint on source files (src/**/*.js and test files)

### Documentation
- `npm run doc` - Generate JSDoc API documentation

### WebRTC Testing
For WebRTC functionality testing:
1. Development mode: `npm run start` then open http://localhost:3000/samples/webrtc/webrtc.html
2. Production mode: `npm run prepack` then open ./samples/webrtc/webrtc.html

## Architecture

### Core Components

**MediaPlayer** (src/streaming/MediaPlayer.js) - Main player interface that orchestrates playback. Handles initialization, stream loading, and coordinates between different handlers (DASH, MSS, WebRTC).

**WebRtcHandler** (src/webrtc/WebRtcHandler.js) - Manages WebRTC streaming when enabled. Detects WebRTC adaptation sets in manifests and establishes WHPP connections for real-time streaming.

**Stream/StreamProcessor** (src/streaming/) - Core streaming pipeline that manages buffer controllers, fragment loading, and adaptive bitrate logic. Extended to support WebRTC alongside traditional DASH streaming.

### WebRTC Integration

WebRTC support is enabled via settings: `player.updateSettings({webrtc: {enabled: true}})`. When a manifest contains a WebRTC adaptation set with `mimeType="video RTP/AVP"` and WHPP endpoint, the WebRtcHandler takes over playback instead of the standard DASH pipeline.

The integration uses @eyevinn/whpp-client for WHPP protocol implementation and creates RTCPeerConnection for media streaming directly to the video element's srcObject.

### Module System

The project uses Webpack for bundling with separate configs for dev (webpack.dev.js) and production (webpack.prod.js). Source code follows ES6 modules with FactoryMaker pattern for dependency injection.

## Code Style

- ESLint configuration enforces 4-space indentation and single quotes
- All source files require BSD-3 license header
- Follow existing patterns for new components (FactoryMaker for singletons, proper event handling)
- Unit tests required for new functionality