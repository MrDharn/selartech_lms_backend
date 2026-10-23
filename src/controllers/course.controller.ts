import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../types';

// Public: Get all available courses
export const getCourses = async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.title, c.description, c.price_ngn, u.full_name AS instructor_name
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       ORDER BY c.created_at DESC`
    );

    return res.status(200).json(result.rows);

  } catch (error) {
    
    console.error('Error fetching courses:', error);
    
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Public/Student: Get detailed course syllabus with modules and lessons
export const getCourseById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const courseResult = await db.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const course = courseResult.rows[0];

    const modulesResult = await db.query(
      `SELECT m.id AS module_id, m.title AS module_title, m.order_index AS module_order,
              l.id AS lesson_id, l.title AS lesson_title, l.order_index AS lesson_order, l.passing_score
       FROM modules m
       LEFT JOIN lessons l ON l.module_id = m.id
       WHERE m.course_id = $1
       ORDER BY m.order_index ASC, l.order_index ASC`,
      [id]
    );

    // Group lessons under their respective modules
    const modulesMap: Record<string, any> = {};

    modulesResult.rows.forEach((row) => {
      if (!modulesMap[row.module_id]) {
        modulesMap[row.module_id] = {
          id: row.module_id,
          title: row.module_title,
          order: row.module_order,
          lessons: [],
        };
      }
      if (row.lesson_id) {
        modulesMap[row.module_id].lessons.push({
          id: row.lesson_id,
          title: row.lesson_title,
          order: row.lesson_order,
          passing_score: row.passing_score,
        });
      }
    });

    return res.status(200).json({
      ...course,
      modules: Object.values(modulesMap),
    });
  } catch (error) {
    console.error('Error fetching course details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Instructor/Admin: Create a new course
export const createCourse = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, price_ngn } = req.body;
  const instructorId = req.user?.id;

  if (!title || price_ngn === undefined) {
    return res.status(400).json({ message: 'Title and price_ngn are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO courses (title, description, price_ngn, instructor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, description, price_ngn, instructorId]
    );

    return res.status(201).json({
      message: 'Course created successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating course:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Instructor/Admin: Add module to course
export const createModule = async (req: Request, res: Response) => {
  const { course_id, title, order_index } = req.body;

  if (!course_id || !title || order_index === undefined) {
    return res.status(400).json({ message: 'course_id, title, and order_index are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO modules (course_id, title, order_index)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [course_id, title, order_index]
    );

    return res.status(201).json({
      message: 'Module created successfully',
      module: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating module:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Instructor/Admin: Add lesson to module
export const createLesson = async (req: Request, res: Response) => {
  const { module_id, title, cloudinary_public_id, order_index, passing_score } = req.body;

  if (!module_id || !title || !cloudinary_public_id || order_index === undefined) {
    return res.status(400).json({ message: 'module_id, title, cloudinary_public_id, and order_index are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO lessons (module_id, title, cloudinary_public_id, order_index, passing_score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [module_id, title, cloudinary_public_id, order_index, passing_score || 70]
    );

    return res.status(201).json({
      message: 'Lesson created successfully',
      lesson: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating lesson:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};