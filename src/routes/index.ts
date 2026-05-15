import { Router } from 'express';
import authRoutes from './auth';
import postRoutes from './post';
import userRoutes from './user';
import notificationRoutes from './notification';
import adminRoutes from './admin';

const router = Router();

router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;
