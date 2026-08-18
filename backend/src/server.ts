import './config/env';
import app from './app';
import authService from './services/authService';
import prisma from './database/prisma';

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` SpendSense API running on port ${PORT} `);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'} `);
  console.log(`=========================================`);
});

/**
 * Expired and long-revoked refresh tokens are swept periodically.
 *
 * Rotation marks tokens rather than deleting them so replays stay detectable,
 * which means the table grows with every refresh — one row per rotation, per
 * device, forever. This is deliberately in server.ts rather than app.ts: the
 * integration suites import the app directly and must not inherit a timer that
 * keeps the process alive.
 */
const TOKEN_PURGE_INTERVAL_MS = 12 * 60 * 60 * 1000;

const purgeTokens = async () => {
  try {
    const removed = await authService.purgeStaleTokens();
    if (removed > 0) {
      console.log(`[auth] Purged ${removed} expired/revoked refresh token(s)`);
    }
  } catch (error) {
    // A failed sweep is not worth taking the process down for.
    console.error('[auth] Refresh token purge failed:', error);
  }
};

void purgeTokens();
const purgeTimer = setInterval(purgeTokens, TOKEN_PURGE_INTERVAL_MS);
// Do not hold the event loop open purely for the sweep.
purgeTimer.unref();

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully...');
  clearInterval(purgeTimer);
  server.close(async () => {
    console.log('Closed out remaining connections.');
    // Release the connection pool so Postgres is not left holding sessions.
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
