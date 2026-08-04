import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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

const app = express();

// Standard Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

// Basic Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'SpendSense API is running smoothly'
  });
});

// Global 404 Route handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Register Global Error Handler (Must be registered after all routes/middleware)
app.use(errorHandler);

export default app;
