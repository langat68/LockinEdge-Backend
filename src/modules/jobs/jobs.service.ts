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

// Add SerpAPI search parameters interface
interface SerpAPISearchParams {
  query: string;
  location?: string;
  experienceLevel?: 'entry_level' | 'mid_level' | 'senior_level';
  jobType?: 'fulltime' | 'parttime' | 'contract' | 'temporary' | 'internship';
  numResults?: number;
}

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

// Original Puppeteer scraping function
export async function scrapeAndStoreJobs() {
  console.log("Scraping jobs with Puppeteer...");
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

  console.log(`Scraped and stored ${jobData.length} jobs with Puppeteer.`);
  return jobData.length;
}

// New SerpAPI scraping function
export async function scrapeJobsWithSerpAPI(searchParams: SerpAPISearchParams) {
  console.log("Scraping jobs with SerpAPI...");
  
  const {
    query,
    location = "United States",
    experienceLevel,
    jobType,
    numResults = 20
  } = searchParams;

  try {
    // Build SerpAPI URL
    const serpApiUrl = new URL('https://serpapi.com/search');
    serpApiUrl.searchParams.set('engine', 'google_jobs');
    serpApiUrl.searchParams.set('q', query);
    serpApiUrl.searchParams.set('location', location);
    serpApiUrl.searchParams.set('api_key', process.env.SERPAPI_API_KEY!);
    serpApiUrl.searchParams.set('num', numResults.toString());

    if (experienceLevel) {
      serpApiUrl.searchParams.set('experience_level', experienceLevel);
    }

    if (jobType) {
      serpApiUrl.searchParams.set('employment_type', jobType);
    }

    // Make API request
    const response = await fetch(serpApiUrl.toString());
    
    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.jobs_results || !Array.isArray(data.jobs_results)) {
      console.log("No jobs found in SerpAPI response");
      return 0;
    }

    // Process and store jobs
    let storedCount = 0;
    for (const job of data.jobs_results) {
      try {
        const jobData = {
          title: job.title || 'Unknown Title',
          company: job.company_name || 'Unknown Company',
          location: job.location || location,
          description: job.description || job.snippet || '',
          salary: job.salary_info?.salary || null,
          jobType: job.detected_extensions?.employment_type || null,
          source: 'serpapi-google-jobs'
        };

        await createJob(jobData);
        storedCount++;
      } catch (error) {
        console.error('Error storing job:', error);
        // Continue with other jobs even if one fails
      }
    }

    console.log(`Scraped and stored ${storedCount} jobs with SerpAPI.`);
    return storedCount;

  } catch (error) {
    console.error('SerpAPI scraping error:', error);
    throw error;
  }
}

// Combined function to run both scrapers
export async function scrapeAllJobs(searchParams?: SerpAPISearchParams) {
  console.log("Running all job scrapers...");
  
  const results = {
    puppeteer: 0,
    serpapi: 0,
    total: 0,
    errors: [] as string[]
  };

  // Run Puppeteer scraper
  try {
    results.puppeteer = await scrapeAndStoreJobs();
  } catch (error) {
    console.error('Puppeteer scraping failed:', error);
    results.errors.push(`Puppeteer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Run SerpAPI scraper if search params provided
  if (searchParams) {
    try {
      results.serpapi = await scrapeJobsWithSerpAPI(searchParams);
    } catch (error) {
      console.error('SerpAPI scraping failed:', error);
      results.errors.push(`SerpAPI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  results.total = results.puppeteer + results.serpapi;
  
  console.log(`Total jobs scraped: ${results.total} (Puppeteer: ${results.puppeteer}, SerpAPI: ${results.serpapi})`);
  
  if (results.errors.length > 0) {
    console.log('Scraping errors:', results.errors);
  }

  return results;
}