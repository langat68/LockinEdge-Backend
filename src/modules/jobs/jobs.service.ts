import { db } from '../../db/db.js';
import { jobs, matches } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type {
  CreateJobInput,
  UpdateJobInput,
  JobSearchOptions,
  ResumeAnalysis,
} from '../../types.js';
import puppeteer from 'puppeteer';

export async function createJob(data: CreateJobInput) {
  const [job] = await db.insert(jobs).values(data).returning();
  return job;
}

export async function getJobs(filters: JobSearchOptions = {}) {
  const {
    limit = 10,
    page = 1,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  const sortableColumns = {
    createdAt: 'created_at',
    title: 'title',
    company: 'company',
    // Add other valid DB column names here
  } as const;

  const columnName = sortableColumns[sortBy as keyof typeof sortableColumns] ?? 'created_at';
  const orderByClause = sql.raw(`${columnName} ${sortOrder.toUpperCase()}`);

  const query = db
    .select()
    .from(jobs)
    .orderBy(orderByClause)
    .limit(limit)
    .offset((page - 1) * limit);

  return query;
}

export async function getJobById(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job;
}

export async function updateJob(id: string, updates: UpdateJobInput) {
  const [job] = await db
    .update(jobs)
    .set(updates)
    .where(eq(jobs.id, id))
    .returning();
  return job;
}

export async function deleteJob(id: string) {
  await db.delete(jobs).where(eq(jobs.id, id));
}

export async function matchJobsWithResume(
  resumeId: string,
  resumeAnalysis: ResumeAnalysis
) {
  const allJobs = await db.select().from(jobs);
  const matchedJobs: {
    job: typeof allJobs[number];
    score: number;
    matchedSkills: string[];
  }[] = [];

  for (const job of allJobs) {
    let score = 0;
    const matchedSkills: string[] = [];

    if (Array.isArray(job.skills) && Array.isArray(resumeAnalysis.skills)) {
      for (const resumeSkill of resumeAnalysis.skills) {
        if (
          job.skills.some((jobSkill: string) =>
            jobSkill.toLowerCase().includes(resumeSkill.toLowerCase())
          )
        ) {
          score += 1;
          matchedSkills.push(resumeSkill);
        }
      }
    }

    if (
      resumeAnalysis.experience &&
      job.description?.toLowerCase().includes('experience')
    ) {
      score += 0.5;
    }

    if (score > 0) {
      await db
        .insert(matches)
        .values({
          resumeId: resumeId,
          jobId: job.id,
          score: score,
        })
        .onConflictDoNothing();

      matchedJobs.push({
        job,
        score,
        matchedSkills,
      });
    }
  }

  return matchedJobs;
}

export async function scrapeAndStoreJobs() {
  console.log("Scraping jobs...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.indeed.com/q-software-developer-l-USA-jobs.html", { waitUntil: "networkidle2" });

  const jobData = await page.evaluate(() => {
    const jobs = [];
    const jobElements = document.querySelectorAll(".job_seen_beacon");

    for (const jobElement of jobElements) {
      const title = (jobElement.querySelector(".jobTitle > a") as HTMLElement)?.innerText;
      const company = (jobElement.querySelector("[data-testid='company-name']") as HTMLElement)?.innerText;
      const location = (jobElement.querySelector("[data-testid='text-location']") as HTMLElement)?.innerText;
      const description = (jobElement.querySelector(".job-snippet") as HTMLElement)?.innerText;

      if (title && company) {
        jobs.push({ title, company, location, description });
      }
    }

    return jobs;
  });

  await browser.close();

  for (const job of jobData) {
    await createJob(job);
  }

  console.log(`Scraped and stored ${jobData.length} jobs.`);
}