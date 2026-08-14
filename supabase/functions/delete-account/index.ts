// Delete the signed-in user's Recovery Tracker cloud rows AND Auth user.
// Deploy only after SUPABASE_SERVICE_ROLE_KEY is set as a function secret.
// The browser must never receive this key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLOUD_TABLES = [
    'budgets',
    'cravings',
    'contacts',
    'taper_plans',
    'purchases',
    'use_logs',
    'substances',
    'user_settings',
    'profiles'
];

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cors() });
    }
    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!supabaseUrl || !serviceKey || !anonKey) {
        return json({ error: 'Account deletion is not configured' }, 503);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
        return json({ error: 'Not authenticated' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    for (const table of CLOUD_TABLES) {
        const { error } = await admin.from(table).delete().eq('user_id', user.id);
        if (error) {
            return json({ error: 'Could not delete account data' }, 500);
        }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
        return json({ error: 'Could not delete account' }, 500);
    }
    return json({ ok: true, authUserDeleted: true });
});

function cors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type'
    };
}

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors(), 'Content-Type': 'application/json' }
    });
}
