// Database entity types (inferred from schema)
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date | null;
}

export interface UserPublic {
  id: string;
  email: string;
  createdAt: Date | null;
}

export interface Resume {
  id: string;
  userId: string;
  fileUrl: string;
  analysis: ResumeAnalysis | null;
  createdAt: Date | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  skills: string[] | null;
  createdAt: Date | null;
}

export interface Match {
  id: string;
  resumeId: string;
  jobId: string;
  score: number | null;
  matchedAt: Date | null;
}

// Extended types with relations
export interface ResumeWithUser extends Resume {
  user: UserPublic;
}

export interface MatchWithDetails extends Match {
  resume: Resume;
  job: Job;
}

export interface JobWithMatches extends Job {
  matches: Match[];
}

// Analysis types
export interface ResumeAnalysis {
  skills: string[];
  experience: number;
  education?: Education[];
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  aiScore?: number;
  keywords?: string[];
  contactInfo?: ContactInfo;
}

export interface Education {
  degree: string;
  institution: string;
  year?: number;
  gpa?: number;
}

export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

// Auth types
export interface AuthResponse {
  user: UserPublic;
  token: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// Search and filter types
export interface SearchOptions {
  query?: string;
  skills?: string[];
  location?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface JobSearchOptions extends SearchOptions {
  company?: string;
  minExperience?: number;
  maxExperience?: number;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface ResumeSearchOptions extends SearchOptions {
  minScore?: number;
  maxScore?: number;
  hasAnalysis?: boolean;
}

export interface MatchSearchOptions {
  resumeId?: string;
  jobId?: string;
  minScore?: number;
  maxScore?: number;
  page?: number;
  limit?: number;
  sortBy?: 'matchedAt' | 'score';
  sortOrder?: 'asc' | 'desc';
}

// File upload types
export interface FileUpload {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
}

// AI/ML types
export interface MatchingResult {
  jobId: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
}

export interface AIAnalysisResult {
  analysis: ResumeAnalysis;
  suggestions: string[];
  confidence: number;
}

// Context types for Hono
export interface AuthContext {
  userId: string;
  userEmail: string;
}

export interface RequestContext extends AuthContext {
  user?: UserPublic;
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
}

// Service response types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Database query types
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: Record<string, any>;
}

// Utility types
export type SortOrder = 'asc' | 'desc';

export type JobSortBy = 'createdAt' | 'title' | 'company';

export type ResumeSortBy = 'createdAt' | 'title' | 'score';

export type MatchSortBy = 'matchedAt' | 'score';

// Error types
export interface AppError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface AppConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  database: DatabaseConfig;
  jwt: JwtConfig;
  upload: {
    maxSize: number;
    allowedTypes: string[];
    destination: string;
  };
}

// Event types (for potential event-driven features)
export interface ResumeUploadedEvent {
  resumeId: string;
  userId: string;
  fileUrl: string;
  timestamp: Date;
}

export interface MatchCreatedEvent {
  matchId: string;
  resumeId: string;
  jobId: string;
  score: number;
  timestamp: Date;
}

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  timestamp: Date;
}

// Export all validator types for convenience
export * from './validator.js';


// Add these interfaces to your types.js file

export interface CreateUserData {
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}