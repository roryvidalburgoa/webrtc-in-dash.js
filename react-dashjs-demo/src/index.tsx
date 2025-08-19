import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import Socket.io client (required for WebRTC socket.io mode)
import 'socket.io-client';

// We need to load dashjs as a script tag instead of ES6 import
// because it needs to be available as window.dashjs

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);