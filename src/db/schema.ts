import {pgTable,uuid,varchar,timestamp,jsonb,real,} from "drizzle-orm/pg-core";



// Users table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Resumes table
export const resumes = pgTable("resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  analysis: jsonb("analysis"), // stores AI feedback
  // embedding: vector("embedding", { dimensions: 1536 }),  for semantic search
  createdAt: timestamp("created_at").defaultNow(),
});

// Jobs table
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  description: varchar("description", { length: 2000 }),
  skills: jsonb("skills"), // array of skills/tags
  // embedding: vector("embedding", { dimensions: 1536 }), //  for semantic search
  createdAt: timestamp("created_at").defaultNow(),
});

// Matches table
export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  resumeId: uuid("resume_id").references(() => resumes.id).notNull(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  score: real("score"), // relevance score from AI
  matchedAt: timestamp("matched_at").defaultNow(),
});
