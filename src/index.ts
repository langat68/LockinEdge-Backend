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

// ✅ Add security headers for Google Sign-In
app.use('*', async (c, next) => {
  // Set COOP header to allow Google popup communication
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // Optional: Add other security headers
  c.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  await next();
});

// ✅ CORS — explicitly allow frontend origins
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'https://lockin-edge.vercel.app', 
      ];
      if (origin && allowedOrigins.includes(origin)) {
        return origin; // ✅ allow this origin
      }
      return null; // 🚫 block if not allowed
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
    credentials: true, // ✅ Important for Google Sign-In
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