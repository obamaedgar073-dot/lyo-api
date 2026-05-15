// ============================================================
// LYO - Notification Routes
// ============================================================

import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '@/controllers';
import { authenticate } from '@/middleware';

const router = Router();

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.patch('/:notificationId/read', authenticate, markAsRead);
router.patch('/read-all', authenticate, markAllAsRead);

export default router;
