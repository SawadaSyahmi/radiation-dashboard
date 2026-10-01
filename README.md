# Radiation Monitoring Dashboard

A static GitHub Pages dashboard for the FS-5000 → ESP32-S3 → Supabase radiation monitoring project.

## Features

- Live dose rate, dose, CPS, CPM and average
- Device/feed health and last-reading age
- Historical dose-rate trend chart
- Recent readings table
- Warning flag display
- Auto-refresh every 5 seconds
- CSV export
- Responsive desktop/mobile layout
- No server or build step required

## Supabase

The dashboard reads:

`public.radiation_readings`

Expected columns:

- `created_at`
- `device_id`
- `dose_rate`
- `dose`
- `cps`
- `cpm`
- `average`
- `detector_time`
- `detector_s`
- `warning`

### Required RLS read policy

Run in Supabase SQL Editor if the dashboard should be publicly readable:

```sql
alter table public.radiation_readings
enable row level security;

grant select
on table public.radiation_readings
to anon;

create policy "Public dashboard read"
on public.radiation_readings
for select
to anon
using (true);
```

If you already have RLS policies, adapt this instead of creating a duplicate policy.

## Configuration

Edit `config.js`.

```js
window.RADIATION_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_KEY: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  TABLE: "radiation_readings",
  REFRESH_MS: 5000,
  DEFAULT_LIMIT: 60
};
```

A browser dashboard necessarily exposes its publishable/anon key. Security must come from Supabase Row Level Security. Never put a `service_role` or secret key in this site.

## Publish with GitHub Pages

1. Create a GitHub repository, for example `radiation-dashboard`.
2. Upload all files in this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose your default branch (normally `main`) and `/ (root)`.
6. Save.
7. GitHub Pages will publish the static files.

For a user site such as `username.github.io`, the repository can be named exactly `username.github.io`.

## Local preview

Because the dashboard uses browser `fetch()`, preview it through a local web server instead of opening `index.html` directly.

Python:

```bash
python -m http.server 8080
```

Then visit:

`http://localhost:8080`

## Notes

- `config.js` currently contains the project URL and anon key supplied for this project.
- Supabase now recommends publishable keys (`sb_publishable_...`) for browser applications.
- The visualization bands in `config.js` are dashboard display categories only; they are not regulatory or medical safety guidance.
