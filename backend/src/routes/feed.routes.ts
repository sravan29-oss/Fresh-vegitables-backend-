import { Router } from 'express';
import { getGoogleShoppingFeed, getSitemapXml, getRobotsTxt } from '../controllers/feed.controller';

const router = Router();

// Feed endpoints
router.get('/google-shopping.xml', getGoogleShoppingFeed);
router.get('/sitemap.xml', getSitemapXml);
router.get('/robots.txt', getRobotsTxt);

export default router;
