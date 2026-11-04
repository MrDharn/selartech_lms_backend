import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index';

export const requireRole = (allowedRoles: Array<'STUDENT' | 'INSTRUCTOR' | 'ADMIN'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction):void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthenticated' });
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Access forbidden: Insufficient permissions' });
      return
    }

    next();
  };
};