import bcrypt from 'bcrypt';
import { sign, verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { db } from '../../db/db.js'; // Adjust path as needed
import { users } from '../../db/schema.js'; // Adjust path as needed
import type { AuthResponse } from '../../types.js';

interface CreateUserData {
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface GoogleUserData {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async generateToken(userId: string, email: string): Promise<string> {
    const payload = {
      userId,
      email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    };
    return await sign(payload, this.JWT_SECRET);
  }

  static async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const payload = await verify(token, this.JWT_SECRET);
      return { userId: payload.userId as string, email: payload.email as string };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // ✅ NEW: Verify Google token with Google's API
  static async verifyGoogleToken(token: string): Promise<GoogleUserData> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      
      if (!response.ok) {
        throw new Error('Invalid Google token');
      }

      const payload = await response.json();

      // Verify the token is for our app
      if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Invalid Google token audience');
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      console.error('Google token verification error:', error);
      throw new Error('Failed to verify Google token');
    }
  }

  // ✅ NEW: Handle Google OAuth login/registration
  static async googleAuth(googleToken: string): Promise<AuthResponse> {
    // Verify Google token
    const googleUser = await this.verifyGoogleToken(googleToken);

    // Check if user exists by email or googleId
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, googleUser.email))
      .limit(1);

    let user;

    if (existingUser.length > 0) {
      // User exists - link Google account if not already linked
      const currentUser = existingUser[0];
      
      if (!currentUser.googleId) {
        // Link Google account to existing user
        await db
          .update(users)
          .set({ 
            googleId: googleUser.id,
            name: currentUser.name || googleUser.name // Keep existing name if present
          })
          .where(eq(users.id, currentUser.id));
      }

      user = {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name || googleUser.name,
        createdAt: currentUser.createdAt,
      };
    } else {
      // Create new user with Google data
      const newUser = await db
        .insert(users)
        .values({
          email: googleUser.email,
          googleId: googleUser.id,
          name: googleUser.name,
          passwordHash: null, // No password for Google users
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        });

      if (!newUser[0]) {
        throw new Error('Failed to create user');
      }

      user = newUser[0];
    }

    // Generate JWT token
    const token = await this.generateToken(user.id, user.email);

    return {
      user,
      token,
    };
  }

  static async createUser(userData: CreateUserData): Promise<AuthResponse> {
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
        name: users.name,
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

  static async loginUser(loginData: LoginData): Promise<AuthResponse> {
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

    // Check if user has a password (not Google-only user)
    if (!user[0].passwordHash) {
      throw new Error('Please sign in with Google');
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
        name: user[0].name,
        createdAt: user[0].createdAt,
      },
      token,
    };
  }

  static async getUserById(userId: string) {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
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

  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPassword);
    
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  static async updatePasswordWithVerification(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    // Get user with password hash
    const userWithPassword = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithPassword[0]) {
      throw new Error('User not found');
    }

    // Check if user has a password (not Google-only user)
    if (!userWithPassword[0].passwordHash) {
      throw new Error('Cannot update password for Google account');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.comparePassword(
      currentPassword,
      userWithPassword[0].passwordHash
    );

    if (!isCurrentPasswordValid) {
      return false; // Current password is incorrect
    }

    // Update password
    await this.updatePassword(userId, newPassword);
    return true;
  }
}