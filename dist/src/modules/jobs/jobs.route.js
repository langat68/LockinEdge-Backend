// routes/job.routes.ts
import { Hono } from 'hono';
import { jobController } from './jobs.controller.js';
export const jobRoutes = new Hono();
// Mount all routes under /jobs
jobRoutes.route('/', jobController);
