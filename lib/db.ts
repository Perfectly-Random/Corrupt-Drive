import { neon } from "@neondatabase/serverless";
export function db(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is not configured");return neon(process.env.DATABASE_URL)}
let ready=false;
export async function ensureSchema(){if(ready)return;const sql=db();await sql`
CREATE TABLE IF NOT EXISTS cd_users(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
)`;await sql`
CREATE TABLE IF NOT EXISTS cd_progress(
 user_id UUID PRIMARY KEY REFERENCES cd_users(id) ON DELETE CASCADE,
 state JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT now()
)`;ready=true}