import { z } from 'zod';

/**
 * Shared `:id` path-parameter schema.
 *
 * Every resource id in this application is a UUID. Without this, a malformed
 * id travelled all the way to Postgres and came back as a Prisma error that
 * the global handler could only turn into a generic 400 — correct, but the
 * client learned nothing, and the failure was logged as though the server had
 * misbehaved. Validating at the edge makes it an ordinary, described 400.
 */
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Resource ID must be a valid UUID' }),
  }),
});

/**
 * Combines the `:id` param check with a body schema so a route can validate
 * both in a single `validate()` call.
 */
export function withIdParam<T extends z.ZodRawShape>(bodySchema: z.ZodObject<T>) {
  return z.object({
    params: idParamSchema.shape.params,
    body: bodySchema,
  });
}
