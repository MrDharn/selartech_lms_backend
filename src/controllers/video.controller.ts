import { Response } from 'express';
import { db } from '../config/db';
import cloudinary from '../config/cloudinary';
import { AuthenticatedRequest } from '../types';

export const streamLessonVideo = async (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.id;
  const { lessonId } = req.params;

  try {
    // 1. Verify Enrollment & Access Expiration (3 Months + 1 Month Grace Period)
    const enrollmentQuery = `
      SELECT e.status, e.access_end_date, e.grace_period_end_date 
      FROM enrollments e
      JOIN modules m ON m.course_id = e.course_id
      JOIN lessons l ON l.module_id = m.id
      WHERE e.student_id = $1 AND l.id = $2
    `;
    const enrollmentRes = await db.query(enrollmentQuery, [studentId, lessonId]);

    if (enrollmentRes.rows.length === 0) {
      return res.status(403).json({ message: 'You are not enrolled in the course for this lesson.' });
    }

    const enrollment = enrollmentRes.rows[0];
    const now = new Date();

    if (now > new Date(enrollment.grace_period_end_date)) {
      return res.status(403).json({ 
        message: 'Your access and grace period for this course have expired. Please re-enroll.' 
      });
    }

    // 2. Enforce Sequential Progression (Check if previous lesson in module was passed)
    const prevLessonQuery = `
      SELECT id FROM lessons 
      WHERE module_id = (SELECT module_id FROM lessons WHERE id = $1)
        AND order_index < (SELECT order_index FROM lessons WHERE id = $1)
      ORDER BY order_index DESC 
      LIMIT 1
    `;
    const prevLessonRes = await db.query(prevLessonQuery, [lessonId]);

    if (prevLessonRes.rows.length > 0) {
      const prevLessonId = prevLessonRes.rows[0].id;
      const progressQuery = `
        SELECT is_completed 
        FROM lesson_progress 
        WHERE student_id = $1 AND lesson_id = $2
      `;
      const progressRes = await db.query(progressQuery, [studentId, prevLessonId]);

      if (progressRes.rows.length === 0 || !progressRes.rows[0].is_completed) {
        return res.status(403).json({ 
          message: 'Access restricted: You must complete and pass the previous lesson before unlocking this video.' 
        });
      }
    }

    // 3. Retrieve Cloudinary Public ID and Generate Authenticated Signed URL
    const lessonRes = await db.query('SELECT cloudinary_public_id, title FROM lessons WHERE id = $1', [lessonId]);
    if (lessonRes.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const lesson = lessonRes.rows[0];
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Generate signed URL valid for 1 hour (3600 seconds)
    const signedUrl = cloudinary.url(lesson.cloudinary_public_id, {
      resource_type: 'video',
      type: 'authenticated',
      sign_url: true,
      expires_at: timestamp + 3600,
    });

    return res.status(200).json({
      lesson_id: lessonId,
      title: lesson.title,
      video_url: signedUrl,
      expires_at: timestamp + 3600,
    });
  } catch (error) {
    console.error('Error authorizing video stream:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};