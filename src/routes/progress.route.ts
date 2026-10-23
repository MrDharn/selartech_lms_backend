import { Router } from 'express';
import { submitAssessment, getCourseProgress } from '../controllers/progress.controller';
import { streamLessonVideo } from '../controllers/video.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Submit quiz score & check completion status
router.post('/assessment/submit', submitAssessment);

// Get student's overall progress & lesson lock states for a course
router.get('/course/:courseId', getCourseProgress);

// Stream authenticated signed Cloudinary video URL (verifies sequential prerequisite pass)
router.get('/lessons/:lessonId/video', streamLessonVideo);

export default router;