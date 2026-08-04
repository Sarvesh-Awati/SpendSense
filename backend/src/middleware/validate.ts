import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Only reassign properties that the schema explicitly defined.
      // If a schema doesn't define `params` or `query`, the parsed result
      // will be `undefined` for those keys — we must NOT overwrite Express's
      // populated req.params/query with undefined.
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorDetails = error.errors.map((err) => ({
          field: err.path.join('.').replace(/^body\.|^query\.|^params\./, ''),
          message: err.message,
        }));

        res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Validation failed',
          errors: errorDetails,
        });
        return;
      }
      return next(error);
    }
  };
};

export default validate;
