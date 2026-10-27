import { db } from '../config/db';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('🌱 Starting database seeding...');
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Create Custom ENUM Types if they don't exist
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'EXPIRED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 2. Create Schema Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role DEFAULT 'STUDENT',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price_ngn DECIMAL(10, 2) NOT NULL,
        instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        order_index INT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        cloudinary_public_id VARCHAR(255) NOT NULL,
        order_index INT NOT NULL,
        passing_score INT DEFAULT 70
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        access_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        access_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        grace_period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        status enrollment_status DEFAULT 'ACTIVE',
        UNIQUE(student_id, course_id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        course_id UUID REFERENCES courses(id),
        reference VARCHAR(255) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status payment_status DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS lesson_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
        is_completed BOOLEAN DEFAULT FALSE,
        score INT DEFAULT 0,
        attempts INT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, lesson_id)
      );
    `);

    // 3. Insert Admin & Instructor Users
    const adminPassword = await bcrypt.hash('AdminPassword123!', 10);
    const adminUser = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ('System Admin', 'admin@selahtech.com', $1, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [adminPassword]
    );

    const instructorId = adminUser.rows[0].id;

    // 4. Insert Demo Course
    const courseRes = await client.query(
      `INSERT INTO courses (title, description, price_ngn, instructor_id)
       VALUES ('Backend Development with Node.js & PostgreSQL', 'Comprehensive backend engineering course with TypeScript and Docker.', 50000.00, $1)
       RETURNING id`,
      [instructorId]
    );
    const courseId = courseRes.rows[0].id;

    // 5. Insert Module & Lessons
    const moduleRes = await client.query(
      `INSERT INTO modules (course_id, title, order_index)
       VALUES ($1, 'Module 1: Getting Started', 1)
       RETURNING id`,
      [courseId]
    );
    const moduleId = moduleRes.rows[0].id;

    await client.query(
      `INSERT INTO lessons (module_id, title, cloudinary_public_id, order_index, passing_score)
       VALUES 
         ($1, 'Lesson 1.1: Node.js & Architecture', 'selah/node_intro_v1', 1, 70),
         ($1, 'Lesson 1.2: PostgreSQL & Relational Design', 'selah/postgres_intro_v1', 2, 70)`,
      [moduleId]
    );

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();