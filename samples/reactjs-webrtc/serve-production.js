const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
    ========================================
    🚀 Production server running!
    ========================================
    
    📍 Local:    http://localhost:${PORT}
    📍 Network:  http://${getNetworkIP()}:${PORT}
    
    📦 Serving:  ${path.join(__dirname, 'dist')}
    
    Press CTRL+C to stop the server
    ========================================
  `);
});

function getNetworkIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}