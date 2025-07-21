import { ResumeService } from "./resume.service.js";
import { RecommendationService } from "./reccomendationservice.js";
import { uploadResumeSchema, updateResumeSchema, uuidSchema } from "../../types.js";
import path from "node:path";
import fs from "node:fs/promises";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { generatePdf } from "./pdf.service.js";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "resumes");
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);
async function extractTextFromBuffer(buffer, fileType) {
    if (fileType === "application/pdf") {
        const data = await pdf(buffer);
        return data.text;
    }
    else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const tmpPath = path.join(UPLOAD_DIR, `tmp-${Date.now()}.docx`);
        await fs.writeFile(tmpPath, buffer);
        const data = await mammoth.extractRawText({ path: tmpPath });
        await fs.unlink(tmpPath);
        return data.value;
    }
    else {
        throw new Error("Unsupported file type");
    }
}
export class ResumeController {
    static async upload(ctx) {
        const formData = await ctx.req.formData();
        const file = formData.get("file");
        const userId = formData.get("userId");
        if (!file || !userId) {
            return ctx.json({ success: false, message: "File and userId are required" }, 400);
        }
        const parsed = uploadResumeSchema.safeParse({ file, userId });
        if (!parsed.success) {
            return ctx.json({ success: false, message: "Validation error", errors: parsed.error.format() }, 400);
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uniqueFilename = `${userId}-${Date.now()}-${file.name}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFilename);
        await fs.writeFile(filePath, buffer);
        let resumeText;
        try {
            resumeText = await extractTextFromBuffer(buffer, file.type);
        }
        catch (err) {
            return ctx.json({ success: false, message: "Failed to extract text", error: err.message }, 500);
        }
        const resume = await ResumeService.createResume({
            userId,
            fileName: uniqueFilename,
            filePath,
            fileUrl: `/uploads/resumes/${uniqueFilename}`,
            resumeText,
        });
        return ctx.json({ success: true, message: "Resume uploaded", data: resume });
    }
    static async getById(ctx) {
        const { id } = ctx.req.param();
        const parsed = uuidSchema.safeParse(id);
        if (!parsed.success) {
            return ctx.json({ success: false, message: "Invalid resume ID", errors: parsed.error.format() }, 400);
        }
        const resume = await ResumeService.getResumeById(id);
        if (!resume) {
            return ctx.json({ success: false, message: "Resume not found" }, 404);
        }
        return ctx.json({ success: true, data: resume });
    }
    static async update(ctx) {
        const { id } = ctx.req.param();
        const parsedId = uuidSchema.safeParse(id);
        const body = await ctx.req.json();
        const parsedBody = updateResumeSchema.safeParse(body);
        if (!parsedId.success || !parsedBody.success) {
            return ctx.json({
                success: false,
                message: "Validation error",
                errors: { ...(parsedId.error?.format() ?? {}), ...(parsedBody.error?.format() ?? {}) },
            }, 400);
        }
        const updated = await ResumeService.updateResume(parsedId.data, parsedBody.data);
        if (!updated) {
            return ctx.json({ success: false, message: "Resume not found" }, 404);
        }
        return ctx.json({ success: true, message: "Resume updated", data: updated });
    }
    static async list(ctx) {
        const resumes = await ResumeService.listResumes();
        return ctx.json({ success: true, data: resumes });
    }
    static async download(ctx) {
        const { id } = ctx.req.param();
        const parsed = uuidSchema.safeParse(id);
        if (!parsed.success) {
            return ctx.json({ success: false, message: "Invalid resume ID", errors: parsed.error.format() }, 400);
        }
        const resume = await ResumeService.getResumeById(id);
        if (!resume) {
            return ctx.json({ success: false, message: "Resume not found" }, 404);
        }
        const pdfBuffer = await generatePdf(resume);
        ctx.header("Content-Type", "application/pdf");
        ctx.header("Content-Disposition", `attachment; filename=resume-${id}.pdf`);
        return ctx.body(pdfBuffer);
    }
    static async generateRecommendations(ctx) {
        const { id } = ctx.req.param();
        const parsed = uuidSchema.safeParse(id);
        if (!parsed.success) {
            return ctx.json({ success: false, message: "Invalid resume ID", errors: parsed.error.format() }, 400);
        }
        try {
            const recommendations = await RecommendationService.generateRecommendations(id);
            if (!recommendations || recommendations.length === 0) {
                return ctx.json({
                    success: true,
                    message: "No strong job matches found.",
                    data: [],
                });
            }
            return ctx.json({ success: true, data: recommendations });
        }
        catch (err) {
            console.error(err);
            return ctx.json({
                success: false,
                message: "Failed to generate recommendations",
                error: err.message,
            }, 500);
        }
    }
}
