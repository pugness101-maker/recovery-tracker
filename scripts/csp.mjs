/**
 * Recovery Tracker CSP helpers.
 * connect-src is 'self' only — the app is local-first and makes no third-party API calls.
 */
const META_CSP_RE = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;

export function connectSrcSources() {
    return ["'self'"];
}

export function buildCsp({ includeFrameAncestors = false } = {}) {
    const directives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src ${connectSrcSources().join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'"
    ];
    if (includeFrameAncestors) directives.push("frame-ancestors 'none'");
    return directives.join('; ');
}

export function buildMetaCsp() {
    return buildCsp({ includeFrameAncestors: false });
}

export function buildHeaderCsp() {
    return buildCsp({ includeFrameAncestors: true });
}

export function applyCspToHtml(html) {
    const policy = buildMetaCsp();
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
