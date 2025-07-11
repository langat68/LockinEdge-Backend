import { config } from "dotenv";
import { db } from "../../db/db.js";
import { resumes } from "../../db/schema.js";
import type { Resume, ResumeAnalysis } from "../../types.js";
import { eq } from "drizzle-orm";

config(); // load .env

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log("✅ Using OpenAI (gpt-4o) for resume analysis");

async function analyzeResumeWithOpenAI(resumeText: string): Promise<ResumeAnalysis> {
  const prompt = `
You are a resume analysis assistant. Analyze the following resume and extract the following information in valid JSON format ONLY (no extra explanation, no backticks):

{
  "skills": [string],
  "experience": number,
  "education": [{"degree": string, "institution": string, "year": number}],
  "summary": string,
  "strengths": [string],
  "improvements": [string]
}

Resume:
${resumeText}
`;

  const url = "https://api.openai.com/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o", // or "gpt-3.5-turbo"
      messages: [
        { role: "system", content: "You are an expert resume analyst." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content: string =
    data.choices?.[0]?.message?.content?.trim() || "{}";

  try {
    const analysis: ResumeAnalysis = JSON.parse(content);
    return analysis;
  } catch (err) {
    throw new Error(
      `❌ Failed to parse OpenAI response: ${content}`
    );
  }
}

function normalizeResume(r: any): Resume {
  if (!r.userId) throw new Error("userId is null — invalid resume record");

  return {
    ...r,
    userId: r.userId as string,
    analysis: r.analysis as ResumeAnalysis | null,
  };
}

export class ResumeService {
  /**
   * Save resume + analysis
   */
  static async createResume(data: {
    userId: string;
    fileName: string;
    filePath: string;
    fileUrl: string;
    resumeText: string;
  }): Promise<Resume> {
    const aiAnalysis = await analyzeResumeWithOpenAI(data.resumeText);

    const [resume] = await db
      .insert(resumes)
      .values({
        fileUrl: data.fileUrl,
        userId: data.userId,
        analysis: aiAnalysis as any,
      })
      .returning();

    if (!resume) throw new Error("Failed to create resume");

    return normalizeResume(resume);
  }

  static async getResumeById(id: string): Promise<Resume | null> {
    const resume = await db.query.resumes.findFirst({ where: eq(resumes.id, id) });
    if (!resume || !resume.userId) return null;
    return normalizeResume(resume);
  }

  static async updateResume(id: string, updates: Partial<Pick<Resume, "fileUrl" | "analysis">>): Promise<Resume | null> {
    const [resume] = await db.update(resumes).set(updates).where(eq(resumes.id, id)).returning();
    if (!resume || !resume.userId) return null;
    return normalizeResume(resume);
  }

  static async listResumes(userId?: string): Promise<Resume[]> {
    const result = await db
      .select()
      .from(resumes)
      .where(userId ? eq(resumes.userId, userId) : undefined);

    return result.filter((r) => r.userId).map(normalizeResume);
  }
}
