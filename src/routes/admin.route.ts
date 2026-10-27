import { Router } from 'express';
import {
  getDashboardStats,
  getCourseAnalytics,
  manageEnrollmentOverride,
} from '../controllers/admin.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

router.get('/stats', getDashboardStats);
router.get('/analytics/courses', getCourseAnalytics);
router.post('/enrollment/override', manageEnrollmentOverride);

export default router;