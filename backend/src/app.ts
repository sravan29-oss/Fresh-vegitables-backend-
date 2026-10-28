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
      // Allow requests with no origin (e.g. server-to-server webhooks from Meta, mobile apps, curl)
      if (!origin) return callback(null, true);

      const isVercel = origin.endsWith('.vercel.app');
      const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      const isConfiguredFrontend =
        Boolean(env.FRONTEND_URL) &&
        (origin === env.FRONTEND_URL ||
          origin === env.FRONTEND_URL.replace(/\/$/, '') ||
          origin.startsWith(env.FRONTEND_URL.replace(/\/$/, '')));

      if (isVercel || isLocalhost || isConfiguredFrontend) {
        return callback(null, true);
      }

      if (env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Hub-Signature-256'],
  })
);

// Body parsers with raw body retention for HMAC signature verification
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Serve static uploaded files
const uploadPath = path.resolve(__dirname, '../', env.UPLOAD_DIR);
app.use('/uploads', express.static(uploadPath));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Fresh Vegetables API',
    health: '/health',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

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
