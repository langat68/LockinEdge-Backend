import { db } from "../../db/db.js";
import { resumes, users } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { Resume, ResumeWithUser, ResumeAnalysisInput, ResumeAnalysis } from "../../types.js";
import fs from "node:fs/promises";
import path from "node:path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "resumes");

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  if (fileType === "application/pdf") {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } else if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const data = await mammoth.extractRawText({ path: filePath });
    return data.value;
  } else {
    throw new Error("Unsupported file type");
  }
}

async function analyzeResumeWithAI(resumeText: string): Promise<ResumeAnalysis> {
  const prompt = `
    Analyze the following resume and extract the following information in JSON format:
    - skills: An array of strings representing the candidate's skills.
    - experience: A number representing the total years of experience.
    - education: An array of objects, each with 'degree', 'institution', and 'year'.
    - summary: A brief summary of the candidate's profile.
    - strengths: An array of strings highlighting the candidate's strengths.
    - improvements: An array of strings suggesting areas for improvement.

    Resume:
    ${resumeText}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const analysis = JSON.parse(response.choices[0].message.content || "{}");
  return analysis;
}

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

    // Extract text from the file
    const resumeText = await extractTextFromFile(filePath, data.file.type);

    // Analyze the resume with AI
    const aiAnalysis = await analyzeResumeWithAI(resumeText);

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
