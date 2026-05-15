// ============================================================
// LYO - User Routes
// ============================================================

import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  uploadCover,
  follow,
  unfollow,
  getFollowers,
  getFollowing,
  searchUsers,
  getSuggestions,
} from '@/controllers';
import { authenticate, validate, upload } from '@/middleware';
import { updateProfileSchema, searchSchema } from '@/validators';

const router = Router();

router.get('/search', authenticate, validate(searchSchema), searchUsers);
router.get('/suggestions', authenticate, getSuggestions);
router.get('/:username', authenticate, getProfile);
router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/me/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.post('/me/cover', authenticate, upload.single('cover'), uploadCover);
router.post('/:userId/follow', authenticate, follow);
router.delete('/:userId/follow', authenticate, unfollow);
router.get('/:username/followers', authenticate, getFollowers);
router.get('/:username/following', authenticate, getFollowing);

export default router;
