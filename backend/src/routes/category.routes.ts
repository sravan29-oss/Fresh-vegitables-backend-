import { Router } from 'express';
import {
  getCategories,
  getCategoryBySlug,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload, setUploadType } from '../middleware/upload';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';

const router = Router();

// Public routes
router.get('/', getCategories);
router.get('/admin/all', authenticateAdmin, getAllCategories);
router.get('/:slug', getCategoryBySlug);

// Admin routes
router.post(
  '/',
  authenticateAdmin,
  setUploadType('categories'),
  upload.single('image'),
  validate(createCategorySchema),
  createCategory
);

router.put(
  '/:id',
  authenticateAdmin,
  setUploadType('categories'),
  upload.single('image'),
  validate(updateCategorySchema),
  updateCategory
);

router.delete('/:id', authenticateAdmin, deleteCategory);

export default router;
