import { db } from "../../db/db.js";
import { resumes, users } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { Resume, ResumeWithUser, ResumeAnalysisInput, ResumeAnalysis } from "../../types.js";
import fs from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "resumes");

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

/**
 * Normalize a raw DB resume row to a valid Resume type.
 * Ensures userId is string and analysis is typed.
 */
function normalizeResume(r: any): Resume {
  if (!r.userId) {
    throw new Error("userId is null — invalid resume record");
  }

  return {
    ...r,
    userId: r.userId as string,
    analysis: r.analysis as ResumeAnalysis | null,
  };
}

export class ResumeService {
  /**
   * Upload a new resume.
   */
  static async uploadResume(data: { file: File; userId: string }): Promise<Resume> {
    const uniqueFilename = `${data.userId}-${Date.now()}-${data.file.name}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Save the file to disk
    await fs.writeFile(filePath, Buffer.from(await data.file.arrayBuffer()));

    // Placeholder for AI analysis
    const aiAnalysis: ResumeAnalysis = {
      skills: ["JavaScript", "TypeScript", "Node.js"],
      experience: 5,
      summary: "Placeholder AI summary of the resume.",
    };

    const [resume] = await db
      .insert(resumes)
      .values({
        fileUrl: `/uploads/resumes/${uniqueFilename}`,
        userId: data.userId,
        analysis: aiAnalysis as any, // Drizzle doesn't have a direct JSON type, so cast to any
      })
      .returning();

    if (!resume) throw new Error("Failed to create resume");

    return normalizeResume(resume);
  }

  /**
   * Get a single resume by its ID.
   */
  static async getResumeById(id: string): Promise<Resume | null> {
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, id),
    });
    if (!resume || !resume.userId) return null;
    return normalizeResume(resume);
  }

  /**
   * Get a single resume by its ID, including its user.
   */
  static async getResumeWithUser(id: string): Promise<ResumeWithUser | null> {
    const rows = await db
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
      .innerJoin(users, eq(resumes.userId, users.id))
      .where(eq(resumes.id, id));

    if (!rows.length || !rows[0].userId) return null;

    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      fileUrl: r.fileUrl,
      analysis: r.analysis as ResumeAnalysis | null,
      createdAt: r.createdAt,
      user: r.user,
    };
  }

  /**
   * Update an existing resume by its ID.
   */
  static async updateResume(
    id: string,
    updates: Partial<Pick<Resume, "fileUrl" | "analysis">>
  ): Promise<Resume | null> {
    const [resume] = await db
      .update(resumes)
      .set(updates)
      .where(eq(resumes.id, id))
      .returning();

    if (!resume || !resume.userId) return null;

    return normalizeResume(resume);
  }

  /**
   * Add or update analysis results for a resume.
   */
  static async saveAnalysis(
    resumeId: string,
    analysis: ResumeAnalysisInput
  ): Promise<Resume | null> {
    const [resume] = await db
      .update(resumes)
      .set({ analysis })
      .where(eq(resumes.id, resumeId))
      .returning();

    if (!resume || !resume.userId) return null;

    return normalizeResume(resume);
  }

  /**
   * Delete a resume by its ID.
   */
  static async deleteResume(id: string): Promise<boolean> {
    const result = await db.delete(resumes).where(eq(resumes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List all resumes (optionally filtered by userId).
   */
  static async listResumes(userId?: string): Promise<Resume[]> {
    const where = userId ? eq(resumes.userId, userId) : undefined;
    const result = await db.select().from(resumes).where(where);
    return result
      .filter(r => r.userId)
      .map(normalizeResume);
  }

  /**
   * Check if a resume belongs to a given user.
   */
  static async isOwner(resumeId: string, userId: string): Promise<boolean> {
    const resume = await db.query.resumes.findFirst({
      where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
    });
    return !!resume;
  }
}
