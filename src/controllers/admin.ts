// ============================================================
// LYO - Admin Controller
// ============================================================

import type { Response, NextFunction } from 'express';
import { prisma } from '@/config';
import { redis } from '@/config';
import { success, paginate, AppError } from '@/utils';
import type { AuthRequest } from '@/middleware';

const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  status: true,
  followerCount: true,
  followingCount: true,
  postCount: true,
  createdAt: true,
  updatedAt: true,
};

export async function getUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { role, status, search, page = '1', limit = '10' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json(success(paginate(users, pageNum, limitNum, total)));
  } catch (err) {
    next(err);
  }
}

export async function updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const adminId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    // Prevent admin from suspending another admin
    if (user.role === 'admin' && status !== 'active') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot modify admin status');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: ADMIN_USER_SELECT,
    });

    // Create system notification
    await prisma.notification.create({
      data: {
        recipientId: userId,
        actorId: adminId,
        type: 'system',
        message: `Your account has been ${status}`,
      },
    });

    res.json(success(updated, `User status updated to ${status}`));
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: ADMIN_USER_SELECT,
    });

    res.json(success(updated, `User role updated to ${role}`));
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    if (user.role === 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete admin users');
    }

    await prisma.user.delete({ where: { id: userId } });

    res.json(success(null, 'User deleted'));
  } catch (err) {
    next(err);
  }
}

export async function getPosts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { search, page = '1', limit = '10' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          visibility: true,
          vibeCount: true,
          commentCount: true,
          repostCount: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.post.count({ where }),
    ]);

    res.json(success(paginate(posts, pageNum, limitNum, total)));
  } catch (err) {
    next(err);
  }
}

export async function adminDeletePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.delete({ where: { id: postId } });
      await tx.user.update({
        where: { id: post.authorId },
        data: { postCount: { decrement: 1 } },
      });
    });

    res.json(success(null, 'Post deleted'));
  } catch (err) {
    next(err);
  }
}

export async function getReports(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status, page = '1', limit = '10' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          reporter: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          targetType: true,
          targetId: true,
          reason: true,
          details: true,
          status: true,
          reviewedBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          resolution: true,
          createdAt: true,
          resolvedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.report.count({ where }),
    ]);

    res.json(success(paginate(reports, pageNum, limitNum, total)));
  } catch (err) {
    next(err);
  }
}

export async function resolveReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { reportId } = req.params;
    const { resolution } = req.body;
    const adminId = req.user!.id;

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'reviewed',
        reviewedById: adminId,
        resolution,
        resolvedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        resolution: true,
        resolvedAt: true,
        reporter: {
          select: { id: true, username: true },
        },
      },
    });

    // Notify reporter
    await prisma.notification.create({
      data: {
        recipientId: report.reporter.id,
        actorId: adminId,
        type: 'system',
        message: 'Your report has been reviewed and resolved',
      },
    });

    res.json(success(report, 'Report resolved'));
  } catch (err) {
    next(err);
  }
}

export async function dismissReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { reportId } = req.params;
    const adminId = req.user!.id;

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'dismissed',
        reviewedById: adminId,
        resolvedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
        reporter: {
          select: { id: true, username: true },
        },
      },
    });

    // Notify reporter
    await prisma.notification.create({
      data: {
        recipientId: report.reporter.id,
        actorId: adminId,
        type: 'system',
        message: 'Your report has been dismissed',
      },
    });

    res.json(success(report, 'Report dismissed'));
  } catch (err) {
    next(err);
  }
}

export async function getAnalyticsOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cacheKey = 'analytics:overview';
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(success(JSON.parse(cached)));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalPosts,
      totalInteractions,
      activeUsersToday,
      newUsersToday,
      reportsPending,
      lastMonthUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.vibe.count(),
      prisma.user.count({
        where: { lastLoginAt: { gte: today } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const prevMonthUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
          lt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const growthRate = prevMonthUsers > 0
      ? Math.round(((lastMonthUsers - prevMonthUsers) / prevMonthUsers) * 100)
      : 0;

    const overview = {
      totalUsers,
      totalPosts,
      totalInteractions,
      activeUsersToday,
      newUsersToday,
      reportsPending,
      growthRate,
    };

    await redis.setEx(cacheKey, 300, JSON.stringify(overview));
    res.json(success(overview));
  } catch (err) {
    next(err);
  }
}

export async function getTimeSeries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const cacheKey = `analytics:timeSeries:${days}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(success(JSON.parse(cached)));
    }

    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get daily stats or aggregate from data
    const stats = await prisma.dailyStats.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // If no stats table data, generate from raw data
    let result;
    if (stats.length > 0) {
      result = stats.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        users: s.newUsers,
        posts: s.newPosts,
        interactions: s.interactions,
      }));
    } else {
      // Aggregate from raw data
      const dateMap = new Map();

      for (let i = 0; i < days; i++) {
        const d = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
        dateMap.set(d.toISOString().split('T')[0], { users: 0, posts: 0, interactions: 0 });
      }

      const [users, posts, vibes] = await Promise.all([
        prisma.user.groupBy({
          by: ['createdAt'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
        }),
        prisma.post.groupBy({
          by: ['createdAt'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
        }),
        prisma.vibe.groupBy({
          by: ['createdAt'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
        }),
      ]);

      result = Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      })).reverse();
    }

    await redis.setEx(cacheKey, 600, JSON.stringify(result));
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getTopUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const users = await prisma.user.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        followerCount: true,
        postCount: true,
      },
      orderBy: { followerCount: 'desc' },
      take: limit,
    });

    res.json(success({ users }));
  } catch (err) {
    next(err);
  }
}

export async function getTopPosts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const posts = await prisma.post.findMany({
      where: { visibility: 'public' },
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        vibeCount: true,
        commentCount: true,
        repostCount: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: limit,
    });

    res.json(success({ posts }));
  } catch (err) {
    next(err);
  }
}
