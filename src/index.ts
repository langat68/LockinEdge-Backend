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

// Logger
app.use('*', logger());

// ✅ Environment-aware CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://lockin-edge.vercel.app',  // Production frontend
      process.env.FRONTEND_URL,          // From environment variable
    ].filter(Boolean)
  : [
      'http://localhost:5173',           // Vite dev server
      'http://localhost:3000',           // Same origin (for testing)
      'https://lockin-edge.vercel.app',  // Also allow production in dev for testing
    ];

app.use('*', cors({
  origin: allowedOrigins, // ✅ Simple array approach
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true, // ✅ Important for OAuth flows
  exposeHeaders: ['Set-Cookie'], // ✅ If you're using cookies
}));

// ✅ Add specific headers for OAuth/popup handling
app.use('*', async (c, next) => {
  // Set COOP header to allow popups to communicate
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  c.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  await next();
});

// Routes
app.get('/', (c) => c.text('✅ Server is running. Hello Hono!'));
app.route('/auth', authRoutes);
app.route('/resume', resumeRoutes);
app.route('/', jobRoutes);

// Error Handling
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

// 404
app.notFound((c) => c.json({ error: 'Route not found' }, 404));

// Start
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server is running on http://localhost:${info.port}`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Allowed origins:`, allowedOrigins);
});