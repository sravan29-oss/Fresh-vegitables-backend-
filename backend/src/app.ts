import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/appError';
import db from './config/database';

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

const UPLOAD_PRODUCE_FALLBACKS: Record<string, string> = {
  'green chilli': 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  chilli: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  chili: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  mirchi: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80',
  milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80',
  curd: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80',
  dahi: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80',
  goruchikkudu: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop&q=80',
  beans: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop&q=80',
  cucumber: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=600&auto=format&fit=crop&q=80',
  kheera: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=600&auto=format&fit=crop&q=80',
  tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
  potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
  onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
  carrot: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80',
  'lady finger': 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=600&auto=format&fit=crop&q=80',
  bhindi: 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=600&auto=format&fit=crop&q=80',
  coriander: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?w=600&auto=format&fit=crop&q=80',
  spinach: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
  capsicum: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80',
  cauliflower: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=600&auto=format&fit=crop&q=80',
  cabbage: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&auto=format&fit=crop&q=80',
  lemon: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&auto=format&fit=crop&q=80',
  mint: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=600&auto=format&fit=crop&q=80',
  beetroot: 'https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600&auto=format&fit=crop&q=80',
  radish: 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600&auto=format&fit=crop&q=80',
  peas: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&auto=format&fit=crop&q=80',
  mushroom: 'https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=600&auto=format&fit=crop&q=80',
  brinjal: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80',
  garlic: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=600&auto=format&fit=crop&q=80',
  ginger: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80',
};

// Resilient produce-aware fallback for missing uploads (prevents 404 console errors and prevents generic salad bowl substitution)
app.use('/uploads', async (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext)) {
    try {
      const filename = path.basename(req.path);
      const prodRes = await db.query(
        `SELECT name FROM products WHERE images::text ILIKE $1 LIMIT 1`,
        [`%${filename}%`]
      );
      if (prodRes.rows.length > 0 && prodRes.rows[0].name) {
        const prodName = prodRes.rows[0].name.toLowerCase();
        for (const [key, fallbackUrl] of Object.entries(UPLOAD_PRODUCE_FALLBACKS)) {
          if (prodName.includes(key)) {
            return res.redirect(302, fallbackUrl);
          }
        }
      }
    } catch {
      // Fallback silently if db query error
    }

    return res.redirect(302, 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=1200&auto=format&fit=crop&q=80');
  }
  next();
});

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
