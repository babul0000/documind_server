import { Request, Response, NextFunction } from 'express';

/**
 * Global Express Error Handling Middleware.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Global Error Captured:', err.stack || err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const errorMessage = err.message || 'An unexpected server error occurred';

  res.status(statusCode).json({
    error: errorMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
