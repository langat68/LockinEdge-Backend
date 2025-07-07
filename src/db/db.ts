// src/db/db.ts 
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js'; // schema file with `pgTable(...)`

//  DATABASE_URL from .env or directly
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
