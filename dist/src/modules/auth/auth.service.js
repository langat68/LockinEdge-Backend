import bcrypt from 'bcrypt';
import { sign, verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { db } from '../../db/db.js'; // Adjust path as needed
import { users } from '../../db/schema.js'; // Adjust path as needed
export class AuthService {
    static SALT_ROUNDS = 12;
    static JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    static async hashPassword(password) {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }
    static async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    static async generateToken(userId, email) {
        const payload = {
            userId,
            email,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
        };
        return await sign(payload, this.JWT_SECRET);
    }
    static async verifyToken(token) {
        try {
            const payload = await verify(token, this.JWT_SECRET);
            return { userId: payload.userId, email: payload.email };
        }
        catch (error) {
            throw new Error('Invalid token');
        }
    }
    static async createUser(userData) {
        const { email, password } = userData;
        // Check if user already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        if (existingUser.length > 0) {
            throw new Error('User already exists with this email');
        }
        // Hash password
        const passwordHash = await this.hashPassword(password);
        // Create user
        const newUser = await db
            .insert(users)
            .values({
            email,
            passwordHash,
        })
            .returning({
            id: users.id,
            email: users.email,
            createdAt: users.createdAt,
        });
        if (!newUser[0]) {
            throw new Error('Failed to create user');
        }
        // Generate token
        const token = await this.generateToken(newUser[0].id, newUser[0].email);
        return {
            user: newUser[0],
            token,
        };
    }
    static async loginUser(loginData) {
        const { email, password } = loginData;
        // Find user
        const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        if (!user[0]) {
            throw new Error('Invalid credentials');
        }
        // Check password
        const isPasswordValid = await this.comparePassword(password, user[0].passwordHash);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }
        // Generate token
        const token = await this.generateToken(user[0].id, user[0].email);
        return {
            user: {
                id: user[0].id,
                email: user[0].email,
                createdAt: user[0].createdAt,
            },
            token,
        };
    }
    static async getUserById(userId) {
        const user = await db
            .select({
            id: users.id,
            email: users.email,
            createdAt: users.createdAt,
        })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!user[0]) {
            throw new Error('User not found');
        }
        return user[0];
    }
    static async updatePassword(userId, newPassword) {
        const passwordHash = await this.hashPassword(newPassword);
        await db
            .update(users)
            .set({ passwordHash })
            .where(eq(users.id, userId));
    }
    static async updatePasswordWithVerification(userId, currentPassword, newPassword) {
        // Get user with password hash
        const userWithPassword = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!userWithPassword[0]) {
            throw new Error('User not found');
        }
        // Verify current password
        const isCurrentPasswordValid = await this.comparePassword(currentPassword, userWithPassword[0].passwordHash);
        if (!isCurrentPasswordValid) {
            return false; // Current password is incorrect
        }
        // Update password
        await this.updatePassword(userId, newPassword);
        return true;
    }
}
