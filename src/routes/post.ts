// ============================================================
// LYO - Post Routes
// ============================================================

import { Router } from 'express';
import {
  createPost,
  getFeed,
  getPost,
  deletePost,
  vibePost,
  repost,
  getComments,
  createComment,
  getTrending,
} from '@/controllers';
import { authenticate, validate, upload } from '@/middleware';
import { createPostSchema, vibeSchema, commentSchema, feedQuerySchema } from '@/validators';

const router = Router();

router.get('/feed', authenticate, validate(feedQuerySchema), getFeed);
router.get('/trending', getTrending);
router.get('/:postId', authenticate, getPost);
router.post('/', authenticate, upload.array('media', 4), validate(createPostSchema), createPost);
router.delete('/:postId', authenticate, deletePost);
router.post('/:postId/vibe', authenticate, validate(vibeSchema), vibePost);
router.delete('/:postId/vibe', authenticate, vibePost); // Remove vibe
router.post('/:postId/repost', authenticate, repost);
router.get('/:postId/comments', authenticate, getComments);
router.post('/:postId/comments', authenticate, validate(commentSchema), createComment);

export default router;
