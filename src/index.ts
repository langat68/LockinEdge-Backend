import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

import authRoutes from './modules/auth/auth.route.js';
import resumeRoutes from './modules/resumes/resume.route.js';
import { jobRoutes } from './modules/jobs/jobs.route.js';
import './scheduler.js';

const app = new Hono();

// Logger middleware
app.use('*', logger());

// ✅ CORS config for deployed frontend on Vercel
app.use('*', cors({
  origin: ['https://lockin-edge.vercel.app'], // ✅ Only allow your Vercel frontend
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // ✅ Needed for cookies or Google OAuth
}));

// Basic route for testing
app.get('/', (c) => c.text('✅ Server is running on Render. Hello from Hono!'));

// Application routes
app.route('/auth', authRoutes);
app.route('/resume', resumeRoutes);
app.route('/', jobRoutes);

// Error handling
app.onError((err, c) => {
  console.error('Server Error:', err);
  if (err.name === 'ValidationError') {
    return c.json({ error: 'Validation failed', details: err.message }, 400);
  }
  if (err.name === 'UnauthorizedError') {
    return c.json({ error: 'Unauthorized access' }, 401);
  }
  return c.json({ error: 'Internal server error' }, 500);
});

// 404 Not Found handler
app.notFound((c) => c.json({ error: 'Route not found' }, 404));

// Start the server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server is running on http://localhost:${info.port}`);
  console.log(`🌍 Public URL: https://lockinedge-backend-8.onrender.com`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
