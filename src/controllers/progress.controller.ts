import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../types';

// Submit quiz assessment and evaluate passing grade
export const submitAssessment = async (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.id;
  const { lesson_id, score } = req.body;

  if (!lesson_id || score === undefined) {
    return res.status(400).json({ message: 'lesson_id and score are required' });
  }

  try {
    // 1. Fetch lesson requirements
    const lessonResult = await db.query(
      'SELECT id, passing_score FROM lessons WHERE id = $1',
      [lesson_id]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const lesson = lessonResult.rows[0];
    const isPassed = score >= lesson.passing_score;

    // 2. Upsert assessment attempt & progress status
    const progressResult = await db.query(
      `INSERT INTO lesson_progress (student_id, lesson_id, is_completed, score, attempts, updated_at)
       VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, lesson_id) 
       DO UPDATE SET 
         score = GREATEST(lesson_progress.score, EXCLUDED.score),
         is_completed = CASE WHEN EXCLUDED.is_completed THEN TRUE ELSE lesson_progress.is_completed END,
         attempts = lesson_progress.attempts + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [studentId, lesson_id, isPassed, score]
    );

    const updatedProgress = progressResult.rows[0];

    return res.status(200).json({
      message: isPassed ? 'Assessment passed! Next lesson unlocked.' : 'Assessment score below passing threshold. Please retry.',
      passed: isPassed,
      passing_score: lesson.passing_score,
      progress: updatedProgress,
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get current progress for a specific course (showing locked/unlocked state per lesson)
export const getCourseProgress = async (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.id;
  const { courseId } = req.params;

  try {
    const progressQuery = `
      SELECT 
        l.id AS lesson_id,
        l.title AS lesson_title,
        l.order_index AS lesson_order,
        m.id AS module_id,
        m.title AS module_title,
        m.order_index AS module_order,
        COALESCE(lp.is_completed, FALSE) AS is_completed,
        COALESCE(lp.score, 0) AS score,
        COALESCE(lp.attempts, 0) AS attempts
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
      WHERE m.course_id = $2
      ORDER BY m.order_index ASC, l.order_index ASC
    `;

    const result = await db.query(progressQuery, [studentId, courseId]);
    const lessons = result.rows;

    // Determine lock state dynamically based on previous lesson completion
    let unlockNext = true;
    const mappedProgress = lessons.map((item) => {
      const isUnlocked = unlockNext;
      // Next lesson is unlocked only if current lesson is completed
      unlockNext = item.is_completed;

      return {
        ...item,
        is_unlocked: isUnlocked,
      };
    });

    return res.status(200).json({
      course_id: courseId,
      lessons: mappedProgress,
    });
  } catch (error) {
    console.error('Error fetching course progress:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};