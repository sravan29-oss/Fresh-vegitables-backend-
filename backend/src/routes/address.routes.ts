import { Router } from 'express';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import { authenticateCustomer } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAddressSchema, updateAddressSchema } from '../validators/address.validator';

const router = Router();

// All address routes require customer authentication
router.use(authenticateCustomer);

router.get('/', getAddresses);
router.post('/', validate(createAddressSchema), createAddress);
router.put('/:id', validate(updateAddressSchema), updateAddress);
router.delete('/:id', deleteAddress);
router.patch('/:id/default', setDefaultAddress);

export default router;
