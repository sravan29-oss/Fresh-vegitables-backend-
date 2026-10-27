import { Router } from 'express';
import { register, login, getProfile, updateProfile, adminLogin } from '../controllers/auth.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, adminLoginSchema, updateProfileSchema } from '../validators/auth.validator';

const router = Router();

// Customer auth
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/profile', authenticateCustomer, getProfile);
router.put('/profile', authenticateCustomer, validate(updateProfileSchema), updateProfile);

// Admin auth
router.post('/admin/login', validate(adminLoginSchema), adminLogin);

export default router;
