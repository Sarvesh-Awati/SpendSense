import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { AppError } from '../errors/AppError';

/**
 * Global error handler.
 *
 * SECURITY: responses must never carry internal detail — Prisma messages
 * embed absolute filesystem paths and source excerpts, and stack traces and
 * SMTP configuration are equally unsafe to return. Everything unrecognised
 * is logged in full server-side and answered with a generic 500 carrying a
 * correlation id the operator can grep for.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. Operational errors we raised deliberately — their messages are written
  //    for users and are safe to return verbatim.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
    });
    return;
  }

  // 2. Known Prisma request errors — map the codes we can answer meaningfully.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        status: 'error',
        statusCode: 409,
        message: 'A record with this field already exists',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Resource not found',
      });
      return;
    }
    // P2023 — "Inconsistent column data", raised when a client supplies a
    // malformed value for a typed column (most often a non-UUID :id). This is
    // bad input, not a server fault. The raw message embeds the source path
    // and a code excerpt, so it is logged and never returned.
    if (err.code === 'P2023') {
      console.error('🔥 Prisma malformed input (P2023):', err.message);
      res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Invalid request parameters',
      });
      return;
    }
  }

  // 3. Prisma validation errors are caused by malformed client input (most
  //    often a non-UUID :id). They are a 400, and their message must never be
  //    echoed — it contains the source path and a code excerpt.
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('🔥 Prisma validation error:', err.message);
    res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Invalid request parameters',
    });
    return;
  }

  // 4. Upload errors — surface the size limit as a 400 rather than a 500.
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum size is 5 MB.'
        : 'File upload failed. Please check the file and try again.';
    res.status(400).json({ status: 'error', statusCode: 400, message });
    return;
  }

  // 5. Oversize JSON body. body-parser raises this with `type` set; it is bad
  //    input, not a server fault, and must not read as a 500.
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      status: 'error',
      statusCode: 413,
      message: 'Request body is too large.',
    });
    return;
  }

  // 6. Malformed JSON body. Same reasoning — a client typo is a 400.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Request body is not valid JSON.',
    });
    return;
  }

  // 7. Rejected by the CORS allowlist. A 403 states the policy plainly; the
  //    allowlist itself is never disclosed.
  if (err.message === 'Origin not allowed by CORS policy') {
    res.status(403).json({
      status: 'error',
      statusCode: 403,
      message: 'Origin not allowed.',
    });
    return;
  }

  // 8. Anything else is an unexpected fault. Log it in full, return nothing
  //    about it — in ANY environment, not just production.
  const correlationId = Math.random().toString(36).slice(2, 10);
  console.error(`🔥 Unexpected Error [${correlationId}] ${req.method} ${req.originalUrl}:`, err);

  res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: 'Internal Server Error',
    correlationId,
  });
};
export default errorHandler;
