import { config } from "dotenv";
import { db } from "../../db/db.js";
import { resumes } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";
config();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export class RecommendationService {
    static async scrapeJobs(skills, location) {
        const allJobs = [];
        console.log(`🔍 Scraping jobs for skills: [${skills.join(", ")}]`);
        try {
            const indeedJobs = await this.scrapeIndeedJobs(skills, location);
            const remoteJobs = await this.scrapeRemoteOkJobs(skills);
            allJobs.push(...indeedJobs, ...remoteJobs);
            console.log(`✅ Scraped ${allJobs.length} jobs`);
        }
        catch (error) {
            console.error("Error scraping jobs:", error);
        }
        return allJobs;
    }
    static async scrapeIndeedJobs(skills, location) {
        const query = skills.slice(0, 3).join(" OR ");
        const locationParam = location || "remote";
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(locationParam)}&sort=date`;
        try {
            const response = await fetch(url, {
                headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (!response.ok)
                return [];
            const html = await response.text();
            const $ = cheerio.load(html);
            const jobs = [];
            $(".job_seen_beacon, .slider_container .slider_item").each((_, element) => {
                const $job = $(element);
                const title = $job.find("h2 a span, [data-jk] span").first().text().trim();
                const company = $job.find('[data-testid="company-name"] span').text().trim();
                const location = $job.find('[data-testid="job-location"]').text().trim();
                const description = $job.find(".job-snippet").text().trim();
                const jobUrl = $job.find("h2 a").attr("href");
                if (title && company && jobUrl) {
                    jobs.push({
                        title,
                        company,
                        location,
                        description,
                        requirements: this.extractRequirements(description),
                        url: jobUrl.startsWith("http") ? jobUrl : `https://www.indeed.com${jobUrl}`,
                        source: "Indeed",
                        postedDate: new Date().toISOString(),
                    });
                }
            });
            return jobs.slice(0, 15);
        }
        catch (error) {
            console.error("Error scraping Indeed:", error);
            return [];
        }
    }
    static async scrapeRemoteOkJobs(skills) {
        try {
            const response = await fetch("https://remoteok.io/api", {
                headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (!response.ok)
                return [];
            const data = await response.json();
            const jobs = [];
            data.slice(1, 16).forEach((job) => {
                if (job.position && job.company) {
                    const description = job.description || "";
                    const matchesSkills = skills.some((skill) => description.toLowerCase().includes(skill.toLowerCase()) ||
                        job.position.toLowerCase().includes(skill.toLowerCase()));
                    if (matchesSkills) {
                        jobs.push({
                            title: job.position,
                            company: job.company,
                            location: job.location || "Remote",
                            description,
                            requirements: this.extractRequirements(description),
                            salary: job.salary_min && job.salary_max
                                ? `$${job.salary_min} - $${job.salary_max}`
                                : undefined,
                            url: job.url,
                            source: "RemoteOK",
                            postedDate: job.date,
                        });
                    }
                }
            });
            return jobs;
        }
        catch (error) {
            console.error("Error scraping RemoteOK:", error);
            return [];
        }
    }
    static extractRequirements(description) {
        const commonSkills = [
            "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "C#",
            "Angular", "Vue.js", "Express", "Django", "MongoDB", "PostgreSQL", "MySQL",
            "AWS", "Docker", "Git", "REST", "GraphQL", "HTML", "CSS",
        ];
        const found = commonSkills.filter((skill) => description.toLowerCase().includes(skill.toLowerCase()));
        return [...new Set(found)];
    }
    static async analyzeJobCompatibility(resume, job) {
        const prompt = `
Analyze compatibility between this resume and job. Return ONLY valid JSON:

{
  "score": number (0-100),
  "matchingSkills": [string],
  "missingSkills": [string],
  "reasoning": string
}

Resume Skills: ${resume.analysis?.skills?.join(", ") || "None"}
Experience: ${resume.analysis?.experience || 0} years

Job: ${job.title} at ${job.company}
Requirements: ${job.requirements.join(", ")}
Description: ${job.description.substring(0, 500)}
`;
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-r1:free",
                    messages: [
                        { role: "system", content: "You are a job matching expert. Respond only with valid JSON." },
                        { role: "user", content: prompt },
                    ],
                    temperature: 0,
                }),
            });
            if (!response.ok)
                throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            let content = data.choices?.[0]?.message?.content?.trim() || "{}";
            // clean invalid ```json wrappers
            content = content.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
            return JSON.parse(content);
        }
        catch (error) {
            console.error("Error analyzing compatibility:", error);
            return {
                score: 0,
                matchingSkills: [],
                missingSkills: [],
                reasoning: "Analysis failed",
            };
        }
    }
    static async generateRecommendations(resumeId) {
        const resume = await db.query.resumes.findFirst({
            where: eq(resumes.id, resumeId),
        });
        if (!resume || !resume.analysis) {
            throw new Error("Resume not found or not analyzed");
        }
        const normalizedResume = {
            ...resume,
            userId: resume.userId,
            analysis: resume.analysis,
        };
        const skills = normalizedResume.analysis.skills || [];
        console.log(`📝 Resume Skills: [${skills.join(", ")}]`);
        const jobs = await this.scrapeJobs(skills);
        const recommendations = [];
        for (const job of jobs) {
            const compatibility = await this.analyzeJobCompatibility(normalizedResume, job);
            if (compatibility.score >= 20) {
                recommendations.push({
                    jobTitle: job.title,
                    company: job.company,
                    location: job.location,
                    description: job.description,
                    requirements: job.requirements,
                    salary: job.salary,
                    jobUrl: job.url,
                    source: job.source,
                    compatibilityScore: compatibility.score,
                    matchingSkills: compatibility.matchingSkills,
                    missingSkills: compatibility.missingSkills,
                    reasoning: compatibility.reasoning,
                });
            }
        }
        console.log(`🎯 Found ${recommendations.length} good matches`);
        return recommendations
            .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
            .slice(0, 10);
    }
}
