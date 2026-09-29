import { defineMiddleware } from 'astro:middleware';
import { startScheduler } from './lib/scheduler';

// Background jobs start with the first request the server handles (idempotent)
export const onRequest = defineMiddleware((_context, next) => {
  startScheduler();
  return next();
});
