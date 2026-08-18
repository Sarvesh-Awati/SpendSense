import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env, { allowedOrigins } from './config/env';
import prisma from './database/prisma';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import transactionRoutes from './routes/transactionRoutes';
import categoryRoutes from './routes/categoryRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import budgetRoutes from './routes/budgetRoutes';
import goalRoutes from './routes/goalRoutes';
import receiptRoutes from './routes/receiptRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import errorHandler from './middleware/errorHandler';

// Read version from package.json at startup (avoids hardcoding)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json');

const app = express();

/**
 * The API runs behind a reverse proxy in production (Render/Vercel/Nginx).
 * Without this, `req.ip` is the proxy's address for every request, so the
 * auth rate limiter puts the entire internet in one bucket — a single noisy
 * client would lock everyone out, and a brute-force attempt would be
 * indistinguishable from ordinary traffic.
 *
 * `1` trusts exactly one hop. Trusting every hop (`true`) would let a client
 * forge `X-Forwarded-For` and evade the limiter entirely.
 */
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Standard Security & Utility Middlewares
app.use(helmet());

/**
 * CORS is an explicit allowlist — never a wildcard.
 *
 * Requests with no Origin header (server-to-server, curl, health probes, and
 * the integration suite's same-process fetch) are allowed through: CORS is a
 * browser control and has nothing to enforce when there is no origin.
 */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
  })
);

/**
 * Body size ceiling. Profile pictures arrive as base64 data URLs, so the limit
 * cannot be tiny — but it must exist, or a single request can pin the process
 * parsing JSON. Oversize bodies surface as 413 via the error handler.
 */
app.use(express.json({ limit: '2mb' }));

// Request logging: concise in production, verbose in development.
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Mount Core Router Modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root API Landing — provides service discovery for bots, load balancers, and developers
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'SpendSense API',
    version,
    status: 'Running',
    environment: env.NODE_ENV,
    health: '/health',
  });
});

/**
 * Health check for load balancers and deployment gates.
 *
 * A process that is listening but cannot reach its database is not healthy —
 * reporting `ok` there would let a broken release pass a rollout check. The
 * probe therefore round-trips to Postgres and answers 503 when that fails.
 * The failure reason is logged, never returned: it can carry connection detail.
 */
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('🔥 Health check failed — database unreachable:', error);
    res.status(503).json({
      status: 'error',
      database: 'unreachable',
      timestamp: new Date().toISOString(),
    });
  }
});

// Global 404 Route handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Register Global Error Handler (Must be registered after all routes/middleware)
app.use(errorHandler);

export default app;
