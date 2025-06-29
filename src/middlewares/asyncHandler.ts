import { Request, Response, NextFunction } from 'express';

/**
 * Async Handler Wrapper
 *
 * This wrapper catches async errors and passes them to Express error handler
 * automatically, eliminating the need for try/catch blocks in every async route.
 *
 * @param fn - Async function to wrap
 * @returns Express middleware function
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
