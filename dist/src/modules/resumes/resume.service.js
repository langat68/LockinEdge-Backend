import { config } from "dotenv";
import { db } from "../../db/db.js";
import { resumes } from "../../db/schema.js";
import { eq } from "drizzle-orm";
config(); // load .env
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
console.log("✅ Using DeepSeek-R1 (via OpenRouter) for resume analysis");
async function analyzeResumeWithOpenRouter(resumeText) {
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
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
            model: "deepseek/deepseek-r1:free", // Free DeepSeek model
            messages: [
                { role: "system", content: "You are an expert resume analyst." },
                { role: "user", content: prompt },
            ],
            temperature: 0,
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "{}";
    try {
        const analysis = JSON.parse(content);
        return analysis;
    }
    catch (err) {
        throw new Error(`❌ Failed to parse OpenRouter response: ${content}`);
    }
}
function normalizeResume(r) {
    if (!r.userId)
        throw new Error("userId is null — invalid resume record");
    return {
        ...r,
        userId: r.userId,
        analysis: r.analysis,
    };
}
export class ResumeService {
    /**
     * Save resume + analysis
     */
    static async createResume(data) {
        const aiAnalysis = await analyzeResumeWithOpenRouter(data.resumeText);
        const [resume] = await db
            .insert(resumes)
            .values({
            fileUrl: data.fileUrl,
            userId: data.userId,
            analysis: aiAnalysis,
        })
            .returning();
        if (!resume)
            throw new Error("Failed to create resume");
        return normalizeResume(resume);
    }
    static async getResumeById(id) {
        const resume = await db.query.resumes.findFirst({ where: eq(resumes.id, id) });
        if (!resume || !resume.userId)
            return null;
        return normalizeResume(resume);
    }
    static async updateResume(id, updates) {
        const [resume] = await db.update(resumes).set(updates).where(eq(resumes.id, id)).returning();
        if (!resume || !resume.userId)
            return null;
        return normalizeResume(resume);
    }
    static async listResumes(userId) {
        const result = await db
            .select()
            .from(resumes)
            .where(userId ? eq(resumes.userId, userId) : undefined);
        return result.filter((r) => r.userId).map(normalizeResume);
    }
}
