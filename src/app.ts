import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoute from './routes/auth.route'
import courseRoute from './routes/course.route'
dotenv.config();

const app: Application = express();

app.use(cors());

// Webhook route requires raw body parsing or signature validation before standard JSON parsing

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.use('/api/v1/auth', authRoute);
app.use('/api/v1/courses', courseRoute);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;