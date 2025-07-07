import { Hono } from 'hono';
import { ResumeController } from './resume.controller.js';
import { authenticateToken } from '../auth/auth.middleware.js'; // Adjust path as needed
import type { AuthContext } from '../../types.js';

const resumeRoutes = new Hono<{ Variables: AuthContext }>();
const resumeController = new ResumeController();

// Apply authentication middleware to all routes
resumeRoutes.use('*', authenticateToken);

/**
 * @route POST /resumes
 * @desc Upload a new resume
 * @access Private
 */
resumeRoutes.post('/', async (c) => {
  return await resumeController.uploadResume(c);
});

/**
 * @route GET /resumes
 * @desc Get current user's resumes
 * @access Private
 */
resumeRoutes.get('/', async (c) => {
  return await resumeController.getUserResumes(c);
});

/**
 * @route GET /resumes/search
 * @desc Search resumes (admin functionality)
 * @access Private
 */
resumeRoutes.get('/search', async (c) => {
  return await resumeController.searchResumes(c);
});

/**
 * @route GET /resumes/:id
 * @desc Get specific resume by ID
 * @access Private (owner only)
 */
resumeRoutes.get('/:id', async (c) => {
  return await resumeController.getResume(c);
});

/**
 * @route PUT /resumes/:id/analysis
 * @desc Update resume analysis
 * @access Private (owner only)
 */
resumeRoutes.put('/:id/analysis', async (c) => {
  return await resumeController.updateResumeAnalysis(c);
});

/**
 * @route PUT /resumes/:id/file
 * @desc Update resume file
 * @access Private (owner only)
 */
resumeRoutes.put('/:id/file', async (c) => {
  return await resumeController.updateResumeFile(c);
});

/**
 * @route DELETE /resumes/:id
 * @desc Delete resume
 * @access Private (owner only)
 */
resumeRoutes.delete('/:id', async (c) => {
  return await resumeController.deleteResume(c);
});

export { resumeRoutes };