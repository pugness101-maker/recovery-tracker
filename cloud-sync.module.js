// ——— Cloud Sync (optional account layer) ———
// LocalStorage remains the immediate source of truth.
// Cloud sync is best-effort, per-record, and must never wipe local data on failure.

const CLOUD_AUTH_KEY = 'recovery-tracker-v2-auth';
const CLOUD_META_KEY = 'recovery-tracker-v2-cloud-meta';
const CLOUD_SYNC_DEBOUNCE_MS = 800;
const CLOUD_AUTH_REFRESH_SKEW_MS = 60 * 1000;

const CLOUD_COLLECTIONS = Object.freeze([
    { key: 'logs', table: 'use_logs', prefix: 'use' },
    { key: 'purchases', table: 'purchases', prefix: 'purchase' },
    { key: 'substances', table: 'substances', prefix: 'substance' },
    { key: 'taperPlansV2', table: 'taper_plans', prefix: 'taper' },
    { key: 'contacts', table: 'contacts', prefix: 'contact' },
    { key: 'cravings', table: 'cravings', prefix: 'craving' },
    { key: 'budgets', table: 'budgets', prefix: 'budget' }
]);

const CLOUD_STATUS = Object.freeze({
    saved: 'Saved',
    syncing: 'Syncing',
    offline: 'Offline',
    error: 'Sync error',
    signedOut: 'Saved'
});

let cloudTransport = null;
let cloudSyncTimer = null;
let cloudSyncInFlight = false;
let cloudSkipDeleteCapture = false;
let cloudUiState = {
    status: 'saved',
    lastSyncedAt: null,
    lastError: '',
    pendingBackupOffer: false
};

function getCloudConfig() {
    const injected = (typeof window !== 'undefined' && window.__RECOVERY_TRACKER_CLOUD__)
        || (typeof globalThis !== 'undefined' && globalThis.__RECOVERY_TRACKER_CLOUD__)
        || {};
    const url = String(injected.supabaseUrl || injected.SUPABASE_URL || '').trim();
    const anon = String(injected.supabaseAnonKey || injected.SUPABASE_ANON_KEY || '').trim();
    return {
        supabaseUrl: url.replace(/\/$/, ''),
        supabaseAnonKey: anon,
        configured: !!(url && anon && injected.configured !== false)
    };
}

function isCloudConfigured() {
    if (cloudTransport && typeof cloudTransport.isConfigured === 'function') {
        return cloudTransport.isConfigured();
    }
    return getCloudConfig().configured;
}

function sanitizeCloudError(err) {
    const raw = String(err?.message || err || 'Sync error');
    if (/token|jwt|password|api key|authorization|email|bearer/i.test(raw)) return 'Sync error';
    return raw.slice(0, 140);
}

function cloudNowIso() {
    return new Date().toISOString();
}

function recordIdKey(id) {
    return id == null || id === '' ? '' : String(id);
}

function recordUpdatedMs(record) {
    const iso = record?.updatedAt || record?.updated_at || record?.createdAt || record?.created_at;
    const ms = Date.parse(iso || '');
    return Number.isFinite(ms) ? ms : 0;
}

function recordSyncVersion(record) {
    const n = Number(record?.syncVersion ?? record?.sync_version ?? 1);
    return Number.isFinite(n) ? n : 1;
}

function recordDeletedAt(record) {
    return record?.deletedAt || record?.deleted_at || null;
}

function ensureSyncableRecordIds(data = appData) {
    if (!data || typeof data !== 'object') return data;
    const stamp = cloudNowIso();
    const assign = (list, prefix) => {
        if (!Array.isArray(list)) return;
        list.forEach(item => {
            if (!item || typeof item !== 'object') return;
            if (item.id == null || item.id === '') {
                item.id = typeof generateUniqueId === 'function'
                    ? generateUniqueId(prefix)
                    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            }
            if (!item.createdAt) item.createdAt = item.updatedAt || stamp;
            if (!item.updatedAt) item.updatedAt = item.createdAt || stamp;
            if (item.syncVersion == null) item.syncVersion = 1;
        });
    };
    assign(data.logs, 'use');
    assign(data.purchases, 'purchase');
    assign(data.substances, 'substance');
    assign(data.taperPlansV2, 'taper');
    assign(data.contacts, 'contact');
    assign(data.cravings, 'craving');
    assign(data.budgets, 'budget');
    if (data.settings && typeof data.settings === 'object' && !data.settings.updatedAt) {
        data.settings.updatedAt = stamp;
    }
    return data;
}

function cloudCollectionHasData(list) {
    return Array.isArray(list) && list.some(item => item && recordIdKey(item.id) && !recordDeletedAt(item));
}

function cloudPayloadHasMeaningfulData(bundle) {
    if (!bundle || typeof bundle !== 'object') return false;
    if (cloudCollectionHasData(bundle.logs) || cloudCollectionHasData(bundle.purchases)
        || cloudCollectionHasData(bundle.taperPlansV2)) return true;
    if (bundle.taperPlans && typeof bundle.taperPlans === 'object'
        && Object.keys(bundle.taperPlans).length > 0) return true;
    return false;
}

function stripSensitiveCloudSettings(settings) {
    const next = JSON.parse(JSON.stringify(settings || {}));
    if (next.privacy && typeof next.privacy === 'object') {
        delete next.privacy.pinHash;
    }
    delete next.pinHash;
    delete next.goals;
    return next;
}

function buildCloudSettingsPayload(data) {
    const settings = stripSensitiveCloudSettings(data.settings || {});
    return {
        settings,
        simpleModePrefs: settings.simpleModePrefs || null,
        onboarding: settings.onboarding || null,
        onboardingCompleted: settings.onboardingCompleted === true,
        experienceMode: settings.experienceMode || 'simple',
        recoveryStreaks: data.recoveryStreaks || {},
        taperPlans: data.taperPlans || {},
        migrations: data.migrations || {},
        privacy: {
            enabled: !!(data.privacy && data.privacy.enabled),
            autoLockMinutes: data.privacy?.autoLockMinutes ?? 5
        }
    };
}

function pickWinningCloudRecord(localRec, remoteRec) {
    if (!localRec) return remoteRec || null;
    if (!remoteRec) return localRec;
    const localDeleted = recordDeletedAt(localRec);
    const remoteDeleted = recordDeletedAt(remoteRec);
    const localMs = recordUpdatedMs(localRec);
    const remoteMs = recordUpdatedMs(remoteRec);
    if (localDeleted && remoteDeleted) {
        return localMs >= remoteMs ? localRec : remoteRec;
    }
    if (localDeleted && !remoteDeleted) {
        return localMs >= remoteMs ? localRec : remoteRec;
    }
    if (remoteDeleted && !localDeleted) {
        return remoteMs >= localMs ? remoteRec : localRec;
    }
    if (remoteMs !== localMs) return remoteMs > localMs ? remoteRec : localRec;
    const localVer = recordSyncVersion(localRec);
    const remoteVer = recordSyncVersion(remoteRec);
    if (remoteVer !== localVer) return remoteVer > localVer ? remoteRec : localRec;
    return localRec;
}

function mergeCloudRecords(localList, remoteList) {
    const map = new Map();
    (localList || []).forEach(item => {
        const id = recordIdKey(item?.id);
        if (id) map.set(id, item);
    });
    (remoteList || []).forEach(item => {
        const id = recordIdKey(item?.id);
        if (!id) return;
        map.set(id, pickWinningCloudRecord(map.get(id) || null, item));
    });
    const live = [];
    const tombstones = [];
    map.forEach(item => {
        if (recordDeletedAt(item)) tombstones.push({ id: item.id, deletedAt: recordDeletedAt(item) });
        else live.push(item);
    });
    return { live, tombstones };
}

function retainLegacyGoalsOnly(merged, local) {
    // Goals are not a product feature. Never sync, merge from remote, convert to tapers,
    // or expose them as active runtime data. Keep an unused local array only so legacy
    // backups still load without crashing.
    merged.goals = Array.isArray(local?.goals) ? local.goals : [];
    if (merged.settings && typeof merged.settings === 'object') {
        delete merged.settings.goals;
    }
    return merged;
}

function mergeCloudAndLocalData(localData, remoteBundle) {
    const local = JSON.parse(JSON.stringify(localData || {}));
    const remote = remoteBundle || {};
    ensureSyncableRecordIds(local);
    const merged = { ...local };
    CLOUD_COLLECTIONS.forEach(col => {
        const result = mergeCloudRecords(local[col.key] || [], remote[col.key] || []);
        merged[col.key] = result.live;
    });
    const localSettingsTime = local.settings?.updatedAt || local.updatedAt;
    const remoteSettingsTime = remote.settingsUpdatedAt || remote.settings?.updatedAt;
    const remoteSettings = remote.settings && typeof remote.settings === 'object'
        ? { ...remote.settings }
        : remote.settings;
    if (remoteSettings && typeof remoteSettings === 'object') delete remoteSettings.goals;
    const localHasWork = typeof hasMeaningfulRecoveryData === 'function'
        ? hasMeaningfulRecoveryData(local)
        : cloudPayloadHasMeaningfulData(local);
    const remoteEmpty = !remoteSettings || !Object.keys(remoteSettings).length;
    if (localHasWork && remoteEmpty) {
        merged.settings = local.settings;
    } else if (remoteSettings && Object.keys(remoteSettings).length) {
        const localMs = Date.parse(localSettingsTime || '') || 0;
        const remoteMs = Date.parse(remoteSettingsTime || '') || 0;
        merged.settings = localMs >= remoteMs
            ? local.settings
            : { ...local.settings, ...remoteSettings };
    }
    if (remote.recoveryStreaks && typeof remote.recoveryStreaks === 'object') {
        merged.recoveryStreaks = { ...(local.recoveryStreaks || {}), ...remote.recoveryStreaks };
    }
    if (remote.taperPlans && typeof remote.taperPlans === 'object') {
        merged.taperPlans = { ...(local.taperPlans || {}), ...remote.taperPlans };
    }
    return retainLegacyGoalsOnly(merged, local);
}

function firstSignInDecision(localData, remoteBundle) {
    const localHas = typeof hasMeaningfulRecoveryData === 'function'
        ? hasMeaningfulRecoveryData(localData)
        : cloudPayloadHasMeaningfulData(localData);
    const remoteHas = cloudPayloadHasMeaningfulData(remoteBundle);
    if (localHas && !remoteHas) return 'offer-backup';
    if (!localHas && remoteHas) return 'pull';
    if (localHas && remoteHas) return 'merge';
    return 'empty';
}

function inferDeletedIds(previousIds, nextList) {
    const next = new Set((nextList || []).map(item => recordIdKey(item?.id)).filter(Boolean));
    return (previousIds || []).filter(id => {
        const key = recordIdKey(id);
        return key && !next.has(key);
    });
}

function applyTombstonesToList(list, deletedIds, deletedAt) {
    const gone = new Set((deletedIds || []).map(recordIdKey));
    return (list || []).filter(item => !gone.has(recordIdKey(item?.id)));
}

function getDefaultCloudMeta() {
    return {
        lastSyncedAt: null,
        lastSnapshotIds: {},
        tombstones: {},
        pendingBackupOffer: false,
        settingsUpdatedAt: null,
        lastError: ''
    };
}

function readCloudMeta() {
    try {
        const raw = localStorage.getItem(CLOUD_META_KEY);
        if (!raw) return getDefaultCloudMeta();
        const parsed = JSON.parse(raw);
        return { ...getDefaultCloudMeta(), ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } catch (_) {
        return getDefaultCloudMeta();
    }
}

function writeCloudMeta(patch) {
    const next = { ...readCloudMeta(), ...(patch || {}) };
    try {
        localStorage.setItem(CLOUD_META_KEY, JSON.stringify(next));
    } catch (_) { /* ignore quota */ }
    return next;
}

function readCloudAuth() {
    try {
        const raw = localStorage.getItem(CLOUD_AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function writeCloudAuth(session) {
    try {
        if (!session) localStorage.removeItem(CLOUD_AUTH_KEY);
        else localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(normalizeCloudSession(session) || session));
    } catch (_) { /* ignore */ }
}

function normalizeCloudSession(raw, fallbackEmail) {
    if (!raw || typeof raw !== 'object') return null;
    const user = raw.user || {};
    const accessToken = raw.accessToken || raw.access_token;
    const refreshToken = raw.refreshToken || raw.refresh_token || null;
    const expiresIn = Number(raw.expiresIn || raw.expires_in || 0);
    let expiresAt = Number(raw.expiresAt || 0);
    if (!expiresAt && raw.expires_at != null) {
        const n = Number(raw.expires_at);
        expiresAt = n > 0 && n < 1e12 ? n * 1000 : n;
    }
    if (!expiresAt && expiresIn > 0) expiresAt = Date.now() + expiresIn * 1000;
    if (!accessToken || !user?.id) return null;
    return {
        accessToken,
        refreshToken,
        expiresAt: expiresAt || null,
        expiresIn: expiresIn || null,
        user: { id: user.id, email: user.email || fallbackEmail || '' }
    };
}

function isAccessTokenExpired(session, now = Date.now()) {
    if (!session?.accessToken) return true;
    const exp = Number(session.expiresAt || 0);
    if (!exp) return false;
    return now + CLOUD_AUTH_REFRESH_SKEW_MS >= exp;
}

function expireStoredCloudSessionForTests() {
    const session = readCloudAuth();
    if (!session) return null;
    session.expiresAt = Date.now() - 1000;
    writeCloudAuth(session);
    const transport = getActiveCloudTransport();
    if (typeof transport.expireAccessToken === 'function') transport.expireAccessToken();
    return session;
}

function invalidateCloudAuthSession(reason = 'expired') {
    writeCloudAuth(null);
    cancelQueuedCloudSync();
    cloudUiState.pendingBackupOffer = false;
    setCloudStatus('saved', { pendingBackupOffer: false, error: '' });
    writeCloudMeta({
        lastError: reason === 'refresh-failed' || reason === 'expired'
            ? 'Session expired. Sign in again to sync.'
            : ''
    });
    return { ok: true, signedIn: false, localPreserved: true, reason };
}

async function ensureFreshCloudSession() {
    const auth = getCloudAuthState();
    if (!auth.signedIn) return { ok: false, signedIn: false, skipped: 'signed-out', localPreserved: true };
    if (!isAccessTokenExpired(auth.session)) {
        return { ok: true, signedIn: true, session: auth.session };
    }
    const transport = getActiveCloudTransport();
    if (!auth.session.refreshToken || typeof transport.refreshSession !== 'function') {
        invalidateCloudAuthSession('expired');
        return { ok: false, signedIn: false, localPreserved: true, reason: 'expired' };
    }
    try {
        const next = await transport.refreshSession(auth.session.refreshToken);
        const normalized = normalizeCloudSession({ ...auth.session, ...next }, auth.user?.email);
        if (!normalized) throw new Error('invalid_grant');
        writeCloudAuth(normalized);
        return { ok: true, signedIn: true, session: normalized, rotated: true };
    } catch (err) {
        invalidateCloudAuthSession('refresh-failed');
        return {
            ok: false,
            signedIn: false,
            localPreserved: true,
            reason: 'refresh-failed',
            error: sanitizeCloudError(err)
        };
    }
}

function getCloudAuthState() {
    const session = readCloudAuth();
    if (!session?.accessToken || !session?.user?.id) {
        return { signedIn: false, user: null, session: null };
    }
    return { signedIn: true, user: session.user, session };
}

function snapshotCollectionIds(data) {
    const snap = {};
    CLOUD_COLLECTIONS.forEach(col => {
        snap[col.key] = (data?.[col.key] || []).map(item => item?.id).filter(id => id != null && id !== '');
    });
    return snap;
}

function captureLocalDeletes(data) {
    const meta = readCloudMeta();
    const prev = meta.lastSnapshotIds || {};
    const tombstones = { ...(meta.tombstones || {}) };
    CLOUD_COLLECTIONS.forEach(col => {
        const deleted = inferDeletedIds(prev[col.key], data?.[col.key]);
        if (!deleted.length) return;
        const stamp = cloudNowIso();
        const list = Array.isArray(tombstones[col.key]) ? tombstones[col.key].slice() : [];
        deleted.forEach(id => {
            if (!list.some(t => recordIdKey(t.id) === recordIdKey(id))) {
                list.push({ id, deletedAt: stamp });
            }
        });
        tombstones[col.key] = list;
    });
    writeCloudMeta({
        tombstones,
        lastSnapshotIds: snapshotCollectionIds(data),
        settingsUpdatedAt: cloudNowIso()
    });
    return tombstones;
}

function collectionsFromData(data, tombstones) {
    const bundle = {};
    CLOUD_COLLECTIONS.forEach(col => {
        const live = (data?.[col.key] || []).map(item => ({ ...item }));
        const stones = tombstones?.[col.key] || [];
        stones.forEach(stone => {
            if (live.some(item => recordIdKey(item.id) === recordIdKey(stone.id))) return;
            live.push({
                id: stone.id,
                deletedAt: stone.deletedAt || cloudNowIso(),
                updatedAt: stone.deletedAt || cloudNowIso()
            });
        });
        bundle[col.key] = live;
    });
    return bundle;
}

function createMemoryCloudTransport(options = {}) {
    const db = {
        users: [],
        sessions: {},
        tables: {
            user_settings: [],
            substances: [],
            use_logs: [],
            purchases: [],
            taper_plans: [],
            contacts: [],
            cravings: [],
            budgets: []
        },
        online: options.online !== false,
        failNext: 0,
        refreshFail: false,
        deletedAuthUsers: []
    };

    const makeSession = (user) => {
        const session = {
            accessToken: `tok-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            refreshToken: `ref-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            expiresAt: Date.now() + 60 * 60 * 1000,
            expiresIn: 3600,
            user: { id: user.id, email: user.email }
        };
        db.sessions[session.accessToken] = session;
        db.sessions[session.refreshToken] = session;
        return session;
    };

    const requireUser = (userId) => {
        if (!userId) throw new Error('Not authenticated');
        if (!db.online) throw new Error('offline');
        if (db.failNext > 0) {
            db.failNext -= 1;
            throw new Error('network');
        }
    };

    const tableFor = (collectionKey) => {
        const col = CLOUD_COLLECTIONS.find(c => c.key === collectionKey);
        return col ? db.tables[col.table] : null;
    };

    return {
        kind: 'memory',
        _db: db,
        isConfigured() { return options.configured !== false; },
        isOnline() { return db.online; },
        setOnline(value) { db.online = !!value; },
        failNextCalls(n) { db.failNext = n; },
        async signUp({ email, password }) {
            if (!db.online) throw new Error('offline');
            if (db.failNext > 0) {
                db.failNext -= 1;
                throw new Error('network');
            }
            if (db.users.some(u => u.email === email)) throw new Error('User already registered');
            const user = { id: `user-${db.users.length + 1}`, email };
            db.users.push({ ...user, password });
            return makeSession(user);
        },
        async signIn({ email, password }) {
            if (!db.online) throw new Error('offline');
            const found = db.users.find(u => u.email === email && u.password === password);
            if (!found) throw new Error('Invalid login');
            return makeSession({ id: found.id, email: found.email });
        },
        async signOut() { return true; },
        async recoverPassword() { return true; },
        async refreshSession(refreshToken) {
            if (!db.online) throw new Error('offline');
            if (db.refreshFail) throw new Error('invalid_grant');
            const previous = db.sessions[refreshToken];
            if (!previous?.user) throw new Error('invalid_grant');
            return makeSession(previous.user);
        },
        expireAccessToken() {
            Object.values(db.sessions).forEach(session => {
                if (session && typeof session === 'object') session.expiresAt = Date.now() - 1000;
            });
        },
        failRefresh(value = true) { db.refreshFail = !!value; },
        async getSessionUser(accessToken) {
            return db.sessions[accessToken]?.user || null;
        },
        async fetchSettings(userId) {
            requireUser(userId);
            return db.tables.user_settings.find(row => row.user_id === userId) || null;
        },
        async upsertSettings(userId, payload, updatedAt, syncVersion) {
            requireUser(userId);
            const row = {
                user_id: userId,
                payload,
                updated_at: updatedAt || cloudNowIso(),
                sync_version: syncVersion || 1
            };
            const idx = db.tables.user_settings.findIndex(r => r.user_id === userId);
            if (idx >= 0) db.tables.user_settings[idx] = row;
            else db.tables.user_settings.push(row);
            return row;
        },
        async fetchCollection(userId, collectionKey) {
            requireUser(userId);
            const table = tableFor(collectionKey) || [];
            return table.filter(row => row.user_id === userId);
        },
        async upsertCollection(userId, collectionKey, rows) {
            requireUser(userId);
            const table = tableFor(collectionKey);
            if (!table) return [];
            rows.forEach(row => {
                const next = { ...row, user_id: userId };
                const idx = table.findIndex(r => r.user_id === userId && recordIdKey(r.id) === recordIdKey(row.id));
                if (idx >= 0) table[idx] = next;
                else table.push(next);
            });
            return rows;
        },
        async deleteOwnCloudData(userId) {
            requireUser(userId);
            Object.keys(db.tables).forEach(name => {
                db.tables[name] = db.tables[name].filter(row => row.user_id !== userId);
            });
            return true;
        },
        async deleteAccount(userId) {
            requireUser(userId);
            Object.keys(db.tables).forEach(name => {
                db.tables[name] = db.tables[name].filter(row => row.user_id !== userId);
            });
            db.users = db.users.filter(u => u.id !== userId);
            Object.keys(db.sessions).forEach(key => {
                if (db.sessions[key]?.user?.id === userId) delete db.sessions[key];
            });
            db.deletedAuthUsers.push(userId);
            return { ok: true, authUserDeleted: true };
        }
    };
}

function createSupabaseCloudTransport(config = getCloudConfig()) {
    const fetchFn = (typeof fetch === 'function') ? fetch : null;
    const headers = (accessToken) => ({
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates'
    });

    async function request(path, { method = 'GET', body, accessToken, query } = {}) {
        if (!fetchFn) throw new Error('offline');
        const url = `${config.supabaseUrl}${path}${query ? `?${query}` : ''}`;
        let res;
        try {
            res = await fetchFn(url, {
                method,
                headers: headers(accessToken || config.supabaseAnonKey),
                body: body != null ? JSON.stringify(body) : undefined
            });
        } catch (_) {
            throw new Error('offline');
        }
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) { json = { message: text }; }
        if (!res.ok) {
            throw new Error(sanitizeCloudError(json?.error_description || json?.msg || json?.message || `HTTP ${res.status}`));
        }
        return json;
    }

    return {
        kind: 'supabase',
        isConfigured() { return !!(config.supabaseUrl && config.supabaseAnonKey); },
        isOnline() { return typeof navigator === 'undefined' ? true : navigator.onLine !== false; },
        async signUp({ email, password }) {
            const json = await request('/auth/v1/signup', {
                method: 'POST',
                body: { email, password }
            });
            const user = json.user || json;
            const accessToken = json.access_token || json.session?.access_token;
            if (!user?.id) throw new Error('Could not create account');
            if (!accessToken) {
                throw new Error('Confirm the account email, then sign in.');
            }
            return normalizeCloudSession({
                access_token: accessToken,
                refresh_token: json.refresh_token || json.session?.refresh_token,
                expires_in: json.expires_in || json.session?.expires_in,
                expires_at: json.expires_at || json.session?.expires_at,
                user: { id: user.id, email: user.email || email }
            }, email);
        },
        async signIn({ email, password }) {
            const json = await request('/auth/v1/token?grant_type=password', {
                method: 'POST',
                body: { email, password }
            });
            const user = json.user || {};
            if (!json.access_token) throw new Error('Could not sign in');
            return normalizeCloudSession({
                access_token: json.access_token,
                refresh_token: json.refresh_token,
                expires_in: json.expires_in,
                expires_at: json.expires_at,
                user: { id: user.id || json.user?.id, email: user.email || email }
            }, email);
        },
        async signOut(accessToken) {
            try {
                await request('/auth/v1/logout', { method: 'POST', accessToken });
            } catch (_) { /* still clear local session */ }
            return true;
        },
        async recoverPassword({ email }) {
            await request('/auth/v1/recover', { method: 'POST', body: { email } });
            return true;
        },
        async refreshSession(refreshToken) {
            const json = await request('/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                body: { refresh_token: refreshToken }
            });
            if (!json.access_token) throw new Error('invalid_grant');
            const user = json.user || {};
            return normalizeCloudSession({
                access_token: json.access_token,
                refresh_token: json.refresh_token || refreshToken,
                expires_in: json.expires_in,
                expires_at: json.expires_at,
                user: { id: user.id, email: user.email }
            });
        },
        async fetchSettings(userId, accessToken) {
            const rows = await request('/rest/v1/user_settings', {
                accessToken,
                query: `select=payload,updated_at,sync_version&user_id=eq.${encodeURIComponent(userId)}`
            });
            return Array.isArray(rows) ? rows[0] || null : rows;
        },
        async upsertSettings(userId, payload, updatedAt, syncVersion, accessToken) {
            return request('/rest/v1/user_settings?on_conflict=user_id', {
                method: 'POST',
                accessToken,
                body: [{
                    user_id: userId,
                    payload,
                    updated_at: updatedAt,
                    sync_version: syncVersion || 1
                }]
            });
        },
        async fetchCollection(userId, collectionKey, accessToken) {
            const col = CLOUD_COLLECTIONS.find(c => c.key === collectionKey);
            if (!col) return [];
            const rows = await request(`/rest/v1/${col.table}`, {
                accessToken,
                query: `select=id,payload,updated_at,deleted_at,sync_version&user_id=eq.${encodeURIComponent(userId)}`
            });
            return Array.isArray(rows) ? rows : [];
        },
        async upsertCollection(userId, collectionKey, rows, accessToken) {
            const col = CLOUD_COLLECTIONS.find(c => c.key === collectionKey);
            if (!col || !rows.length) return [];
            return request(`/rest/v1/${col.table}?on_conflict=user_id,id`, {
                method: 'POST',
                accessToken,
                body: rows.map(row => ({
                    user_id: userId,
                    id: String(row.id),
                    payload: row.payload || row,
                    updated_at: row.updated_at || row.updatedAt,
                    deleted_at: row.deleted_at || row.deletedAt || null,
                    sync_version: row.sync_version || row.syncVersion || 1
                }))
            });
        },
        async deleteOwnCloudData(_userId, accessToken) {
            await request('/rest/v1/rpc/delete_own_cloud_data', { method: 'POST', accessToken, body: {} });
            return true;
        },
        async deleteAccount(_userId, accessToken) {
            await request('/functions/v1/delete-account', { method: 'POST', accessToken, body: {} });
            return { ok: true, authUserDeleted: true };
        }
    };
}

function getActiveCloudTransport() {
    if (cloudTransport) return cloudTransport;
    const config = getCloudConfig();
    if (config.configured) return createSupabaseCloudTransport(config);
    return createMemoryCloudTransport({ configured: false, online: true });
}

function setCloudTransportForTests(transport) {
    cancelQueuedCloudSync();
    cloudTransport = transport;
    return cloudTransport;
}

function rowsToRecords(rows) {
    return (rows || []).map(row => {
        const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
        payload.id = payload.id != null ? payload.id : row.id;
        payload.updatedAt = payload.updatedAt || row.updated_at;
        payload.deletedAt = payload.deletedAt || row.deleted_at || null;
        payload.syncVersion = payload.syncVersion || row.sync_version || 1;
        return payload;
    });
}

function mergeRemoteTombstonesIntoMeta(remoteBundle) {
    const meta = readCloudMeta();
    const tombstones = { ...(meta.tombstones || {}) };
    CLOUD_COLLECTIONS.forEach(col => {
        const list = Array.isArray(tombstones[col.key]) ? tombstones[col.key].slice() : [];
        (remoteBundle?.[col.key] || []).forEach(item => {
            if (!recordDeletedAt(item) || item?.id == null) return;
            if (!list.some(t => recordIdKey(t.id) === recordIdKey(item.id))) {
                list.push({ id: item.id, deletedAt: recordDeletedAt(item) });
            }
        });
        tombstones[col.key] = list;
    });
    writeCloudMeta({ tombstones });
    return tombstones;
}

function cancelQueuedCloudSync() {
    if (cloudSyncTimer) {
        clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
    }
}

async function pullRemoteBundle(userId, accessToken) {
    const transport = getActiveCloudTransport();
    const settingsRow = await transport.fetchSettings(userId, accessToken);
    const bundle = {
        settings: settingsRow?.payload?.settings || settingsRow?.payload || null,
        settingsUpdatedAt: settingsRow?.updated_at || settingsRow?.payload?.settings?.updatedAt,
        recoveryStreaks: settingsRow?.payload?.recoveryStreaks || {},
        taperPlans: settingsRow?.payload?.taperPlans || {},
        simpleModePrefs: settingsRow?.payload?.simpleModePrefs || null
    };
    for (const col of CLOUD_COLLECTIONS) {
        const rows = await transport.fetchCollection(userId, col.key, accessToken);
        bundle[col.key] = rowsToRecords(rows);
    }
    return bundle;
}

async function pushLocalBundle(userId, data, accessToken) {
    const transport = getActiveCloudTransport();
    const tombstones = readCloudMeta().tombstones || {};
    const collections = collectionsFromData(data, tombstones);
    const settingsPayload = buildCloudSettingsPayload(data);
    await transport.upsertSettings(
        userId,
        settingsPayload,
        data.settings?.updatedAt || cloudNowIso(),
        1,
        accessToken
    );
    for (const col of CLOUD_COLLECTIONS) {
        const rows = (collections[col.key] || []).map(item => ({
            id: item.id,
            payload: item,
            updatedAt: item.updatedAt || cloudNowIso(),
            deletedAt: item.deletedAt || null,
            syncVersion: item.syncVersion || 1
        }));
        if (rows.length) await transport.upsertCollection(userId, col.key, rows, accessToken);
    }
}

function attachLocalTombstones(data) {
    const copy = JSON.parse(JSON.stringify(data || {}));
    const collections = collectionsFromData(copy, readCloudMeta().tombstones || {});
    CLOUD_COLLECTIONS.forEach(col => {
        copy[col.key] = collections[col.key];
    });
    return copy;
}

function applyPulledBundleToAppData(bundle, data = appData, mode = 'merge') {
    if (mode === 'replace-empty-local') {
        if (typeof hasMeaningfulRecoveryData === 'function' && hasMeaningfulRecoveryData(data)) {
            return data;
        }
    }
    const localForMerge = attachLocalTombstones(data);
    const merged = mode === 'pull' && !(typeof hasMeaningfulRecoveryData === 'function' && hasMeaningfulRecoveryData(data))
        ? mergeCloudAndLocalData({
            ...localForMerge,
            logs: [],
            purchases: [],
            taperPlansV2: [],
            taperPlans: {}
        }, bundle)
        : mergeCloudAndLocalData(localForMerge, bundle);
    return retainLegacyGoalsOnly(merged, data);
}

function setCloudStatus(status, extra = {}) {
    cloudUiState = {
        ...cloudUiState,
        status,
        lastError: extra.error || '',
        lastSyncedAt: extra.lastSyncedAt !== undefined ? extra.lastSyncedAt : cloudUiState.lastSyncedAt,
        pendingBackupOffer: extra.pendingBackupOffer !== undefined
            ? extra.pendingBackupOffer
            : cloudUiState.pendingBackupOffer
    };
    renderCloudSyncSettings();
    return cloudUiState;
}

function getCloudSyncStatus() {
    const auth = getCloudAuthState();
    if (!auth.signedIn) {
        return {
            status: 'saved',
            label: CLOUD_STATUS.signedOut,
            lastSyncedAt: cloudUiState.lastSyncedAt,
            signedIn: false,
            configured: isCloudConfigured(),
            pendingBackupOffer: false,
            lastError: ''
        };
    }
    const online = getActiveCloudTransport().isOnline?.() !== false;
    let status = cloudUiState.status;
    if (!online && status !== 'syncing') status = 'offline';
    return {
        status,
        label: CLOUD_STATUS[status] || CLOUD_STATUS.saved,
        lastSyncedAt: cloudUiState.lastSyncedAt,
        signedIn: true,
        user: auth.user,
        configured: isCloudConfigured(),
        pendingBackupOffer: cloudUiState.pendingBackupOffer,
        lastError: cloudUiState.lastError
    };
}

function formatCloudSyncTime(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString();
}

async function runCloudSyncNow(options = {}) {
    const fresh = await ensureFreshCloudSession();
    if (!fresh.signedIn) {
        return { ok: true, skipped: fresh.reason || fresh.skipped || 'signed-out', localPreserved: true };
    }
    const auth = getCloudAuthState();
    if (!auth.signedIn) return { ok: true, skipped: 'signed-out' };
    if (cloudUiState.pendingBackupOffer && options.allowWhileOfferPending !== true) {
        return { ok: true, skipped: 'pending-backup-offer' };
    }
    const transport = getActiveCloudTransport();
    if (!transport.isConfigured()) return { ok: true, skipped: 'not-configured' };
    if (transport.isOnline && transport.isOnline() === false) {
        setCloudStatus('offline');
        return { ok: false, error: 'offline' };
    }
    const data = options.data || appData;
    const previous = JSON.parse(JSON.stringify(data));
    setCloudStatus('syncing');
    cloudSyncInFlight = true;
    try {
        const remote = await pullRemoteBundle(auth.user.id, auth.session.accessToken);
        mergeRemoteTombstonesIntoMeta(remote);
        const decision = options.decision || 'merge';
        if (decision === 'pull' && typeof hasMeaningfulRecoveryData === 'function'
            && hasMeaningfulRecoveryData(previous)
            && !cloudPayloadHasMeaningfulData(remote)) {
            setCloudStatus('saved', { lastSyncedAt: cloudUiState.lastSyncedAt });
            return { ok: true, skipped: 'refused-empty-overwrite' };
        }
        const merged = applyPulledBundleToAppData(remote, previous, decision === 'pull' ? 'pull' : 'merge');
        Object.keys(merged).forEach(key => {
            data[key] = merged[key];
        });
        if (typeof saveData === 'function' && options.persist !== false) {
            const saved = saveData(data);
            if (!saved) throw new Error('Local save failed');
        }
        await pushLocalBundle(auth.user.id, data, auth.session.accessToken);
        const syncedAt = cloudNowIso();
        writeCloudMeta({
            lastSyncedAt: syncedAt,
            lastSnapshotIds: snapshotCollectionIds(data),
            lastError: '',
            pendingBackupOffer: false
        });
        setCloudStatus('saved', { lastSyncedAt: syncedAt, pendingBackupOffer: false });
        return { ok: true, merged: true };
    } catch (err) {
        Object.keys(previous).forEach(key => {
            data[key] = previous[key];
        });
        try {
            if (typeof saveData === 'function' && options.persist !== false) saveData(data);
        } catch (_) { /* in-memory copy already restored */ }
        const message = sanitizeCloudError(err);
        const offline = message === 'offline' || /offline|network/i.test(String(err?.message || ''));
        setCloudStatus(offline ? 'offline' : 'error', { error: message });
        writeCloudMeta({ lastError: message });
        return { ok: false, error: message, localPreserved: true };
    } finally {
        cloudSyncInFlight = false;
    }
}

function queueCloudSync() {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_TEST_CONTEXT) {
        return;
    }
    cancelQueuedCloudSync();
    cloudSyncTimer = setTimeout(() => {
        runCloudSyncNow().catch(() => { /* status already set */ });
    }, CLOUD_SYNC_DEBOUNCE_MS);
}

function beginLocalDataReset() {
    cloudSkipDeleteCapture = true;
}

function endLocalDataReset(data = appData) {
    writeCloudMeta({
        lastSnapshotIds: snapshotCollectionIds(data),
        tombstones: {}
    });
    cloudSkipDeleteCapture = false;
}

function onLocalDataSaved(data) {
    if (!data || cloudSyncInFlight) return;
    if (cloudSkipDeleteCapture) {
        writeCloudMeta({ lastSnapshotIds: snapshotCollectionIds(data) });
        return;
    }
    captureLocalDeletes(data);
    const auth = getCloudAuthState();
    if (!auth.signedIn || cloudUiState.pendingBackupOffer) {
        renderCloudSyncSettings();
        return;
    }
    queueCloudSync();
}

async function afterCloudSignIn() {
    const fresh = await ensureFreshCloudSession();
    if (!fresh.signedIn) return { ok: false, localPreserved: true };
    const auth = getCloudAuthState();
    let remote = { logs: [], purchases: [], taperPlansV2: [] };
    try {
        remote = await pullRemoteBundle(auth.user.id, auth.session.accessToken);
    } catch (err) {
        setCloudStatus(/offline/i.test(String(err?.message)) ? 'offline' : 'error', {
            error: sanitizeCloudError(err)
        });
        return { ok: false, error: sanitizeCloudError(err) };
    }
    const decision = firstSignInDecision(appData, remote);
    if (decision === 'offer-backup') {
        cloudUiState.pendingBackupOffer = true;
        writeCloudMeta({ pendingBackupOffer: true });
        setCloudStatus('saved', { pendingBackupOffer: true });
        renderCloudSyncSettings();
        return { ok: true, decision };
    }
    if (decision === 'pull') {
        const applied = applyPulledBundleToAppData(remote, appData, 'pull');
        Object.keys(applied).forEach(key => { appData[key] = applied[key]; });
        if (typeof saveData === 'function') saveData(appData);
        if (typeof refreshAppAfterDataChange === 'function') refreshAppAfterDataChange();
    }
    return runCloudSyncNow({ decision: decision === 'empty' ? 'merge' : decision, allowWhileOfferPending: true });
}

async function backupLocalDataToAccount() {
    const fresh = await ensureFreshCloudSession();
    if (!fresh.signedIn) return { ok: false, error: 'signed-out', localPreserved: true };
    const auth = getCloudAuthState();
    cloudUiState.pendingBackupOffer = false;
    writeCloudMeta({ pendingBackupOffer: false });
    try {
        await pushLocalBundle(auth.user.id, appData, auth.session.accessToken);
        const syncedAt = cloudNowIso();
        writeCloudMeta({
            lastSyncedAt: syncedAt,
            lastSnapshotIds: snapshotCollectionIds(appData)
        });
        setCloudStatus('saved', { lastSyncedAt: syncedAt, pendingBackupOffer: false });
        return { ok: true };
    } catch (err) {
        setCloudStatus('error', { error: sanitizeCloudError(err), pendingBackupOffer: true });
        return { ok: false, error: sanitizeCloudError(err) };
    }
}

function dismissCloudBackupOffer() {
    cloudUiState.pendingBackupOffer = false;
    writeCloudMeta({ pendingBackupOffer: false });
    renderCloudSyncSettings();
}

async function cloudSignUp(email, password) {
    const transport = getActiveCloudTransport();
    if (!transport.isConfigured()) throw new Error('Cloud sync is not configured yet.');
    const session = await transport.signUp({ email, password });
    writeCloudAuth(normalizeCloudSession(session, email) || session);
    return afterCloudSignIn();
}

async function cloudSignIn(email, password) {
    const transport = getActiveCloudTransport();
    if (!transport.isConfigured()) throw new Error('Cloud sync is not configured yet.');
    const session = await transport.signIn({ email, password });
    writeCloudAuth(normalizeCloudSession(session, email) || session);
    return afterCloudSignIn();
}

async function cloudSignOut() {
    const auth = getCloudAuthState();
    const transport = getActiveCloudTransport();
    try {
        if (auth.session?.accessToken) await transport.signOut(auth.session.accessToken);
    } catch (_) { /* keep local data */ }
    writeCloudAuth(null);
    writeCloudMeta({
        tombstones: {},
        lastSnapshotIds: snapshotCollectionIds(typeof appData === 'object' ? appData : {}),
        pendingBackupOffer: false,
        lastError: ''
    });
    cloudUiState.pendingBackupOffer = false;
    setCloudStatus('saved', { pendingBackupOffer: false });
    renderCloudSyncSettings();
    return { ok: true, localPreserved: true };
}

async function cloudForgotPassword(email) {
    const transport = getActiveCloudTransport();
    if (!transport.isConfigured()) throw new Error('Cloud sync is not configured yet.');
    await transport.recoverPassword({ email });
    return { ok: true };
}

async function cloudDeleteCloudData() {
    const fresh = await ensureFreshCloudSession();
    if (!fresh.signedIn) return { ok: false, error: 'signed-out', localPreserved: true };
    const auth = getCloudAuthState();
    const transport = getActiveCloudTransport();
    await transport.deleteOwnCloudData(auth.user.id, auth.session.accessToken);
    await cloudSignOut();
    return { ok: true, localPreserved: true, authUserDeleted: false };
}

async function cloudDeleteAccount() {
    const fresh = await ensureFreshCloudSession();
    if (!fresh.signedIn) return { ok: false, error: 'signed-out', localPreserved: true };
    const auth = getCloudAuthState();
    const transport = getActiveCloudTransport();
    if (typeof transport.deleteAccount !== 'function') {
        throw new Error('Account deletion is not configured.');
    }
    await transport.deleteAccount(auth.user.id, auth.session.accessToken);
    await cloudSignOut();
    return { ok: true, localPreserved: true, authUserDeleted: true };
}

function confirmDeleteCloudData() {
    if (typeof confirm !== 'function') return cloudDeleteCloudData();
    if (!confirm('Delete Cloud Data? This does not delete your login. This device’s local logs will be kept.')) {
        return { ok: false, cancelled: true };
    }
    if (!confirm('This removes Recovery Tracker rows stored in your account, not this device. Continue?')) {
        return { ok: false, cancelled: true };
    }
    return cloudDeleteCloudData();
}

function confirmDeleteAccount() {
    if (typeof confirm !== 'function') return cloudDeleteAccount();
    if (!confirm('Delete Account? This permanently deletes your cloud data and login. This device’s local logs will be kept.')) {
        return { ok: false, cancelled: true };
    }
    if (!confirm('This cannot be undone. Continue deleting the account?')) {
        return { ok: false, cancelled: true };
    }
    return cloudDeleteAccount();
}

function confirmDeleteCloudAccountData() {
    return confirmDeleteCloudData();
}

async function cloudDeleteCloudAccountData() {
    return cloudDeleteCloudData();
}

function confirmDeleteLocalDeviceData() {
    if (typeof clearAllData === 'function') return clearAllData();
    return { ok: false };
}

async function handleCloudAuthSubmit(mode) {
    const email = document.getElementById('cloud-auth-email')?.value?.trim();
    const password = document.getElementById('cloud-auth-password')?.value || '';
    const errEl = document.getElementById('cloud-auth-error');
    if (errEl) errEl.textContent = '';
    try {
        if (!email) throw new Error('Enter an email address.');
        if (mode === 'recover') {
            await cloudForgotPassword(email);
            if (errEl) errEl.textContent = 'If that account exists, a reset email was requested.';
            return;
        }
        if (!password) throw new Error('Enter a password.');
        if (mode === 'signup') await cloudSignUp(email, password);
        else await cloudSignIn(email, password);
        renderCloudSyncSettings();
    } catch (err) {
        if (errEl) errEl.textContent = sanitizeCloudError(err);
    }
}

function renderCloudSyncSettings() {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('cloud-sync-root');
    if (!root) return;
    const status = getCloudSyncStatus();
    const configured = status.configured;
    const lastSynced = formatCloudSyncTime(status.lastSyncedAt);
    const lastSaved = typeof formatLastSaved === 'function'
        ? formatLastSaved(typeof getLastSavedTimestamp === 'function' ? getLastSavedTimestamp() : null)
        : '—';

    if (!configured) {
        root.innerHTML = `
            <p class="cloud-sync-status" data-cloud-status="saved">Saved locally · Cloud sync is not configured on this build.</p>
            <p class="settings-hint">Last Saved: ${escapeHtml(lastSaved)}</p>
            <p class="settings-hint">Add SUPABASE_URL and SUPABASE_ANON_KEY (see .env.example) to enable accounts. JSON export still works below.</p>`;
        return;
    }

    if (!status.signedIn) {
        root.innerHTML = `
            <p class="cloud-sync-status" data-cloud-status="saved">Saved · Signed out</p>
            <p class="settings-hint">This device keeps working offline. Signing in never deletes local data.</p>
            <div class="cloud-auth-form">
                <label class="sm-field">Email <input type="email" id="cloud-auth-email" autocomplete="username"></label>
                <label class="sm-field">Password <input type="password" id="cloud-auth-password" autocomplete="current-password"></label>
                <p id="cloud-auth-error" class="settings-hint cloud-auth-error"></p>
                <div class="data-management-buttons">
                    <button type="button" class="submit-btn" onclick="handleCloudAuthSubmit('signin')">Sign in</button>
                    <button type="button" class="secondary-btn" onclick="handleCloudAuthSubmit('signup')">Create account</button>
                    <button type="button" class="secondary-btn" onclick="handleCloudAuthSubmit('recover')">Forgot password</button>
                </div>
            </div>`;
        return;
    }

    const offer = status.pendingBackupOffer
        ? `<div class="cloud-backup-offer">
                <p>This device already has Recovery Tracker data. Your account is empty.</p>
                <p>Back up this device’s data to your account? Empty cloud data will not replace what’s here.</p>
                <div class="data-management-buttons">
                    <button type="button" class="submit-btn" onclick="backupLocalDataToAccount()">Back up this device’s data to your account</button>
                    <button type="button" class="secondary-btn" onclick="dismissCloudBackupOffer()">Not now</button>
                </div>
           </div>`
        : '';

    root.innerHTML = `
        <p class="cloud-sync-status" data-cloud-status="${escapeHtml(status.status)}">${escapeHtml(status.label)}</p>
        <p class="settings-hint">Signed in as ${escapeHtml(status.user?.email || 'account')}</p>
        <p class="settings-hint">Last synced: ${escapeHtml(lastSynced)}</p>
        ${status.lastError ? `<p class="settings-hint cloud-auth-error">${escapeHtml(status.lastError)}</p>` : ''}
        ${offer}
        <div class="data-management-buttons">
            <button type="button" class="secondary-btn" onclick="runCloudSyncNow()">Sync now</button>
            <button type="button" class="secondary-btn" onclick="cloudSignOut()">Sign out</button>
        </div>
        <p class="settings-hint">Sign out keeps this device’s data.</p>`;
}

function initCloudSync() {
    const meta = readCloudMeta();
    cloudUiState.lastSyncedAt = meta.lastSyncedAt;
    cloudUiState.pendingBackupOffer = !!meta.pendingBackupOffer;
    if (!cloudTransport) {
        const config = getCloudConfig();
        cloudTransport = config.configured
            ? createSupabaseCloudTransport(config)
            : createMemoryCloudTransport({ configured: false });
    }
    renderCloudSyncSettings();
    ensureFreshCloudSession().then((fresh) => {
        renderCloudSyncSettings();
        if (fresh.signedIn && !cloudUiState.pendingBackupOffer) {
            queueCloudSync();
        }
    }).catch(() => {
        renderCloudSyncSettings();
    });
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        handleCloudAuthSubmit,
        backupLocalDataToAccount,
        dismissCloudBackupOffer,
        runCloudSyncNow,
        cloudSignOut,
        confirmDeleteCloudData,
        confirmDeleteAccount,
        confirmDeleteLocalDeviceData
    });
}
