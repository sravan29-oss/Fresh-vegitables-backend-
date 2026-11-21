import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  adminLogin,
  refreshToken,
  firebaseRegister,
  firebaseLogin,
  checkPhoneRegistered,
  googleAuth,
} from '../controllers/auth.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  adminLoginSchema,
  updateProfileSchema,
  firebaseRegisterSchema,
  firebaseLoginSchema,
  checkPhoneSchema,
  googleAuthSchema,
} from '../validators/auth.validator';

const router = Router();

// Customer Google Authentication (Sole Customer Sign-up & Login entrypoint)
router.post('/google', authRateLimiter, validate(googleAuthSchema), googleAuth);

// Disabled legacy customer authentication endpoints (return 403 Forbidden)
router.post('/firebase/register', firebaseRegister);
router.post('/firebase/login', firebaseLogin);
router.post('/firebase/check-phone', checkPhoneRegistered);
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', authRateLimiter, refreshToken);
router.get('/profile', authenticateCustomer, getProfile);
router.put('/profile', authenticateCustomer, validate(updateProfileSchema), updateProfile);

// Admin auth — completely untouched
router.post('/admin/login', authRateLimiter, validate(adminLoginSchema), adminLogin);

export default router;
