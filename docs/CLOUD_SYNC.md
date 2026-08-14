# Cloud sync architecture

Recovery Tracker stays **local-first**. Browser `localStorage` (`recovery-tracker-v2`) is the source of truth for the UI. Supabase Auth + Postgres is an optional account layer.

The app must open while signed out, offline, or when sync fails. Sync failure never clears local data.

## Conflict strategy

Collections are merged **per record by stable ID**, not by replacing the whole database.

1. **Identity** — `id` (string or number, compared as string). Never array position.
2. **Create** — an ID that exists on only one side is kept (union).
3. **Update** — if both sides have the ID, the row with the later `updatedAt` wins. If timestamps tie, the higher `syncVersion` wins. If those tie, local wins (do not flap).
4. **Delete** — deletes become **tombstones** (`deletedAt`). A tombstone newer than a live row wins. A live row newer than a tombstone is restored. Tombstones are stored in the cloud row (`deleted_at`) so another device does not resurrect a deleted record.
5. **Settings / Quick Log prefs / primary substance** — last-write-wins on the `user_settings` document using `updated_at`. An **empty** cloud settings document never overwrites populated local settings.
6. **Goals** — never synced or created.
7. **PIN hash** — never synced (device-local).

## First sign-in

If this device has logs/purchases/tapers and the cloud account is empty, the app **offers** “Back up this device’s data to your account”. It does not push automatically, and it never replaces local data with an empty cloud.

If both sides have data, they are merged with the rules above, then the result is saved locally and pushed.

## Offline-first write path

User saves → `saveData` writes localStorage → UI updates → a debounced cloud push runs afterward.

## Auth

Supabase Auth (email + password) handles create account, sign in, sign out, and password recovery. No custom password hashing in the app.

The client stays a vanilla `fetch` transport (no `@supabase/supabase-js` bundle) so Capacitor, static Vercel, and the Node test harness can inject a memory backend. Session handling matches GoTrue:

1. Sign-in/sign-up stores `accessToken`, `refreshToken`, and `expiresAt` in `localStorage` (`recovery-tracker-v2-auth`).
2. Reload restores that session.
3. Before sync, if the access token is expired (or within 60 seconds of expiry), the client calls `/auth/v1/token?grant_type=refresh_token` and writes the rotated tokens.
4. If refresh fails, the client **signs out of cloud only**. Local recovery data is never deleted.
5. Sync stays paused until the user signs in again.

The browser never receives the service-role key.

**Delete Cloud Data** calls `delete_own_cloud_data()` and does **not** delete the Auth login.

**Delete Account** calls the `delete-account` Edge Function, which deletes cloud rows then the Auth user. Deploy that function with `SUPABASE_SERVICE_ROLE_KEY` as a **function secret** before using it. Local device data is kept unless the user also chooses Delete data from this device.

## RLS verification

See comments at the end of `supabase/migrations/001_recovery_tracker_cloud.sql`. Automated checks live in `tests/cloud-rls-schema.test.mjs` (SQL text). After applying the migration, run the two-user checks in the SQL editor before production.

If `001` was already applied, also run `002_secure_definer_privileges.sql`.

### SECURITY DEFINER privileges

| Function | Client RPC? | Grants |
|---|---|---|
| `public.delete_own_cloud_data()` | Yes (Delete Cloud Data) | `EXECUTE` for `authenticated` only. Restricted to `auth.uid()`. `search_path` is empty; tables are schema-qualified. |
| `public.ensure_own_profile()` | No | No `EXECUTE` for `public`, `anon`, or `authenticated`. |
| `public.rls_auto_enable()` | No (event-trigger helper) | `EXECUTE` revoked from `public`, `anon`, and `authenticated` when the function exists. |

PostgreSQL grants `EXECUTE` to `PUBLIC` by default; both migrations revoke that before applying the minimum client grant.

## Environment variables

Local (`.env.local`) and Vercel (Production, Preview, and Development):

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | Client build | Project URL |
| `SUPABASE_ANON_KEY` | Client build | Public anon key for Auth + RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Optional Edge Function / admin. Never add this to Vercel client env that gets inlined into `cloud-config.js`. |

`scripts/write-cloud-config.mjs` writes `dist/cloud-config.js` during `npm run build`. Capacitor `webDir` is `dist`, so iOS picks up that file. Without the two public variables, the app stays signed-out/local-only.

## Database

Tables (all owned by `user_id`, RLS `user_id = auth.uid()`): `profiles`, `user_settings`, `substances`, `use_logs`, `purchases`, `taper_plans`, `contacts`, `cravings`, `budgets`.

Apply `supabase/migrations/001_recovery_tracker_cloud.sql` on a new project before enabling production sync. If 001 was already applied, run `002_secure_definer_privileges.sql` as well. Do not invent credentials or deploy an incomplete schema.
