import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/AppError';

/**
 * Express middleware to authenticate users using JWT bearer tokens.
 */
export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  // 1. Verify existence of authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token is missing or invalid');
  }

  // 2. Extract JWT token string
  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Access token is missing or invalid');
  }

  // 3. Verify access token signature
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    throw new UnauthorizedError('Access token is missing or invalid');
  }

  // 4. Attach decoded token properties to request user object
  req.user = {
    id: decoded.userId,
    email: decoded.email,
  };

  return next();
};

export default authenticateUser;
