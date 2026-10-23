// Public Supabase connection. The anon key is safe in the browser: every table is protected by row-level security.
window.MASKATI_CONFIG = {
  supabaseUrl: "https://ejfdehlcevarzrxahipn.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZmRlaGxjZXZhcnpyeGFoaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzYzMDQsImV4cCI6MjEwODM1MjMwNH0.SUPg6c1as0cZSwcN3LcWImgX9KeRBWG8S2vgZfKT2Xw"
};
window.db = window.supabase.createClient(window.MASKATI_CONFIG.supabaseUrl, window.MASKATI_CONFIG.supabaseAnonKey);
