# Omar Mosque Prayer Times

Mobile-first Berlin prayer times with Gregorian and calendar-calculated Hijri dates, a Berlin clock, next-prayer countdown, and the official mosque PDF.

## Official timetable updates

The Worker checks https://ivwp.de/ivwp/omar-moschee/ on demand, caching its latest Berlin PDF for five minutes. The open website rechecks every five minutes and when brought back into view. The PDF is served over HTTPS through the Worker.

October 2026 rows were visually verified and are used only if the downloaded PDF matches their SHA-256 fingerprint. New PDFs are read in the browser using PDF.js and Tesseract OCR. Extraction requires a complete month, six valid times per row, and chronological prayer order. This reader assumes the mosque's current six-column Berlin layout; a layout change or unreadable PDF may require maintenance. OCR can make mistakes, so the official PDF remains available for comparison.

No calculated or invented prayer times are substituted. If the published schedule does not cover a date or extraction fails, the site displays an unavailable message. Tomorrow's Fajr uses tomorrow's row; month-end does not reuse today's Fajr. All countdowns use Europe/Berlin, including daylight-saving changes, regardless of the device timezone.

## Deploy

Connect this repository to Cloudflare Workers. Use `npx wrangler deploy`; no build command or secrets are needed. `wrangler.toml` points to `index.js`. GitHub Pages cannot run this Worker.
