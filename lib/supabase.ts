import { createClient } from "@supabase/supabase-js";

// Public connection. The anon key is safe in the browser: every table is protected by row-level security.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ejfdehlcevarzrxahipn.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZmRlaGxjZXZhcnpyeGFoaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzYzMDQsImV4cCI6MjEwODM1MjMwNH0.SUPg6c1as0cZSwcN3LcWImgX9KeRBWG8S2vgZfKT2Xw";

export const db = createClient(url, anonKey);
