import { Router } from 'express';
import {
  getCourses,
  getCourseById,
  createCourse,
  createModule,
  createLesson,
} from '../controllers/course.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();

// Public routes
router.get('/', getCourses);
router.get('/:id', getCourseById);

// Protected Instructor/Admin routes
router.post('/', authenticateToken, requireRole(['INSTRUCTOR', 'ADMIN']), createCourse);
router.post('/modules', authenticateToken, requireRole(['INSTRUCTOR', 'ADMIN']), createModule);
router.post('/lessons', authenticateToken, requireRole(['INSTRUCTOR', 'ADMIN']), createLesson);

export default router;