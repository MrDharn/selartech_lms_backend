import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
// console.log("Your DB connection String is: ", process.env.JWT_SECRET ?  'FOUND' : "NOT FOUND")
// console.log(process.cwd())

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