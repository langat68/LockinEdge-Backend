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

// ✅ Log all requests with method, path, and response status
app.use('*', logger());

// ✅ Simple CORS configuration - similar to your working QuickRide setup
app.use(
  '*',
  cors({
    origin: [
      'https://lockin-edge.vercel.app',
      'https://accounts.google.com',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ✅ Root route for testing
app.get('/', (c) => c.text('✅ Server is running on Render. Hello from Hono! 🚀'));

// ✅ Health check route
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ Mount route groups
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

// ✅ Start server - Use PORT from .env or default to 3000
const PORT = Number(process.env.PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`✅ Server running at: http://localhost:${info.port}`);
    console.log(`🌐 Public URL: https://lockinedge-backend-8.onrender.com`);
    console.log(`🔐 CORS enabled for:`, [
      'https://lockin-edge.vercel.app',
      'https://accounts.google.com',
      'http://localhost:3000',
      'http://localhost:5173'
    ]);
    console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  }
);