import app from './app';
import { env } from './config/env';
import { autoMigrateAndSeed } from './autoMigrate';

async function bootstrap() {
  // Automatically apply migrations and seeds on startup without requiring a shell
  await autoMigrateAndSeed().catch((err) => {
    console.warn('⚠️ Auto-migration note:', err.message);
  });

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
}

bootstrap();

