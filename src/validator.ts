import { z } from 'zod';

//
// 🔷 Common reusable schemas
//
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const urlSchema = z.string().url('Invalid URL format');
export const sortOrderSchema = z.enum(['asc', 'desc']);

//
// 🔷 Analysis schema — placed early because others depend on it
//
export const resumeAnalysisSchema = z.object({
  skills: z.array(z.string()),
  experience: z.number().min(0),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.number().optional(),
    })
  ).optional(),
  summary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
});

//
// 🔷 Auth validators
//
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ✅ NEW: Google OAuth validation
export const googleAuthSchema = z.object({
  token: z.string().min(1, 'Google token is required'),
});

//
// 🔷 Resume validators
//
export const uploadResumeSchema = z.object({
  file: z.instanceof(File), // Expect a File object
  userId: uuidSchema,
});

export const updateResumeSchema = z.object({
  fileUrl: urlSchema.optional(),
  analysis: resumeAnalysisSchema.optional(),
});

//
// 🔷 Job validators
//
export const createJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(255, 'Job title too long'),
  company: z.string().min(1, 'Company name is required').max(255, 'Company name too long'),
  location: z.string().max(255, 'Location too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  skills: z.array(z.string()).optional(),
});

export const updateJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(255, 'Job title too long').optional(),
  company: z.string().min(1, 'Company name is required').max(255, 'Company name too long').optional(),
  location: z.string().max(255, 'Location too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  skills: z.array(z.string()).optional(),
});

//
// 🔷 Match validators
//
export const createMatchSchema = z.object({
  resumeId: uuidSchema,
  jobId: uuidSchema,
  score: z.number().min(0).max(1).optional(),
});

//
// 🔷 Query param & search validators
//
export const paginationSchema = z.object({
  page: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'Page must be positive')
    .optional(),
  limit: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
});

export const resumeSearchSchema = z.object({
  ...searchSchema.shape,
  ...paginationSchema.shape,
  sortBy: z.enum(['createdAt', 'title', 'score']).optional(),
  sortOrder: sortOrderSchema.optional(),
});

export const jobSearchSchema = z.object({
  ...searchSchema.shape,
  ...paginationSchema.shape,
  sortBy: z.enum(['createdAt', 'title', 'company']).optional(),
  sortOrder: sortOrderSchema.optional(),
});

export const matchSearchSchema = z.object({
  ...paginationSchema.shape,
  minScore: z.number().min(0).max(1).optional(),
  maxScore: z.number().min(0).max(1).optional(),
  sortBy: z.enum(['matchedAt', 'score']).optional(),
  sortOrder: sortOrderSchema.optional(),
});

//
// 🔷 File upload validator
//
export const fileUploadSchema = z.object({
  file: z.object({
    name: z.string().min(1, 'File name is required'),
    type: z.string().refine(
      (type) => [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ].includes(type),
      'File must be PDF, DOC, or DOCX'
    ),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  }),
});

//
// 🔷 Date range validator
//
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

//
// 🔷 Type inference helpers
//
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>; // ✅ NEW
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ResumeAnalysisInput = z.infer<typeof resumeAnalysisSchema>;
export type ResumeSearchInput = z.infer<typeof resumeSearchSchema>;
export type JobSearchInput = z.infer<typeof jobSearchSchema>;
export type MatchSearchInput = z.infer<typeof matchSearchSchema>;