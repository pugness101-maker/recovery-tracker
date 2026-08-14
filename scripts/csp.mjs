/**
 * Recovery Tracker CSP helpers.
 * connect-src stays origin-scoped to the configured Supabase project — never `*`.
 */
export const DEFAULT_SUPABASE_URL = 'https://sgrqnewbqtejxiouzmga.supabase.co';

const META_CSP_RE = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;

function isLocalSupabaseHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isAllowedSupabaseHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host || host.includes('*')) return false;
    if (isLocalSupabaseHost(host)) return true;
    return host.endsWith('.supabase.co') && host !== 'supabase.co';
}

export function parseAllowedSupabaseOrigin(supabaseUrl) {
    const raw = String(supabaseUrl || '').trim();
    if (!raw) return null;
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return null;
    }
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.protocol === 'http:' && !isLocalSupabaseHost(parsed.hostname)) return null;
    if (!isAllowedSupabaseHost(parsed.hostname)) return null;
    return parsed.origin;
}

export function connectSrcSources(supabaseUrl = DEFAULT_SUPABASE_URL) {
    const sources = ["'self'"];
    const origin = parseAllowedSupabaseOrigin(supabaseUrl) || parseAllowedSupabaseOrigin(DEFAULT_SUPABASE_URL);
    if (!origin) return sources;
    sources.push(origin);
    if (origin.startsWith('https://')) sources.push(`wss://${origin.slice('https://'.length)}`);
    if (origin.startsWith('http://')) sources.push(`ws://${origin.slice('http://'.length)}`);
    return sources;
}

export function buildCsp({
    supabaseUrl = DEFAULT_SUPABASE_URL,
    includeFrameAncestors = false
} = {}) {
    const directives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src ${connectSrcSources(supabaseUrl).join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'"
    ];
    if (includeFrameAncestors) directives.push("frame-ancestors 'none'");
    return directives.join('; ');
}

export function buildMetaCsp(supabaseUrl = DEFAULT_SUPABASE_URL) {
    return buildCsp({ supabaseUrl, includeFrameAncestors: false });
}

export function buildHeaderCsp(supabaseUrl = DEFAULT_SUPABASE_URL) {
    return buildCsp({ supabaseUrl, includeFrameAncestors: true });
}

export function applyCspToHtml(html, supabaseUrl = DEFAULT_SUPABASE_URL) {
    const policy = buildMetaCsp(supabaseUrl);
    if (!META_CSP_RE.test(html)) {
        throw new Error('Content-Security-Policy meta tag not found');
    }
    return html.replace(META_CSP_RE, `$1${policy}$3`);
}

export function parseCspDirectives(policy) {
    const directives = {};
    for (const part of String(policy || '').split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const [name, ...rest] = trimmed.split(/\s+/);
        directives[name.toLowerCase()] = rest;
    }
    return directives;
}

export function connectSrcAllows(connectSrcValue, resourceUrl) {
    const tokens = Array.isArray(connectSrcValue)
        ? connectSrcValue
        : String(connectSrcValue || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.includes('*')) return true;
    let url;
    try {
        url = new URL(resourceUrl);
    } catch {
        return false;
    }
    for (const token of tokens) {
        if (token === "'self'" || token === "'none'") continue;
        if (token === '*') return true;
        if (token === 'https:' && url.protocol === 'https:') return true;
        if (token === 'wss:' && url.protocol === 'wss:') return true;
        if (token === 'http:' && url.protocol === 'http:') return true;
        if (token === 'ws:' && url.protocol === 'ws:') return true;
        if (token.includes('*')) continue;
        try {
            const allowed = token.includes('://') ? new URL(token) : new URL(`https://${token}`);
            if (allowed.origin === url.origin) return true;
            if (!token.includes('://') && allowed.host === url.host) return true;
        } catch {
            /* ignore malformed token */
        }
    }
    return false;
}
