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
} from '../controllers/auth.controller';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  adminLoginSchema,
  updateProfileSchema,
  firebaseRegisterSchema,
  firebaseLoginSchema,
  checkPhoneSchema,
} from '../validators/auth.validator';

const router = Router();

// Customer Firebase Phone OTP Auth
router.post('/firebase/register', validate(firebaseRegisterSchema), firebaseRegister);
router.post('/firebase/login', validate(firebaseLoginSchema), firebaseLogin);
router.post('/firebase/check-phone', validate(checkPhoneSchema), checkPhoneRegistered);

// Customer auth & session
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refreshToken);
router.get('/profile', authenticateCustomer, getProfile);
router.put('/profile', authenticateCustomer, validate(updateProfileSchema), updateProfile);

// Admin auth — completely untouched
router.post('/admin/login', validate(adminLoginSchema), adminLogin);

export default router;
