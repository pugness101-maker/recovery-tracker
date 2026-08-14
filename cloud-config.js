/* Recovery Tracker cloud config (public anon key only — never put the service-role key here).
 * Local/Vercel/iOS builds overwrite dist/cloud-config.js when SUPABASE_URL and SUPABASE_ANON_KEY are set.
 * This committed file stays unconfigured so the app runs signed-out without secrets. */
window.__RECOVERY_TRACKER_CLOUD__ = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    configured: false
};
