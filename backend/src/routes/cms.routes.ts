import { Router } from 'express';
import {
  getHomepageData,
  getHomepagePreview,
  getAllSectionsAdmin,
  createSectionAdmin,
  updateSectionAdmin,
  toggleSectionStatus,
  reorderSections,
  deleteSection,
  getBannersAdmin,
  createBannerAdmin,
  updateBannerAdmin,
  deleteBannerAdmin,
  getStoreSettings,
  updateStoreSettings,
} from '../controllers/cms.controller';
import { authenticateAdmin } from '../middleware/auth';
import { upload, setUploadType } from '../middleware/upload';

const router = Router();

// Store & Contact Settings (Header, Footer, Support phone/email)
router.get('/settings', getStoreSettings);
router.put('/settings', authenticateAdmin, updateStoreSettings);

// Public route for customer homepage (published & scheduled active only)
router.get('/homepage', getHomepageData);

// Admin preview endpoint (includes unpublished & draft sections)
router.get('/preview', authenticateAdmin, getHomepagePreview);

// Admin routes for Homepage Builder Sections
router.get('/sections', authenticateAdmin, getAllSectionsAdmin);
router.post('/sections', authenticateAdmin, createSectionAdmin);
router.put('/sections/:id', authenticateAdmin, updateSectionAdmin);
router.patch('/sections/:id/toggle', authenticateAdmin, toggleSectionStatus);
router.post('/sections/reorder', authenticateAdmin, reorderSections);
router.delete('/sections/:id', authenticateAdmin, deleteSection);

// Admin routes for Hero & Promotional Banners
router.get('/banners', authenticateAdmin, getBannersAdmin);
router.post('/banners', authenticateAdmin, setUploadType('banners'), upload.single('image'), createBannerAdmin);
router.put('/banners/:id', authenticateAdmin, setUploadType('banners'), upload.single('image'), updateBannerAdmin);
router.delete('/banners/:id', authenticateAdmin, deleteBannerAdmin);

export default router;
