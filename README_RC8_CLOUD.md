# PowerAI RC8 — User Accounts & Cloud Lock

- Supabase email/password authentication.
- Per-user cloud state protected by Row Level Security.
- Existing localStorage remains a cache only; after login the app hydrates from that user's cloud record.
- A/B/C lock, L lock, result logs, learning report and selected UI tab are synced.
- Logging out clears PowerAI local cache from the browser to avoid showing the previous user's data.
- Recovery rule: if a draw was locked and still has no result, reopening the app restores that locked draw instead of defaulting to a fresh next draw.
- Public Supabase publishable key is intentionally client-side; RLS isolates rows by auth.uid().
