# Dashcam Live Feed Modal - React Application

This is a complete React.js application demonstrating the usage of the `DashcamLiveFeedModal` component.

## Features

- Live dashcam video streaming using MPEG-DASH
- Support for multiple camera views (front and rear)
- Browser compatibility checks
- Stream URL expiration handling
- Responsive Bootstrap UI

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Run the development server:
```bash
npm start
```

The application will open automatically at `http://localhost:3000`

## Building for Production

Build the production-ready files:
```bash
npm run build
```

This will create a `dist` folder with all the optimized files.

## Deployment

### Option 1: Static Server

After building, serve the files using the included serve package:
```bash
npm run serve
```

### Option 2: Web Server Deployment

1. Run `npm run build`
2. Upload the contents of the `dist` folder to your web server
3. Ensure your web server serves `index.html` for all routes

### Option 3: Docker (nginx)

Create a `Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Then build and run:
```bash
docker build -t dashcam-app .
docker run -p 8080:80 dashcam-app
```

## Project Structure

```
C:/01/HCSS/
├── src/
│   ├── components/
│   │   └── DashcamLiveFeedModal.tsx  # Main component
│   ├── mocks/
│   │   └── hcss-components.tsx       # Mock HCSS components
│   ├── Telematics-bundle-components/
│   │   └── TeleIndex.tsx              # Mock Telematics components
│   ├── types/
│   │   └── dashjs.d.ts               # TypeScript definitions
│   ├── GenericService.ts             # Mock API service
│   ├── App.tsx                       # Main app with usage example
│   └── index.tsx                     # Entry point
├── public/
│   └── index.html                    # HTML template
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
└── webpack.config.js                 # Webpack config
```

## Component Usage

The `DashcamLiveFeedModal` component accepts two props:

- `gpsSerial`: GPS device serial number (string)
- `equipmentCode`: Equipment identifier (string)

Example:
```typescript
import { init } from './components/DashcamLiveFeedModal';

// Initialize the modal
init('GPS123456', 'Equipment-001', document.getElementById('container'));
```

## Notes

- The demo uses mock data with sample MPEG-DASH streams
- Mac/iPhone devices are not supported due to MPEG-DASH compatibility
- In production, replace the mock `GenericService` with actual API endpoints