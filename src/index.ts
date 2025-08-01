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

// ✅ Logger middleware
app.use('*', logger());

// ✅ Enhanced CORS config for Google Sign-In
app.use('*', cors({
  origin: [
    'https://lockin-edge.vercel.app',
    'https://accounts.google.com',
    'https://accounts.google.com/gsi',
    'https://google.com'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

// ✅ Security headers optimized for Google Sign-In
app.use('*', async (c, next) => {
  // Allow Google Sign-In iframes and postMessage
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  c.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Content Security Policy that allows Google Sign-In
  c.header('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com; " +
    "frame-src 'self' https://accounts.google.com; " +
    "connect-src 'self' https://accounts.google.com https://lockinedge-backend-8.onrender.com; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline' https://accounts.google.com;"
  );
  
  // Additional security headers
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  await next();
});

// ✅ Specific route for Google OAuth (add this if not exists)
app.post('/auth/google', async (c) => {
  // Your Google OAuth handler logic here
  // This should match the endpoint your frontend is calling
  return c.json({ message: 'Google OAuth endpoint' });
});

// ✅ Test route
app.get('/', (c) => c.text('✅ Server is running on Render. Hello from Hono!'));

// ✅ Application routes
app.route('/auth', authRoutes);
app.route('/resume', resumeRoutes);
app.route('/', jobRoutes);

// ✅ Error handling
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

// ✅ 404 handler
app.notFound((c) => c.json({ error: 'Route not found' }, 404));

// ✅ Start server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server is running on http://localhost:${info.port}`);
  console.log(`🌍 Public URL: https://lockinedge-backend-8.onrender.com`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});