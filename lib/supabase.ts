// Supabase client initialization.
// Fill in the values from your Supabase project (Project Settings > API).
// Put them in .env.local (see .env.local.example) — the anon key is a "public" key by design
// (Row Level Security policies in supabase/schema.sql do the real protecting), but never commit
// your service_role key or paste it into client code.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
