import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import errorHandler from './middleware/errorHandler';

const app = express();

// Standard Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Mount Authentication Routes
app.use('/api/auth', authRoutes);

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
