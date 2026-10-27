import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index';

export const requireRole = (allowedRoles: Array<'STUDENT' | 'INSTRUCTOR' | 'ADMIN'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access forbidden: Insufficient permissions' });
    }

    next();
  };
};