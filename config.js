// ======================================================
// Radiation Dashboard Configuration
// ======================================================
//
// A Supabase anon/publishable key is expected to be visible
// in a browser-based application. Protect the database with
// Row Level Security (RLS).
//
// For new Supabase projects, prefer an sb_publishable_... key.
// The legacy anon JWT also works while Supabase supports it.

window.RADIATION_CONFIG = {
  SUPABASE_URL: "https://apurcekxdaaytsgtvbnq.supabase.co",

  // Legacy anon key supplied for this project.
  // Replace with an sb_publishable_... key later if desired.
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwdXJjZWt4ZGFheXRzZ3R2Ym5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NzAyMzQsImV4cCI6MjEwNjE0NjIzNH0.03sqLnJDmsh3USiuyFH6-cmKRnuwSDzD-_EDesOrISU",

  TABLE: "radiation_readings",
  REFRESH_MS: 5000,
  DEFAULT_LIMIT: 60,

  // Visual display bands only. Adjust to suit your project.
  DISPLAY_BANDS: {
    GOOD_MAX: 0.30,
    ELEVATED_MAX: 1.00
  }
};
