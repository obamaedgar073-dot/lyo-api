// ============================================================
// LYO - Post Controller
// ============================================================

import type { Response, NextFunction } from 'express';
import { prisma } from '@/config';
import { redis } from '@/config';
import { success, paginate, AppError, getFileUrl } from '@/utils';
import type { AuthRequest } from '@/middleware';

const POST_SELECT = {
  id: true,
  content: true,
  mediaUrls: true,
  visibility: true,
  vibeCount: true,
  commentCount: true,
  repostCount: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isVerified: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  },
};

export async function createPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { content, visibility, replyToId } = req.body;
    const userId = req.user!.id;

    const mediaUrls = (req.files as Express.Multer.File[] | undefined)?.map((f) =>
      getFileUrl(f.filename)
    ) ?? [];

    const post = await prisma.$transaction(async (tx) => {
      const newPost = await tx.post.create({
        data: {
          authorId: userId,
          content: content || '',
          mediaUrls,
          visibility,
          replyToId,
        },
        select: POST_SELECT,
      });

      await tx.user.update({
        where: { id: userId },
        data: { postCount: { increment: 1 } },
      });

      return newPost;
    });

    // Invalidate feeds
    await redis.del('feed:trending');

    res.status(201).json(success(post, 'Post created'));
  } catch (err) {
    next(err);
  }
}

export async function getFeed(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type = 'following', cursor, limit = 10 } = req.query as Record<string, string>;
    const userId = req.user!.id;
    const take = parseInt(limit);

    let where: Record<string, unknown> = {};

    if (type === 'following') {
      const followingIds = await prisma.follow.findMany({
        where: { followerId: userId, status: 'accepted' },
        select: { followingId: true },
      });
      where = {
        authorId: { in: followingIds.map((f) => f.followingId) },
        visibility: { in: ['public', 'followers'] },
      };
    } else if (type === 'trending') {
      const cached = await redis.get('feed:trending');
      if (cached) {
        return res.json(success(JSON.parse(cached)));
      }
      where = { visibility: 'public' };
    } else {
      where = { visibility: 'public' };
    }

    const posts = await prisma.post.findMany({
      where,
      select: POST_SELECT,
      take: take + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: type === 'trending' ? { score: 'desc' } : { createdAt: 'desc' },
    });

    const hasMore = posts.length > take;
    const result = hasMore ? posts.slice(0, take) : posts;
    const nextCursor = hasMore ? result[result.length - 1].id : null;

    // Add user-specific data
    const postIds = result.map((p) => p.id);
    const [userVibes, userReposts] = await Promise.all([
      prisma.vibe.findMany({
        where: { postId: { in: postIds }, userId },
        select: { postId: true, type: true },
      }),
      prisma.repost.findMany({
        where: { postId: { in: postIds }, userId },
        select: { postId: true },
      }),
    ]);

    const postsWithUserData = result.map((post) => ({
      ...post,
      hasVibed: userVibes.some((v) => v.postId === post.id),
      userVibe: userVibes.find((v) => v.postId === post.id)?.type || null,
      hasReposted: userReposts.some((r) => r.postId === post.id),
    }));

    const response = { posts: postsWithUserData, nextCursor };

    if (type === 'trending') {
      await redis.setEx('feed:trending', 300, JSON.stringify(response));
    }

    res.json(success(response));
  } catch (err) {
    next(err);
  }
}

export async function getPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        ...POST_SELECT,
        vibes: {
          select: { type: true },
          distinct: ['type'],
        },
      },
    });

    if (!post) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    // Check visibility
    if (post.visibility !== 'public' && post.author.id !== userId) {
      const isFollowing = await prisma.follow.findFirst({
        where: { followerId: userId, followingId: post.author.id, status: 'accepted' },
      });
      if (!isFollowing) {
        throw new AppError(403, 'FORBIDDEN', 'You cannot view this post');
      }
    }

    // Count vibes by type
    const vibeCounts = await prisma.vibe.groupBy({
      by: ['type'],
      where: { postId },
      _count: { type: true },
    });

    const userVibe = userId
      ? await prisma.vibe.findUnique({
          where: { postId_userId: { postId, userId } },
          select: { type: true },
        })
      : null;

    const hasReposted = userId
      ? !!(await prisma.repost.findUnique({
          where: { postId_userId: { postId, userId } },
        }))
      : false;

    res.json(
      success({
        ...post,
        vibes: vibeCounts.map((v) => ({ type: v.type, count: v._count.type })),
        hasVibed: !!userVibe,
        userVibe: userVibe?.type || null,
        hasReposted,
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function deletePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;
    const userId = req.user!.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      throw new AppError(404, 'NOT_FOUND', 'Post not found');
    }

    if (post.authorId !== userId && req.user!.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete your own posts');
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

export async function vibePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;
    const { vibeType } = req.body;
    const userId = req.user!.id;

    const existing = await prisma.vibe.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      if (existing.type === vibeType) {
        // Remove vibe
        await prisma.$transaction(async (tx) => {
          await tx.vibe.delete({ where: { id: existing.id } });
          await tx.post.update({
            where: { id: postId },
            data: { vibeCount: { decrement: 1 } },
          });
        });
        return res.json(success(null, 'Vibe removed'));
      } else {
        // Change vibe type
        await prisma.vibe.update({
          where: { id: existing.id },
          data: { type: vibeType },
        });
        return res.json(success(null, 'Vibe updated'));
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.vibe.create({
        data: { postId, userId, type: vibeType },
      });
      await tx.post.update({
        where: { id: postId },
        data: { vibeCount: { increment: 1 } },
      });
    });

    // Create notification
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (post && post.authorId !== userId) {
      await prisma.notification.create({
        data: {
          recipientId: post.authorId,
          actorId: userId,
          type: 'like',
          referenceId: postId,
          referenceType: 'post',
          message: 'vibed your post',
        },
      });
    }

    res.json(success(null, 'Vibe added'));
  } catch (err) {
    next(err);
  }
}

export async function repost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.repost.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.repost.delete({ where: { id: existing.id } });
        await tx.post.update({
          where: { id: postId },
          data: { repostCount: { decrement: 1 } },
        });
      });
      return res.json(success(null, 'Repost removed'));
    }

    await prisma.$transaction(async (tx) => {
      await tx.repost.create({
        data: { postId, userId },
      });
      await tx.post.update({
        where: { id: postId },
        data: { repostCount: { increment: 1 } },
      });
    });

    res.json(success(null, 'Reposted'));
  } catch (err) {
    next(err);
  }
}

export async function getComments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId },
        select: {
          id: true,
          content: true,
          vibeCount: true,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where: { postId } }),
    ]);

    res.json(success(paginate(comments, page, limit, total)));
  } catch (err) {
    next(err);
  }
}

export async function createComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          postId,
          authorId: userId,
          content,
        },
        select: {
          id: true,
          content: true,
          vibeCount: true,
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
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      return newComment;
    });

    // Notify post author
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (post && post.authorId !== userId) {
      await prisma.notification.create({
        data: {
          recipientId: post.authorId,
          actorId: userId,
          type: 'reply',
          referenceId: comment.id,
          referenceType: 'comment',
          message: 'commented on your post',
        },
      });
    }

    res.status(201).json(success(comment, 'Comment added'));
  } catch (err) {
    next(err);
  }
}

export async function getTrending(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const posts = await prisma.post.findMany({
      where: { visibility: 'public' },
      select: POST_SELECT,
      orderBy: { score: 'desc' },
      take: limit,
    });

    res.json(success(posts));
  } catch (err) {
    next(err);
  }
}
