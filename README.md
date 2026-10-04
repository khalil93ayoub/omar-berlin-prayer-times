# Omar Mosque Prayer Times

A mobile-first Berlin prayer-times website for Omar Ibn Al-Khattab Mosque. It shows the current Gregorian and Hijri date, a live next-prayer countdown, and the mosque's current official monthly timetable.

## Automatic source update

The site checks https://ivwp.de/ivwp/omar-moschee/ whenever it is opened. It finds the latest published Berlin PDF, serves the timetable, and reads its daily prayer rows for the countdown. The server rechecks the source at least every five minutes.

## Deploy from GitHub

This project is a Cloudflare Worker because it needs to fetch the mosque's official PDF without browser CORS restrictions. GitHub Pages alone cannot run the automatic timetable update.

1. In Cloudflare, create a Worker from this GitHub repository.
2. Use wrangler.toml as the configuration; its entry point is index.js.
3. Deploy. No keys or environment variables are required.

For local deployment with Wrangler, run npx wrangler deploy from the project folder after authenticating with your Cloudflare account.
