import { AuthService } from './auth.service.js';
export const authenticateToken = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        return c.json({
            success: false,
            message: 'Access token required',
        }, 401);
    }
    try {
        const decoded = await AuthService.verifyToken(token);
        // Set user data in context
        c.set('userId', decoded.userId);
        c.set('userEmail', decoded.email);
        await next();
    }
    catch (error) {
        console.error('Token verification error:', error);
        return c.json({
            success: false,
            message: 'Invalid or expired token',
        }, 403);
    }
};
export const optionalAuth = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        await next();
        return;
    }
    try {
        const decoded = await AuthService.verifyToken(token);
        // Set user data in context
        c.set('userId', decoded.userId);
        c.set('userEmail', decoded.email);
    }
    catch (error) {
        // Token is invalid but we continue anyway since auth is optional
        console.warn('Optional auth token verification failed:', error);
    }
    await next();
};
