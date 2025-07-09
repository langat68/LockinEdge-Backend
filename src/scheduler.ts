import cron from 'node-cron';
import { scrapeAndStoreJobs } from './modules/jobs/jobs.service.js';

// Schedule the job scraper to run every day at midnight
cron.schedule('0 0 * * *', () => {
  console.log('Running daily job scraper...');
  scrapeAndStoreJobs().catch(console.error);
});

console.log('Job scraper scheduled to run daily at midnight.');
