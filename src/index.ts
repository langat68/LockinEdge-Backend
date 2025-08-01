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
    'https://google.com',
    'http://localhost:3000',
    'http://localhost:5173'
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

// ✅ Security headers optimized for Google Sign-In (FIXED)
app.use('*', async (c, next) => {
  // 🔧 FIXED: Use unsafe-none to allow Google Sign-In popups
  c.header('Cross-Origin-Opener-Policy', 'unsafe-none');
  c.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // 🔧 UPDATED: More permissive CSP for Google Sign-In
  c.header('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://ssl.gstatic.com; " +
    "frame-src 'self' https://accounts.google.com https://content.googleapis.com; " +
    "connect-src 'self' https://accounts.google.com https://content.googleapis.com https://lockinedge-backend-8.onrender.com; " +
    "img-src 'self' data: https: https://ssl.gstatic.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  
  // Additional security headers
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  await next();
});

// ✅ Preflight OPTIONS handler for Google Sign-In
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': c.req.header('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
});

// ✅ Test route
app.get('/', (c) => c.text('✅ Server is running on Render. Hello from Hono!'));

// ✅ Health check route
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    google_signin: 'configured'
  });
});

// ✅ Application routes
app.route('/auth', authRoutes);
app.route('/resume', resumeRoutes);
app.route('/', jobRoutes);

// ✅ Error handling
app.onError((err, c) => {
  console.error('Server Error:', err);
  
  // Handle CORS errors specifically
  if (err.message.includes('CORS') || err.message.includes('Origin')) {
    return c.json({ 
      error: 'CORS error', 
      message: 'Cross-origin request blocked',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, 403);
  }
  
  if (err.name === 'ValidationError') {
    return c.json({ error: 'Validation failed', details: err.message }, 400);
  }
  
  if (err.name === 'UnauthorizedError') {
    return c.json({ error: 'Unauthorized access' }, 401);
  }
  
  return c.json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500);
});

// ✅ 404 handler
app.notFound((c) => c.json({ error: 'Route not found' }, 404));

// ✅ Start server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server is running on http://localhost:${info.port}`);
  console.log(`🌍 Public URL: https://lockinedge-backend-8.onrender.com`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Google Sign-In CORS configured`);
  console.log(`🔧 Cross-Origin-Opener-Policy: unsafe-none (Google Sign-In compatible)`);
});