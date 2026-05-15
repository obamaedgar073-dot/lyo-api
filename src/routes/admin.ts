// ============================================================
// LYO - Admin Routes
// ============================================================

import { Router } from 'express';
import {
  getUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getPosts,
  adminDeletePost,
  getReports,
  resolveReport,
  dismissReport,
  getAnalyticsOverview,
  getTimeSeries,
  getTopUsers,
  getTopPosts,
} from '@/controllers';
import { authenticate, authorize, validate } from '@/middleware';
import { userFiltersSchema, updateStatusSchema, reportFiltersSchema, resolveReportSchema } from '@/validators';

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

// Users
router.get('/users', validate(userFiltersSchema), getUsers);
router.patch('/users/:userId/status', validate(updateStatusSchema), updateUserStatus);
router.patch('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);

// Posts
router.get('/posts', getPosts);
router.delete('/posts/:postId', adminDeletePost);

// Reports
router.get('/reports', validate(reportFiltersSchema), getReports);
router.patch('/reports/:reportId/resolve', validate(resolveReportSchema), resolveReport);
router.patch('/reports/:reportId/dismiss', dismissReport);

// Analytics
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics/time-series', getTimeSeries);
router.get('/analytics/top-users', getTopUsers);
router.get('/analytics/top-posts', getTopPosts);

export default router;
