import { Hono } from 'hono';
import { AuthController } from './auth.controller.js';
import { authenticateToken } from '../auth/auth.middleware.js';

const app = new Hono();

// Public routes
app.post('/register', AuthController.register);
app.post('/login', AuthController.login);
app.post('/logout', AuthController.logout);

// Protected routes
app.get('/profile', authenticateToken, AuthController.getProfile);
app.put('/password', authenticateToken, AuthController.updatePassword);

export default app;