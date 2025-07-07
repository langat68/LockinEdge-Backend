import { eq, and, or, ilike, desc, asc, count, sql } from 'drizzle-orm';
import { db } from '../../db/db.js'; // Adjust path as needed
import { resumes, users, matches } from '../../db/schema.js'; // Adjust path as needed
import type {
  Resume,
  ResumeWithUser,
  ResumeAnalysis,
  ResumeSearchInput,
  ServiceResponse,
  PaginatedResponse,
  UploadResult,
} from '../../types.js';

export class ResumeService {
  /**
   * Create a new resume
   */
  async createResume(userId: string, fileUrl: string): Promise<ServiceResponse<Resume>> {
    try {
      const [resume] = await db
        .insert(resumes)
        .values({
          userId,
          fileUrl,
        })
        .returning();

      return {
        success: true,
        data: resume,
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

      if (!resume) {
        return {
          success: false,
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: resume,
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
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: {
          id: result.id,
          userId: result.userId,
          fileUrl: result.fileUrl,
          analysis: result.analysis as ResumeAnalysis | null,
          createdAt: result.createdAt,
          user: result.user,
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
      const userResumes = await db
        .select()
        .from(resumes)
        .where(eq(resumes.userId, userId))
        .orderBy(desc(resumes.createdAt));

      return {
        success: true,
        data: userResumes,
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
      const [resume] = await db
        .update(resumes)
        .set({ analysis })
        .where(eq(resumes.id, id))
        .returning();

      if (!resume) {
        return {
          success: false,
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: resume,
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
      const [resume] = await db
        .update(resumes)
        .set({ fileUrl })
        .where(eq(resumes.id, id))
        .returning();

      if (!resume) {
        return {
          success: false,
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: resume,
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
      // First delete associated matches
      await db.delete(matches).where(eq(matches.resumeId, id));

      // Then delete the resume
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

      return {
        success: true,
      };
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
  async searchResumes(searchOptions: ResumeSearchInput): Promise<ServiceResponse<PaginatedResponse<ResumeWithUser>>> {
    try {
      const {
        query,
        skills,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        minScore,
        maxScore,
        hasAnalysis,
      } = searchOptions;

      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [];

      if (query) {
        whereConditions.push(
          or(
            ilike(users.email, `%${query}%`),
            sql`${resumes.analysis}::text ILIKE ${`%${query}%`}`
          )
        );
      }

      if (skills && skills.length > 0) {
        // Check if any of the requested skills are in the resume's analysis
        const skillsConditions = skills.map(skill => 
          sql`${resumes.analysis}::text ILIKE ${`%${skill}%`}`
        );
        whereConditions.push(or(...skillsConditions));
      }

      if (hasAnalysis !== undefined) {
        if (hasAnalysis) {
          whereConditions.push(sql`${resumes.analysis} IS NOT NULL`);
        } else {
          whereConditions.push(sql`${resumes.analysis} IS NULL`);
        }
      }

      // Score filtering would need to be implemented with matches table
      // For now, we'll skip minScore and maxScore filtering

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Build order by clause
      const orderByClause = (() => {
        switch (sortBy) {
          case 'createdAt':
          default:
            return sortOrder === 'asc' ? asc(resumes.createdAt) : desc(resumes.createdAt);
        }
      })();

      // Get total count
      const [{ count: totalCount }] = await db
        .select({ count: count() })
        .from(resumes)
        .leftJoin(users, eq(resumes.userId, users.id))
        .where(whereClause);

      // Get paginated results
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

      const resumesWithUser = results.map(result => ({
        id: result.id,
        userId: result.userId!,
        fileUrl: result.fileUrl,
        analysis: result.analysis as ResumeAnalysis | null,
        createdAt: result.createdAt,
        user: result.user!,
      })).filter(resume => resume.userId && resume.user);

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

      if (!resume || !resume.userId) {
        return {
          success: false,
          error: 'Resume not found',
          code: 'RESUME_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: resume.userId === userId,
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