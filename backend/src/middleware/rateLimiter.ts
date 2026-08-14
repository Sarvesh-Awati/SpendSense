import rateLimit from 'express-rate-limit';

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
export default authLimiter;
