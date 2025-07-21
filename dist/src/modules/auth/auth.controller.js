import { AuthService } from './auth.service.js';
import { registerSchema, loginSchema, updatePasswordSchema } from '../../validator.js';
import { z } from 'zod';
export class AuthController {
    static async register(c) {
        try {
            const body = await c.req.json();
            // Validate request body
            const validatedData = registerSchema.parse(body);
            // Create user
            const result = await AuthService.createUser(validatedData);
            return c.json({
                success: true,
                message: 'User created successfully',
                data: result,
            }, 201);
        }
        catch (error) {
            console.error('Registration error:', error);
            if (error instanceof z.ZodError) {
                return c.json({
                    success: false,
                    message: 'Validation error',
                    errors: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                }, 400);
            }
            if (error instanceof Error) {
                if (error.message === 'User already exists with this email') {
                    return c.json({
                        success: false,
                        message: error.message,
                    }, 409);
                }
            }
            return c.json({
                success: false,
                message: 'Internal server error',
            }, 500);
        }
    }
    static async login(c) {
        try {
            const body = await c.req.json();
            // Validate request body
            const validatedData = loginSchema.parse(body);
            // Login user
            const result = await AuthService.loginUser(validatedData);
            return c.json({
                success: true,
                message: 'Login successful',
                data: result,
            });
        }
        catch (error) {
            console.error('Login error:', error);
            if (error instanceof z.ZodError) {
                return c.json({
                    success: false,
                    message: 'Validation error',
                    errors: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                }, 400);
            }
            if (error instanceof Error) {
                if (error.message === 'Invalid credentials') {
                    return c.json({
                        success: false,
                        message: error.message,
                    }, 401);
                }
            }
            return c.json({
                success: false,
                message: 'Internal server error',
            }, 500);
        }
    }
    static async getProfile(c) {
        try {
            const userId = c.get('userId');
            if (!userId) {
                return c.json({
                    success: false,
                    message: 'Unauthorized',
                }, 401);
            }
            const user = await AuthService.getUserById(userId);
            return c.json({
                success: true,
                message: 'Profile retrieved successfully',
                data: { user },
            });
        }
        catch (error) {
            console.error('Get profile error:', error);
            if (error instanceof Error && error.message === 'User not found') {
                return c.json({
                    success: false,
                    message: error.message,
                }, 404);
            }
            return c.json({
                success: false,
                message: 'Internal server error',
            }, 500);
        }
    }
    static async updatePassword(c) {
        try {
            const userId = c.get('userId');
            if (!userId) {
                return c.json({
                    success: false,
                    message: 'Unauthorized',
                }, 401);
            }
            const body = await c.req.json();
            // Validate request body
            const validatedData = updatePasswordSchema.parse(body);
            // Use AuthService to verify current password and update
            const isUpdated = await AuthService.updatePasswordWithVerification(userId, validatedData.currentPassword, validatedData.newPassword);
            if (!isUpdated) {
                return c.json({
                    success: false,
                    message: 'Current password is incorrect',
                }, 400);
            }
            return c.json({
                success: true,
                message: 'Password updated successfully',
            });
        }
        catch (error) {
            console.error('Update password error:', error);
            if (error instanceof z.ZodError) {
                return c.json({
                    success: false,
                    message: 'Validation error',
                    errors: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                }, 400);
            }
            if (error instanceof Error && error.message === 'User not found') {
                return c.json({
                    success: false,
                    message: error.message,
                }, 404);
            }
            return c.json({
                success: false,
                message: 'Internal server error',
            }, 500);
        }
    }
    static async logout(c) {
        // Since we're using JWT, logout is handled client-side
        // You might want to implement a blacklist for tokens if needed
        return c.json({
            success: true,
            message: 'Logout successful',
        });
    }
}
