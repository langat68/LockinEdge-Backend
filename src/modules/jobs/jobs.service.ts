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
          description: job.description || job.snippet || ''
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

// BrighterMonday Kenya scraper
export async function scrapeBrighterMondayJobs() {
  console.log("Scraping jobs from BrighterMonday Kenya...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  let allJobs: any[] = [];
  let pageNum = 1;
  const maxPages = 5; // Limit to first 5 pages to start

  try {
    while (pageNum <= maxPages) {
      const url = pageNum === 1
        ? 'https://www.brightermonday.co.ke/jobs'
        : `https://www.brightermonday.co.ke/jobs?page=${pageNum}`;

      console.log(`Scraping BrighterMonday page ${pageNum}...`);

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000
      });

      // Wait for job listings to load
      await page.waitForSelector('div[class*="job"]', { timeout: 10000 }).catch(() => {
        console.log(`No job listings found on page ${pageNum}`);
      });

      const jobData = await page.evaluate(() => {
        const jobs = [];

        // Try multiple selectors as the site structure might vary
        const jobElements = document.querySelectorAll('div[class*="job"], .job-item, [data-job], .listing');

        for (const jobElement of jobElements) {
          try {
            // Extract job title
            const titleElement = jobElement.querySelector('h2 a, h3 a, .job-title a, a[href*="/job/"]');
            const title = titleElement?.textContent?.trim();

            // Extract company name
            const companyElement = jobElement.querySelector('.company-name, [class*="company"], .employer');
            const company = companyElement?.textContent?.trim();

            // Extract location
            const locationElement = jobElement.querySelector('[class*="location"], .job-location, .location');
            const location = locationElement?.textContent?.trim() || 'Kenya';

            // Extract job function/category
            const categoryElement = jobElement.querySelector('[class*="function"], .job-function, .category');
            const category = categoryElement?.textContent?.trim();

            // Extract description/summary
            const descElement = jobElement.querySelector('.job-summary, .description, [class*="summary"]');
            let description = descElement?.textContent?.trim() || '';

            // If no description found, try to get some text content
            if (!description && jobElement.textContent) {
              const text = jobElement.textContent.trim();
              description = text.length > 100 ? text.substring(0, 200) + '...' : text;
            }

            // Add category to description if available
            if (category && !description.includes(category)) {
              description = `${category}. ${description}`;
            }

            // Extract posting date
            const dateElement = jobElement.querySelector('[class*="date"], .posted-date, time');
            const postedDate = dateElement?.textContent?.trim();

            if (title && (company || location)) {
              jobs.push({
                title: title,
                company: company || 'Not specified',
                location: location,
                description: description,
                category: category,
                postedDate: postedDate,
                source: 'brightermonday-kenya'
              });
            }
          } catch (error) {
            console.error('Error parsing job element:', error);
            continue;
          }
        }

        return jobs;
      });

      console.log(`Found ${jobData.length} jobs on page ${pageNum}`);
      allJobs = [...allJobs, ...jobData];

      // Check if there are more pages
      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('a[rel="next"], .pagination .next, [class*="next"]');
        return nextButton && !nextButton.classList.contains('disabled');
      });

      if (!hasNextPage || jobData.length === 0) {
        console.log('No more pages or no jobs found, stopping pagination');
        break;
      }

      pageNum++;

      // Add delay between pages
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await browser.close();

    // Store jobs in database
    let storedCount = 0;
    for (const job of allJobs) {
      try {
        await createJob({
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description
        });
        storedCount++;
      } catch (error) {
        console.error('Error storing BrighterMonday job:', error);
        continue;
      }
    }

    console.log(`Scraped and stored ${storedCount} jobs from BrighterMonday Kenya.`);
    return storedCount;

  } catch (error) {
    console.error('BrighterMonday scraping error:', error);
    await browser.close();
    return 0;
  }
}

// Corporate Staffing Services Kenya scraper
export async function scrapeCorporateStaffingJobs() {
  console.log("Scraping jobs from Corporate Staffing Services Kenya...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  let allJobs: any[] = [];
  let pageNum = 1;
  const maxPages = 3; // Their site seems smaller, limit to 3 pages

  try {
    while (pageNum <= maxPages) {
      const url = pageNum === 1
        ? 'https://www.corporatestaffing.co.ke/jobs/'
        : `https://www.corporatestaffing.co.ke/jobs/page/${pageNum}/`;

      console.log(`Scraping Corporate Staffing page ${pageNum}...`);

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      const jobData = await page.evaluate(() => {
        const jobs = [];

        // Look for job titles and content patterns from the site
        const jobTitleElements = document.querySelectorAll('h1, h2, h3, strong, b');
        const textContent = document.body.textContent || '';

        // Extract job listings from text content
        const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        let currentJob: any = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Look for job titles (usually contain "Job" at the end or common job keywords)
          if (line.includes('Job') && line.length > 10 && line.length < 100) {
            // Save previous job if exists
            if (currentJob && currentJob.title) {
              jobs.push(currentJob);
            }

            // Start new job
            currentJob = {
              title: line.replace(/\s+Job\s*$/, '').trim(),
              company: 'Not specified',
              location: 'Kenya',
              description: '',
              source: 'corporate-staffing-kenya'
            };
          }

          // Look for company mentions or descriptions
          if (currentJob && line.length > 20 && line.length < 500) {
            // Skip navigation and generic text
            if (!line.includes('Browse') && !line.includes('Apply') &&
              !line.includes('www.') && !line.includes('Click') &&
              !line.includes('Fee') && !line.includes('Scam')) {

              if (currentJob.description.length < 300) {
                currentJob.description += (currentJob.description ? ' ' : '') + line;
              }

              // Extract company name if mentioned
              if (line.includes('Limited') || line.includes('Ltd') ||
                line.includes('Company') || line.includes('Group')) {
                const words = line.split(' ');
                for (let j = 0; j < words.length - 1; j++) {
                  if ((words[j + 1] === 'Limited' || words[j + 1] === 'Ltd') && words[j].length > 2) {
                    currentJob.company = words[j] + ' ' + words[j + 1];
                    break;
                  }
                }
              }
            }
          }
        }

        // Add the last job if exists
        if (currentJob && currentJob.title) {
          jobs.push(currentJob);
        }

        // Filter out jobs with very short titles or descriptions
        return jobs.filter(job =>
          job.title.length > 5 &&
          job.description.length > 20 &&
          !job.title.toLowerCase().includes('browse') &&
          !job.title.toLowerCase().includes('apply')
        );
      });

      console.log(`Found ${jobData.length} jobs on Corporate Staffing page ${pageNum}`);
      allJobs = [...allJobs, ...jobData];

      // Simple pagination check - if no jobs found, stop
      if (jobData.length === 0) {
        console.log('No jobs found, stopping pagination');
        break;
      }

      pageNum++;

      // Add delay between pages
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await browser.close();

    // Store jobs in database
    let storedCount = 0;
    for (const job of allJobs) {
      try {
        await createJob({
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          jobType: null,
          salary: null
        });
        storedCount++;
      } catch (error) {
        console.error('Error storing Corporate Staffing job:', error);
        continue;
      }
    }

    console.log(`Scraped and stored ${storedCount} jobs from Corporate Staffing Kenya.`);
    return storedCount;

  } catch (error) {
    console.error('Corporate Staffing scraping error:', error);
    await browser.close();
    return 0;
  }
}

// MyJobMag Kenya scraper
export async function scrapeMyJobMagJobs() {
  console.log("Scraping jobs from MyJobMag Kenya...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  let allJobs: any[] = [];
  let pageNum = 1;
  const maxPages = 5; // Limit to first 5 pages

  try {
    while (pageNum <= maxPages) {
      const url = pageNum === 1
        ? 'https://www.myjobmag.co.ke/'
        : `https://www.myjobmag.co.ke/page/${pageNum}`;

      console.log(`Scraping MyJobMag page ${pageNum}...`);

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      const jobData = await page.evaluate(() => {
        const jobs = [];

        // Look for various job listing patterns
        const jobElements = document.querySelectorAll(
          'article, .job, .post, .entry, [class*="job"], [class*="post"], .listing'
        );

        for (const jobElement of jobElements) {
          try {
            // Try to extract job title from headers or links
            const titleElement = jobElement.querySelector(
              'h1 a, h2 a, h3 a, h4 a, .title a, .job-title a, a[href*="job"]'
            ) || jobElement.querySelector('h1, h2, h3, h4, .title, .job-title');

            const title = titleElement?.textContent?.trim();

            // Extract company information
            let company = 'Not specified';
            const companyElement = jobElement.querySelector(
              '.company, [class*="company"], .employer, [class*="employer"]'
            );
            if (companyElement) {
              company = companyElement.textContent?.trim() || company;
            }

            // Extract description
            let description = '';
            const descElement = jobElement.querySelector(
              '.excerpt, .summary, .description, .content, p'
            );
            if (descElement) {
              description = descElement.textContent?.trim() || '';
            } else if (jobElement.textContent) {
              // Fallback to element text content
              const text = jobElement.textContent.trim();
              description = text.length > 100 ? text.substring(0, 300) + '...' : text;
            }

            // Extract location
            let location = 'Kenya';
            const locationElement = jobElement.querySelector(
              '.location, [class*="location"], .address'
            );
            if (locationElement) {
              location = locationElement.textContent?.trim() || location;
            } else if (description.includes('Nairobi')) {
              location = 'Nairobi, Kenya';
            } else if (description.includes('Mombasa')) {
              location = 'Mombasa, Kenya';
            } else if (description.includes('Kisumu')) {
              location = 'Kisumu, Kenya';
            }

            if (title && title.length > 5 && description.length > 20) {
              jobs.push({
                title: title,
                company: company,
                location: location,
                description: description,
                source: 'myjobmag-kenya'
              });
            }
          } catch (error) {
            console.error('Error parsing MyJobMag job element:', error);
            continue;
          }
        }

        // Also try to extract from text content if structured extraction fails
        if (jobs.length === 0) {
          const textContent = document.body.textContent || '';
          const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Look for lines that might be job titles
            if (line.length > 10 && line.length < 100 &&
              (line.includes('Officer') || line.includes('Manager') ||
                line.includes('Specialist') || line.includes('Coordinator') ||
                line.includes('Assistant') || line.includes('Executive') ||
                line.includes('Analyst') || line.includes('Developer') ||
                line.includes('Engineer') || line.includes('Consultant'))) {

              let description = '';
              // Get next few lines as description
              for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                if (lines[j].length > 20 && lines[j].length < 200) {
                  description += lines[j] + ' ';
                  if (description.length > 200) break;
                }
              }

              if (description.trim().length > 20) {
                jobs.push({
                  title: line,
                  company: 'Not specified',
                  location: 'Kenya',
                  description: description.trim(),
                  source: 'myjobmag-kenya'
                });
              }
            }
          }
        }

        return jobs;
      });

      console.log(`Found ${jobData.length} jobs on MyJobMag page ${pageNum}`);
      allJobs = [...allJobs, ...jobData];

      // Check if we should continue pagination
      const hasContent = await page.evaluate(() => {
        return document.body.textContent && document.body.textContent.length > 1000;
      });

      if (!hasContent || jobData.length === 0) {
        console.log('No more content found, stopping pagination');
        break;
      }

      pageNum++;

      // Add delay between pages
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await browser.close();

    // Store jobs in database
    let storedCount = 0;
    const uniqueTitles = new Set();

    for (const job of allJobs) {
      try {
        // Avoid duplicates based on title
        if (!uniqueTitles.has(job.title.toLowerCase())) {
          uniqueTitles.add(job.title.toLowerCase());

          await createJob({
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            jobType: null,
            salary: null
          });
          storedCount++;
        }
      } catch (error) {
        console.error('Error storing MyJobMag job:', error);
        continue;
      }
    }

    console.log(`Scraped and stored ${storedCount} jobs from MyJobMag Kenya.`);
    return storedCount;

  } catch (error) {
    console.error('MyJobMag scraping error:', error);
    await browser.close();
    return 0;
  }
}

// Combined function to run all scrapers
export async function scrapeAllJobs(searchParams?: SerpAPISearchParams) {
  console.log("Running all job scrapers...");

  const results = {
    puppeteer: 0,
    serpapi: 0,
    brightermonday: 0,
    corporatestaffing: 0,
    myjobmag: 0,
    total: 0,
    errors: [] as string[]
  };

  // Run Puppeteer scraper (Indeed)
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

  // Run all Kenyan job site scrapers
  try {
    results.brightermonday = await scrapeBrighterMondayJobs();
  } catch (error) {
    console.error('BrighterMonday scraping failed:', error);
    results.errors.push(`BrighterMonday: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    results.corporatestaffing = await scrapeCorporateStaffingJobs();
  } catch (error) {
    console.error('Corporate Staffing scraping failed:', error);
    results.errors.push(`Corporate Staffing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    results.myjobmag = await scrapeMyJobMagJobs();
  } catch (error) {
    console.error('MyJobMag scraping failed:', error);
    results.errors.push(`MyJobMag: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  results.total = results.puppeteer + results.serpapi + results.brightermonday +
    results.corporatestaffing + results.myjobmag;

  console.log(`Total jobs scraped: ${results.total}`);
  console.log(`- Puppeteer (Indeed): ${results.puppeteer}`);
  console.log(`- SerpAPI (Google Jobs): ${results.serpapi}`);
  console.log(`- BrighterMonday Kenya: ${results.brightermonday}`);
  console.log(`- Corporate Staffing Kenya: ${results.corporatestaffing}`);
  console.log(`- MyJobMag Kenya: ${results.myjobmag}`);

  if (results.errors.length > 0) {
    console.log('Scraping errors:', results.errors);
  }

  return results;
}