import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { message: err.message } });
    return;
  }

  console.error(err);
  res.status(500).json({ success: false, error: { message: 'Erro interno do servidor' } });
}
