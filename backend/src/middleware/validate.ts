import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Assign the validated and parsed results back to request objects
      req.body = parsed.body;
      req.query = parsed.query;
      req.params = parsed.params;

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
