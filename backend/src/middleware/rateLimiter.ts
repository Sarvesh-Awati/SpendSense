import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate-limit key for an authenticated-but-possibly-anonymous request.
 *
 * Prefers the user id. Falls back to the IP — but via `ipKeyGenerator`, which
 * collapses an IPv6 address to its /64 prefix. Using the raw address would let
 * an IPv6 client bypass every limit below simply by rotating through the
 * addresses in its own subnet, of which it typically has 2^64.
 */
const userOrIpKey = (req: { user?: { id: string }; ip?: string }): string =>
  req.user?.id ?? (req.ip ? ipKeyGenerator(req.ip) : 'anonymous');

// Rate limiter for authentication endpoints to prevent brute-force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per `window`
  // Integration tests drive dozens of auth requests from a single address.
  // Gated strictly on NODE_ENV=test, which is operator-controlled — this can
  // never be turned off by a client.
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Limiter for endpoints that spend money or hold a request open on a third
 * party — currently the Gemini-backed receipt scanner.
 *
 * Keyed per authenticated user rather than per IP: these routes sit behind the
 * auth guard, and one user on a shared NAT must not exhaust everyone's budget.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: userOrIpKey,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many AI requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for authenticated credential operations (password change).
 * `currentPassword` is a guessable secret, so this endpoint is a brute-force
 * target even though it sits behind a bearer token.
 */
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: userOrIpKey,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default authLimiter;
