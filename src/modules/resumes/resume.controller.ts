import type { Context } from "hono";
import { ResumeService } from "./resume.service.js";
import { uploadResumeSchema, updateResumeSchema, uuidSchema } from "../../types.js";

export class ResumeController {
  static async upload(ctx: Context) {
    const body = await ctx.req.parseBody();
    const file = body.file as File;
    const userId = body.userId as string;

    const parsed = uploadResumeSchema.safeParse({ file, userId });

    if (!parsed.success) {
      return ctx.json({ success: false, message: "Validation error", errors: parsed.error.format() }, 400);
    }

    const resume = await ResumeService.uploadResume(parsed.data);
    return ctx.json({ success: true, message: "Resume uploaded", data: resume });
  }

  static async getById(ctx: Context) {
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

  static async update(ctx: Context) {
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

  static async list(ctx: Context) {
    const resumes = await ResumeService.listResumes();
    return ctx.json({ success: true, data: resumes });
  }
}
