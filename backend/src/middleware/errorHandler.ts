import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If the error is an operational, custom AppError, send structured response
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
    });
    return;
  }

  // Handle default Prisma exceptions (e.g. unique constraint, entity missing)
  // Prisma errors can be mapped here to keep responses clean.
  if (err.name === 'PrismaClientKnownRequestError') {
    // We can cast here or handle P2002 (Unique constraint)
    const code = (err as any).code;
    if (code === 'P2002') {
      res.status(409).json({
        status: 'error',
        statusCode: 409,
        message: 'A record with this field already exists',
      });
      return;
    }
  }

  // Unexpected programmer bugs or system faults (e.g., db socket timeouts)
  console.error('🔥 Unexpected Error:', err);

  res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
};
export default errorHandler;
