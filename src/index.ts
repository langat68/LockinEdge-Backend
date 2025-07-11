
import 'dotenv/config';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

// Import your routes
import authRoutes from './modules/auth/auth.route.js';
import resumeRoutes from './modules/resumes/resume.route.js';
import { jobRoutes } from './modules/jobs/jobs.route.js';
import './scheduler.js';

const app = new Hono();

// 🌟 Middlewares
app.use('*', logger());
app.use('*', cors()); // Enable CORS for all routes

// 🌟 Health check endpoint
app.get('/', (c) => {
  return c.text('✅ Server is running. Hello Hono!');
});

// 🌟 Mount your feature routes
app.route('/auth', authRoutes);
app.route('/resume', resumeRoutes);
app.route('/', jobRoutes);

// 🌟 Start the server
serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`🚀 Server is running on http://localhost:${info.port}`);
  }
);
