
// src/types/express.d.ts
import { TokenPayload } from '../types'; // Adjust this path to your types file

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
