import { Request } from 'express';

export interface TokenPayload {
  id: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}