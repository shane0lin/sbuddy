import { Router } from 'express';
import { AdminController } from './controller';

const router = Router();
const adminController = new AdminController();

router.get('/status', adminController.getStatus);

export default router;
