import { eq, and, or, ilike, desc, asc, count, sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { resumes, users, matches } from '../../db/schema.js';
import type {
  Resume,
  ResumeWithUser,
  ResumeAnalysis,
  ServiceResponse,
  PaginatedResponse,
} from '../../types.js';

import {
  uploadResumeSchema,
  uuidSchema,
  resumeAnalysisSchema,
  resumeSearchSchema,
} from '../../validator.js';

export class ResumeService {
  /**
   * Create a new resume
   */
  async createResume(userId: string, fileUrl: string): Promise<ServiceResponse<Resume>> {
    try {
      const { userId: validUserId, fileUrl: validFileUrl } =
        uploadResumeSchema.parse({ userId, fileUrl });

      const [resume] = await db
        .insert(resumes)
        .values({
          userId: validUserId,
          fileUrl: validFileUrl,
        })
        .returning();

      return {
        success: true,
        data: { ...resume, userId: validUserId },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create resume',
        code: 'CREATE_RESUME_ERROR',
      };
    }
  }

  /**
   * Get resume by ID
   */
  async getResumeById(id: string): Promise<ServiceResponse<Resume>> {
    try {
      const [resume] = await db
        .select()
        .from(resumes)
        .where(eq(resumes.id, id));

      if (!resume || !resume.userId) {
        return {
          success: false,
          error: 'Resume not found or invalid',
          code: 'RESUME_NOT_FOUND',
        };
      }

      const parsedUserId = uuidSchema.parse(resume.userId);
      const parsedAnalysis =
        resume.analysis !== null ? resumeAnalysisSchema.parse(resume.analysis) : null;

      return {
        success: true,
        data: {
          ...resume,
          userId: parsedUserId,
          analysis: parsedAnalysis,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get resume',
        code: 'GET_RESUME_ERROR',
      };
    }
  }

  /**
   * Get resume with user details
   */
  async getResumeWithUser(id: string): Promise<ServiceResponse<ResumeWithUser>> {
    try {
      const [result] = await db
        .select({
          id: resumes.id,
          userId: resumes.userId,
          fileUrl: resumes.fileUrl,
          analysis: resumes.analysis,
          createdAt: resumes.createdAt,
          user: {
            id: users.id,
            email: users.email,
            createdAt: users.createdAt,
          },
        })
        .from(resumes)
        .leftJoin(users, eq(resumes.userId, users.id))
        .where(eq(resumes.id, id));

      if (!result || !result.userId || !result.user) {
        return {
          success: false,
          error: 'Resume not found or invalid',
          code: 'RESUME_NOT_FOUND',
        };
      }

      const parsedUserId = uuidSchema.parse(result.userId);
      const parsedAnalysis =
        result.analysis !== null ? resumeAnalysisSchema.parse(result.analysis) : null;

      return {
        success: true,
        data: {
          ...result,
          userId: parsedUserId,
          analysis: parsedAnalysis,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get resume with user',
        code: 'GET_RESUME_WITH_USER_ERROR',
      };
    }
  }

  /**
   * Get resumes by user ID
   */
  async getResumesByUserId(userId: string): Promise<ServiceResponse<Resume[]>> {
    try {
      const validUserId = uuidSchema.parse(userId);

      const userResumes = await db
        .select()
        .from(resumes)
        .where(eq(resumes.userId, validUserId))
        .orderBy(desc(resumes.createdAt));

      return {
        success: true,
        data: userResumes.map(r => ({
          ...r,
          userId: validUserId,
          analysis: r.analysis ? resumeAnalysisSchema.parse(r.analysis) : null,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user resumes',
        code: 'GET_USER_RESUMES_ERROR',
      };
    }
  }

  /**
   * Update resume analysis
   */
  async updateResumeAnalysis(id: string, analysis: ResumeAnalysis): Promise<ServiceResponse<Resume>> {
    try {
      const parsedAnalysis = resumeAnalysisSchema.parse(analysis);

      const [resume] = await db
        .update(resumes)
        .set({ analysis: parsedAnalysis })
        .where(eq(resumes.id, id))
        .returning();

      if (!resume || !resume.userId) {
        return {
          success: false,
          error: 'Resume not found or invalid',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: {
          ...resume,
          userId: uuidSchema.parse(resume.userId),
          analysis: parsedAnalysis,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update resume analysis',
        code: 'UPDATE_RESUME_ANALYSIS_ERROR',
      };
    }
  }

  /**
   * Update resume file URL
   */
  async updateResumeFile(id: string, fileUrl: string): Promise<ServiceResponse<Resume>> {
    try {
      const validFileUrl = uploadResumeSchema.shape.fileUrl.parse(fileUrl);

      const [resume] = await db
        .update(resumes)
        .set({ fileUrl: validFileUrl })
        .where(eq(resumes.id, id))
        .returning();

      if (!resume || !resume.userId) {
        return {
          success: false,
          error: 'Resume not found or invalid',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: {
          ...resume,
          userId: uuidSchema.parse(resume.userId),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update resume file',
        code: 'UPDATE_RESUME_FILE_ERROR',
      };
    }
  }

  /**
   * Delete resume
   */
  async deleteResume(id: string): Promise<ServiceResponse<void>> {
    try {
      await db.delete(matches).where(eq(matches.resumeId, id));

      const [deletedResume] = await db
        .delete(resumes)
        .where(eq(resumes.id, id))
        .returning();

      if (!deletedResume) {
        return {
          success: false,
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete resume',
        code: 'DELETE_RESUME_ERROR',
      };
    }
  }

  /**
   * Search resumes with pagination
   */
  async searchResumes(searchOptions: any): Promise<ServiceResponse<PaginatedResponse<ResumeWithUser>>> {
    try {
      const {
        query,
        skills,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        hasAnalysis,
      } = resumeSearchSchema.parse(searchOptions);

      const offset = (page - 1) * limit;

      const whereConditions = [];

      if (query) {
        whereConditions.push(
          or(
            ilike(users.email, `%${query}%`),
            sql`${resumes.analysis}::text ILIKE ${`%${query}%`}`
          )
        );
      }

      if (skills?.length) {
        const skillConditions = skills.map(skill =>
          sql`${resumes.analysis}::text ILIKE ${`%${skill}%`}`
        );
        whereConditions.push(or(...skillConditions));
      }

      if (hasAnalysis !== undefined) {
        if (hasAnalysis) {
          whereConditions.push(sql`${resumes.analysis} IS NOT NULL`);
        } else {
          whereConditions.push(sql`${resumes.analysis} IS NULL`);
        }
      }

      const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

      const orderByClause =
        sortOrder === 'asc' ? asc(resumes.createdAt) : desc(resumes.createdAt);

      const [{ count: totalCount }] = await db
        .select({ count: count() })
        .from(resumes)
        .leftJoin(users, eq(resumes.userId, users.id))
        .where(whereClause);

      const results = await db
        .select({
          id: resumes.id,
          userId: resumes.userId,
          fileUrl: resumes.fileUrl,
          analysis: resumes.analysis,
          createdAt: resumes.createdAt,
          user: {
            id: users.id,
            email: users.email,
            createdAt: users.createdAt,
          },
        })
        .from(resumes)
        .leftJoin(users, eq(resumes.userId, users.id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      const resumesWithUser = results.map(r => ({
        ...r,
        userId: uuidSchema.parse(r.userId!),
        analysis: r.analysis ? resumeAnalysisSchema.parse(r.analysis) : null,
      }));

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          success: true,
          message: 'Resumes retrieved successfully',
          data: resumesWithUser,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search resumes',
        code: 'SEARCH_RESUMES_ERROR',
      };
    }
  }

  /**
   * Check if user owns resume
   */
  async isResumeOwner(resumeId: string, userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const [resume] = await db
        .select({ userId: resumes.userId })
        .from(resumes)
        .where(eq(resumes.id, resumeId));

      if (!resume?.userId) {
        return {
          success: false,
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      const ownerId = uuidSchema.parse(resume.userId);

      return {
        success: true,
        data: ownerId === userId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check resume ownership',
        code: 'CHECK_RESUME_OWNERSHIP_ERROR',
      };
    }
  }
}
