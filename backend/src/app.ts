import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/appError';

const app = express();

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same origin)
      if (!origin) return callback(null, true);
      const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'];
      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all in development
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploaded files
const uploadPath = path.resolve(__dirname, '../', env.UPLOAD_DIR);
app.use('/uploads', express.static(uploadPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Fresh Vegetables API', timestamp: new Date().toISOString() });
});

// Root SEO Feeds
import { getSitemapXml, getRobotsTxt } from './controllers/feed.controller';
app.get('/sitemap.xml', getSitemapXml);
app.get('/robots.txt', getRobotsTxt);

// Prevent HTTP caching on dynamic API routes so responses update immediately
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Catch 404
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Global error handler
app.use(errorHandler);

export default app;
