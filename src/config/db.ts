import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

db.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

db.on('error', (err) => {
  console.error('Unexpected database error', err);
  process.exit(-1);
});