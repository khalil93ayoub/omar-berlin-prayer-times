# Web prayer reminders

Open the installed Home Screen app online. Tap Enable prayer reminders, allow notifications, then Send test notification. Reminders are scheduled ten minutes before each of the five daily prayers, in Europe/Berlin time. Sunrise is excluded.

The Cloudflare SQLite Durable Object stores an encrypted-push subscription, a random device management token, and the selected official timetable's reminder events. VAPID keys are generated once inside the object and stored there; private keys are never in GitHub or returned to the client. Wrangler creates the binding via the migration. No paid Apple membership or weekly app signing is required. Cloudflare usage limits still apply.

The service sends Web Push even while the page is closed. Internet and notification permission are required on the phone; Focus settings, network connectivity and push-service delivery can delay or suppress alerts. Messages expire after 120 seconds to avoid stale reminders. Scheduled reminders extend through the saved timetable only: open the app online when each new timetable appears. The UI shows the saved-through date.

The app provides a test and a disable button. Disabling removes this device's schedule and unsubscribes the browser. Expired push endpoints (404/410) are removed. No notification is enabled by default. This personal deployment caps subscriptions at 100.

Offline caching remains available for the countdown. Notifications are not offline alarms. Future OCR rows are validated for complete-month structure and tied to the currently published PDF fingerprint, but cannot be independently verified against image pixels by the server. Compare the official PDF if OCR appears wrong.
