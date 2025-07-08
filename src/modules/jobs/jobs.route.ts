import { Hono } from 'hono';
import { jobController } from './jobs.controller.js';

export const jobRoutes = new Hono();

jobRoutes.route('/jobs', jobController);
jobRoutes.post('/jobs/match/:resumeId', jobController.matchJobs);
