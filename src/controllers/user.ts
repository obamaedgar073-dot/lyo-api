// ============================================================
// LYO - User Controller
// ============================================================

import type { Response, NextFunction } from 'express';
import { prisma } from '@/config';
import { success, paginate, AppError } from '@/utils';
import type { AuthRequest } from '@/middleware';

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  coverUrl: true,
  location: true,
  website: true,
  isVerified: true,
  isPrivate: true,
  role: true,
  status: true,
  followerCount: true,
  followingCount: true,
  postCount: true,
  createdAt: true,
  updatedAt: true,
};

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        ...USER_SELECT,
        posts: {
          where: { replyToId: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            content: true,
            mediaUrls: true,
            visibility: true,
            vibeCount: true,
            commentCount: true,
            repostCount: true,
            isPinned: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    // Check if private and not following
    let isFollowing = false;
    if (user.isPrivate && user.id !== currentUserId) {
      const follow = await prisma.follow.findFirst({
        where: { followerId: currentUserId, followingId: user.id, status: 'accepted' },
      });
      if (!follow) {
        // Return limited profile
        const { posts, ...limited } = user;
        return res.json(
          success({
            ...limited,
            posts: [],
            isOwner: false,
            isFollowing: false,
            hasPendingFollowRequest: !!(await prisma.follow.findFirst({
              where: { followerId: currentUserId, followingId: user.id, status: 'pending' },
            })),
          })
        );
      }
      isFollowing = true;
    } else if (user.id !== currentUserId) {
      isFollowing = !!(await prisma.follow.findFirst({
        where: { followerId: currentUserId, followingId: user.id, status: 'accepted' },
      }));
    }

    res.json(
      success({
        ...user,
        isOwner: user.id === currentUserId,
        isFollowing,
        hasPendingFollowRequest: false,
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { displayName, bio, location, website, isPrivate } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName,
        bio,
        location,
        website,
        isPrivate,
      },
      select: USER_SELECT,
    });

    res.json(success(user, 'Profile updated'));
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      throw new AppError(400, 'NO_FILE', 'No file uploaded');
    }

    const avatarUrl = `/uploads/${file.filename}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    res.json(success({ avatarUrl }, 'Avatar updated'));
  } catch (err) {
    next(err);
  }
}

export async function uploadCover(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      throw new AppError(400, 'NO_FILE', 'No file uploaded');
    }

    const coverUrl = `/uploads/${file.filename}`;

    await prisma.user.update({
      where: { id: userId },
      data: { coverUrl },
    });

    res.json(success({ coverUrl }, 'Cover updated'));
  } catch (err) {
    next(err);
  }
}

export async function follow(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const followerId = req.user!.id;

    if (userId === followerId) {
      throw new AppError(400, 'SELF_FOLLOW', 'You cannot follow yourself');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPrivate: true },
    });

    if (!targetUser) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId: userId },
      },
    });

    if (existing) {
      throw new AppError(409, 'ALREADY_FOLLOWING', 'Already following this user');
    }

    const status = targetUser.isPrivate ? 'pending' : 'accepted';

    await prisma.$transaction(async (tx) => {
      await tx.follow.create({
        data: { followerId, followingId: userId, status },
      });

      if (status === 'accepted') {
        await tx.user.update({
          where: { id: userId },
          data: { followerCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        });
      }
    });

    // Notify user
    await prisma.notification.create({
      data: {
        recipientId: userId,
        actorId: followerId,
        type: 'follow',
        message: status === 'pending' ? 'requested to follow you' : 'followed you',
      },
    });

    res.status(201).json(success(null, status === 'pending' ? 'Follow request sent' : 'Now following'));
  } catch (err) {
    next(err);
  }
}

export async function unfollow(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const followerId = req.user!.id;

    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId: userId },
      },
    });

    if (!follow) {
      throw new AppError(404, 'NOT_FOLLOWING', 'Not following this user');
    }

    await prisma.$transaction(async (tx) => {
      await tx.follow.delete({
        where: { id: follow.id },
      });

      if (follow.status === 'accepted') {
        await tx.user.update({
          where: { id: userId },
          data: { followerCount: { decrement: 1 } },
        });
        await tx.user.update({
          where: { id: followerId },
          data: { followingCount: { decrement: 1 } },
        });
      }
    });

    res.json(success(null, 'Unfollowed'));
  } catch (err) {
    next(err);
  }
}

export async function getFollowers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const [followers, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: user.id, status: 'accepted' },
        select: {
          follower: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              isVerified: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.follow.count({
        where: { followingId: user.id, status: 'accepted' },
      }),
    ]);

    const users = followers.map((f) => f.follower);
    res.json(success(paginate(users, page, limit, total)));
  } catch (err) {
    next(err);
  }
}

export async function getFollowing(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: user.id, status: 'accepted' },
        select: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              isVerified: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.follow.count({
        where: { followerId: user.id, status: 'accepted' },
      }),
    ]);

    const users = following.map((f) => f.following);
    res.json(success(paginate(users, page, limit, total)));
  } catch (err) {
    next(err);
  }
}

export async function searchUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { q, limit = '20' } = req.query as Record<string, string>;
    const take = parseInt(limit);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        status: 'active',
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        followerCount: true,
      },
      take,
    });

    res.json(success({ users }));
  } catch (err) {
    next(err);
  }
}

export async function getSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 5;

    // Get users not followed by current user, ordered by follower count
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'active',
        followers: {
          none: { followerId: userId },
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        followerCount: true,
      },
      orderBy: { followerCount: 'desc' },
      take: limit,
    });

    res.json(success({ users }));
  } catch (err) {
    next(err);
  }
}
