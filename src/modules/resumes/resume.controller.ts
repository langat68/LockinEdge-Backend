import type  { Context } from 'hono';
import { ResumeService } from './resume.service.js';
import { 
  uploadResumeSchema, 
  updateResumeSchema, 
  resumeSearchSchema,
  resumeAnalysisSchema 
} from '../../validator.js';
import type { 
  AuthContext, 
  ApiResponse, 
  ResumeAnalysis,
  ResumeSearchInput 
} from '../../types.js';

export class ResumeController {
  private resumeService: ResumeService;

  constructor() {
    this.resumeService = new ResumeService();
  }

  /**
   * Upload a new resume
   */
  async uploadResume(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const body = await c.req.json();
      const validation = uploadResumeSchema.safeParse(body);

      if (!validation.success) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        }, 400);
      }

      const { fileUrl } = validation.data;
      const userId = c.get('userId');

      const result = await this.resumeService.createResume(userId, fileUrl);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to upload resume',
        }, 500);
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Resume uploaded successfully',
        data: result.data,
      }, 201);
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }

  /**
   * Get resume by ID
   */
  async getResume(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const id = c.req.param('id');
      const userId = c.get('userId');

      // Check if user owns the resume
      const ownershipResult = await this.resumeService.isResumeOwner(id, userId);
      if (!ownershipResult.success) {
        return c.json<ApiResponse>({
          success: false,
          message: ownershipResult.error || 'Resume not found',
        }, 404);
      }

      if (!ownershipResult.data) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Access denied',
        }, 403);
      }

      const result = await this.resumeService.getResumeWithUser(id);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to get resume',
        }, 404);
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Resume retrieved successfully',
        data: result.data,
      });
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }

  /**
   * Get current user's resumes
   */
  async getUserResumes(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const userId = c.get('userId');

      const result = await this.resumeService.getResumesByUserId(userId);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to get resumes',
        }, 500);
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Resumes retrieved successfully',
        data: result.data,
      });
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }

  /**
   * Update resume analysis
   */
  async updateResumeAnalysis(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const id = c.req.param('id');
      const userId = c.get('userId');
      const body = await c.req.json();

      const validation = resumeAnalysisSchema.safeParse(body);

      if (!validation.success) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        }, 400);
      }

      // Check if user owns the resume
      const ownershipResult = await this.resumeService.isResumeOwner(id, userId);
      if (!ownershipResult.success) {
        return c.json<ApiResponse>({
          success: false,
          message: ownershipResult.error || 'Resume not found',
        }, 404);
      }

      if (!ownershipResult.data) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Access denied',
        }, 403);
      }

      const result = await this.resumeService.updateResumeAnalysis(id, validation.data as ResumeAnalysis);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to update resume analysis',
        }, 500);
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Resume analysis updated successfully',
        data: result.data,
      });
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }

  /**
   * Update resume file
   */
  async updateResumeFile(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const id = c.req.param('id');
      const userId = c.get('userId');
      const body = await c.req.json();

      const validation = updateResumeSchema.safeParse(body);

      if (!validation.success) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        }, 400);
      }

      // Check if user owns the resume
      const ownershipResult = await this.resumeService.isResumeOwner(id, userId);
      if (!ownershipResult.success) {
        return c.json<ApiResponse>({
          success: false,
          message: ownershipResult.error || 'Resume not found',
        }, 404);
      }

      if (!ownershipResult.data) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Access denied',
        }, 403);
      }

      const { fileUrl } = validation.data;
      if (!fileUrl) {
        return c.json<ApiResponse>({
          success: false,
          message: 'File URL is required',
        }, 400);
      }

      const result = await this.resumeService.updateResumeFile(id, fileUrl);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to update resume file',
        }, 500);
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Resume file updated successfully',
        data: result.data,
      });
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }

  /**
   * Delete resume
   */
  async deleteResume(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const id = c.req.param('id');
      const userId = c.get('userId');

      // Check if user owns the resume
      const ownershipResult = await this.resumeService.isResumeOwner(id, userId);
      if (!ownershipResult.success) {
        return c.json<ApiResponse>({
          success: false,
          message: ownershipResult.error || 'Resume not found',
        }, 404);
      }

      if (!ownershipResult.data) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Access denied',
        }, 403);
      }

      const result = await this.resumeService.deleteResume(id);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to delete resume',
        }, 500);
      }

      return c.json<ApiResponse>({
        success: true,
        message: 'Resume deleted successfully',
      });
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }

  /**
   * Search resumes (admin only or public search)
   */
  async searchResumes(c: Context<{ Variables: AuthContext }>): Promise<Response> {
    try {
      const query = c.req.query();
      const validation = resumeSearchSchema.safeParse(query);

      if (!validation.success) {
        return c.json<ApiResponse>({
          success: false,
          message: 'Validation failed',
          errors: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        }, 400);
      }

      const searchOptions = validation.data as ResumeSearchInput;

      const result = await this.resumeService.searchResumes(searchOptions);

      if (!result.success) {
        return c.json<ApiResponse>({
          success: false,
          message: result.error || 'Failed to search resumes',
        }, 500);
      }

      return c.json(result.data);
    } catch (error) {
      return c.json<ApiResponse>({
        success: false,
        message: 'Internal server error',
      }, 500);
    }
  }
}