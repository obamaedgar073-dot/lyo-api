// ============================================================
// LYO - Notification Controller
// ============================================================

import type { Response, NextFunction } from 'express';
import { prisma } from '@/config';
import { success, paginate } from '@/utils';
import type { AuthRequest } from '@/middleware';

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: userId },
        select: {
          id: true,
          actor: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          type: true,
          referenceId: true,
          referenceType: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { recipientId: userId } }),
      prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
    ]);

    res.json(success({ notifications, unreadCount, total }, undefined, paginate([], page, limit, total).meta));
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });

    res.json(success(null, 'Marked as read'));
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const result = await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    res.json(success({ count: result.count }, 'All notifications marked as read'));
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const count = await prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });

    res.json(success({ count }));
  } catch (err) {
    next(err);
  }
}
