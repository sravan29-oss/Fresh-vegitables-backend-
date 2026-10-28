import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getProductById,
  adminGetProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreAdminProducts,
} from '../controllers/product.controller';
import { authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload, setUploadType } from '../middleware/upload';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

const router = Router();

// Public routes
router.get('/', getProducts);
router.get('/sync/restore-admin-data', restoreAdminProducts);
router.get('/admin/all', authenticateAdmin, adminGetProducts);
router.get('/id/:id', getProductById);
router.get('/:slug', getProductBySlug);

// Admin routes
router.post(
  '/',
  authenticateAdmin,
  setUploadType('products'),
  upload.array('images', 5),
  validate(createProductSchema),
  createProduct
);

router.put(
  '/:id',
  authenticateAdmin,
  setUploadType('products'),
  upload.array('images', 5),
  validate(updateProductSchema),
  updateProduct
);

router.delete('/:id', authenticateAdmin, deleteProduct);

export default router;
