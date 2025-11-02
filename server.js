const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Avatar viewer endpoint - Mobile-first interface
app.get('/avatar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile-tutor.html'));
});

// Legacy web demo (for reference)
app.get('/avatar/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'avatar-viewer.html'));
});

// API endpoints for avatar control
app.post('/avatar/speak', (req, res) => {
  const { text, expression } = req.body;
  console.log(`Speaking: "${text}" with expression: ${expression || 'neutral'}`);
  
  // In a real implementation, this would trigger the avatar
  res.json({ 
    success: true, 
    text,
    expression,
    duration: Math.ceil(text.length / 15) // Rough estimate in seconds
  });
});

app.post('/avatar/expression', (req, res) => {
  const { expression } = req.body;
  console.log(`Setting expression: ${expression}`);
  
  res.json({ 
    success: true, 
    expression 
  });
});

app.get('/avatar/status', (req, res) => {
  res.json({
    ready: true,
    expressions: ['neutral', 'smile', 'laugh', 'sad', 'surprise', 'anger'],
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'E-Tutor Avatar Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      avatar: '/avatar',
      speak: 'POST /avatar/speak',
      expression: 'POST /avatar/expression',
      status: '/avatar/status'
    },
    docs: 'https://github.com/vimanga-x64/three.js-e-tutoring-avatar'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 E-Tutor Avatar Server running on port ${PORT}`);
  console.log(`📱 Avatar viewer: http://localhost:${PORT}/avatar`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
