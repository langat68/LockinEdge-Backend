import { zValidator } from '@hono/zod-validator';
import { createJobSchema, updateJobSchema, jobSearchSchema } from '../../validator.js';
import * as JobService from './jobs.service.js'; // Corrected import
import { Hono } from 'hono';
import { ResumeService } from '../../modules/resumes/resume.service.js'; // Import ResumeService
import { uuidSchema } from '../../types.js'; // Import uuidSchema
export const jobController = new Hono();
jobController.post('/', zValidator('json', createJobSchema), async (c) => {
    const jobData = c.req.valid('json');
    const job = await JobService.createJob(jobData);
    return c.json({ success: true, data: job });
});
jobController.get('/', zValidator('query', jobSearchSchema), async (c) => {
    const filters = c.req.valid('query');
    const jobs = await JobService.getJobs(filters);
    return c.json({ success: true, data: jobs });
});
jobController.get('/:id', async (c) => {
    const id = c.req.param('id');
    const job = await JobService.getJobById(id);
    if (!job)
        return c.notFound();
    return c.json({ success: true, data: job });
});
jobController.patch('/:id', zValidator('json', updateJobSchema), async (c) => {
    const id = c.req.param('id');
    const updates = c.req.valid('json');
    const job = await JobService.updateJob(id, updates);
    return c.json({ success: true, data: job });
});
jobController.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await JobService.deleteJob(id);
    return c.json({ success: true, message: 'Job deleted' });
});
jobController.post('/match/:resumeId', async (c) => {
    const { resumeId } = c.req.param();
    const parsedResumeId = uuidSchema.safeParse(resumeId);
    if (!parsedResumeId.success) {
        return c.json({ success: false, message: "Invalid resume ID", errors: parsedResumeId.error.format() }, 400);
    }
    const resume = await ResumeService.getResumeById(parsedResumeId.data);
    if (!resume) {
        return c.json({ success: false, message: "Resume not found" }, 404);
    }
    if (!resume.analysis) {
        return c.json({ success: false, message: "Resume has not been analyzed yet." }, 400);
    }
    const matchedJobs = await JobService.matchJobsWithResume(resume.id, resume.analysis);
    return c.json({ success: true, data: matchedJobs });
});
