import { Request, Response } from 'express';
import { db } from '../config/db';

// 1. Overview Dashboard Metrics
export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') AS total_students,
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM enrollments WHERE status = 'ACTIVE') AS active_enrollments,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'SUCCESSFUL') AS total_revenue_ngn
    `;

    const result = await db.query(statsQuery);
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// 2. Course-wise Enrollment & Completion Metrics
export const getCourseAnalytics = async (_req: Request, res: Response) => {
  try {
    const analyticsQuery = `
      SELECT 
        c.id AS course_id,
        c.title AS course_title,
        COUNT(DISTINCT e.student_id) AS total_enrolled,
        COUNT(DISTINCT CASE WHEN e.status = 'ACTIVE' THEN e.student_id END) AS active_students,
        COUNT(DISTINCT CASE WHEN e.status = 'EXPIRED' THEN e.student_id END) AS expired_students,
        COALESCE(SUM(p.amount), 0) AS revenue_generated
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id
      LEFT JOIN payments p ON p.course_id = c.id AND p.status = 'SUCCESSFUL'
      GROUP BY c.id, c.title
      ORDER BY total_enrolled DESC
    `;

    const result = await db.query(analyticsQuery);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching course analytics:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// 3. Manual Enrollment Override (Grant/Revoke Access)
export const manageEnrollmentOverride = async (req: Request, res: Response) => {
  const { student_id, course_id, action } = req.body; // action: 'GRANT' | 'REVOKE'

  if (!student_id || !course_id || !action) {
    return res.status(400).json({ message: 'student_id, course_id, and action are required' });
  }

  try {
    if (action === 'GRANT') {
      const startDate = new Date();
      const accessEndDate = new Date(startDate);
      accessEndDate.setMonth(accessEndDate.getMonth() + 3);

      const gracePeriodEndDate = new Date(startDate);
      gracePeriodEndDate.setMonth(gracePeriodEndDate.getMonth() + 4);

      await db.query(
        `INSERT INTO enrollments (student_id, course_id, access_start_date, access_end_date, grace_period_end_date, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (student_id, course_id)
         DO UPDATE SET status = 'ACTIVE', access_end_date = EXCLUDED.access_end_date, grace_period_end_date = EXCLUDED.grace_period_end_date`,
        [student_id, course_id, startDate, accessEndDate, gracePeriodEndDate]
      );

      return res.status(200).json({ message: 'Enrollment granted successfully' });
    } else if (action === 'REVOKE') {
      await db.query(
        `UPDATE enrollments SET status = 'EXPIRED' WHERE student_id = $1 AND course_id = $2`,
        [student_id, course_id]
      );

      return res.status(200).json({ message: 'Enrollment revoked successfully' });
    }

    return res.status(400).json({ message: 'Invalid action parameter' });
  } catch (error) {
    console.error('Error managing enrollment override:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};