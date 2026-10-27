import app from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Fresh Vegetables API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`🔗 API Base URL: http://localhost:${env.PORT}/api`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
