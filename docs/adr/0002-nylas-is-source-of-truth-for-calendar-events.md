# Nylas is the source of truth for all calendar events

The app never stores calendar events in Supabase. All session and availability data is read live from Nylas. When a tutor modifies or cancels a session directly in their connected calendar (Google, Outlook, etc.), that change must be reflected in the app.

This requires Nylas webhooks to push event changes to the app in real time (or near real time). The app must not assume its view of a tutor's calendar is accurate without a live Nylas read or a recent webhook update. Webhooks are planned but not yet implemented — `/api/nylas/` is a placeholder. Until webhooks are live, the app fetches fresh from Nylas on each page load.

## Consequence

Capacity calculations (`lib/utils/capacity.ts`) must always be driven by fresh Nylas event data, not a local cache. Any UI that displays a tutor's schedule must be backed by a Nylas fetch, not a Supabase query.
