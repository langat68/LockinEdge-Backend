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

// ✅ Updated security headers for Google Sign-In
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  
  // Define your trusted frontend domains
  const trustedDomains = [
    'http://localhost:5173',
    'https://lockin-edge.vercel.app'
  ];
  
  // Check if request is from a trusted domain
  const isTrustedOrigin = origin && trustedDomains.includes(origin);
  const isTrustedReferer = referer && trustedDomains.some(domain => referer.startsWith(domain));
  
  if (isTrustedOrigin || isTrustedReferer) {
    // Relaxed policy for trusted domains (allows Google OAuth popups)
    c.header('Cross-Origin-Opener-Policy', 'unsafe-none');
  } else {
    // Strict policy for other domains
    c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  }
  
  // Keep your other headers
  c.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  
  await next();
});

// ✅ Enhanced CORS configuration
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'https://lockin-edge.vercel.app',
        // Add Google domains for OAuth
        'https://accounts.google.com',
        'https://oauth2.googleapis.com'
      ];
      
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return '*';
      
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      
      // Allow Google OAuth domains
      if (origin.includes('google.com') || origin.includes('googleapis.com')) {
        return origin;
      }
      
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
    ],
    exposeHeaders: ['Set-Cookie'],
    maxAge: 86400, // 24 hours
    credentials: true,
  })
);

// 🌟 Health check endpoint
app.get('/', (c) => {
  return c.text('✅ Server is running. Hello Hono!');
});

// 🌟 Mount your feature routes
app.route('/auth', authRoutes);
app.route('/resume', resumeRoutes);
app.route('/', jobRoutes);

// 🌟 Error handling middleware
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

// 🌟 404 handler
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404);
});

// 🌟 Start the server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

serve(
  {
    fetch: app.fetch,
    port: port,
  },
  (info) => {
    console.log(`🚀 Server is running on http://localhost:${info.port}`);
    console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  }
);