import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Betting Data Processor Server running on port ${PORT}`);
  console.log(`📊 Web interface available at: http://localhost:${PORT}`);
  console.log(`🔗 Live Feed API available at: http://localhost:${PORT}/api/live-feed`);
  console.log(`🔗 Pre-Games API available at: http://localhost:${PORT}/api/pre-games`);
  console.log(`❤️  Health check available at: http://localhost:${PORT}/health`);
});
