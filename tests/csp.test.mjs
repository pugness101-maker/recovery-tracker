import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_SUPABASE_URL,
    applyCspToHtml,
    buildHeaderCsp,
    buildMetaCsp,
    connectSrcAllows,
    connectSrcSources,
    parseAllowedSupabaseOrigin,
    parseCspDirectives
} from '../scripts/csp.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJECT = 'https://sgrqnewbqtejxiouzmga.supabase.co';

function metaCspFromHtml(html) {
    const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
    assert.ok(match, 'CSP meta tag must exist');
    return match[1];
}

function headerCspFromVercel() {
    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const headers = vercel.headers?.flatMap(entry => entry.headers || []) || [];
    const csp = headers.find(h => h.key === 'Content-Security-Policy');
    assert.ok(csp?.value, 'vercel.json must send a Content-Security-Policy header');
    return csp.value;
}

test('meta CSP allows the configured Supabase HTTPS origin and scoped WebSockets', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const policy = metaCspFromHtml(html);
    const directives = parseCspDirectives(policy);
    const connect = directives['connect-src'];
    assert.ok(connect, 'connect-src must be present');
    assert.equal(connect.includes('*'), false);
    assert.equal(connect.includes('https:'), false);
    assert.equal(connect.includes('wss:'), false);
    assert.ok(connect.includes("'self'"));
    assert.ok(connect.includes(PROJECT));
    assert.ok(connect.includes('wss://sgrqnewbqtejxiouzmga.supabase.co'));

    assert.equal(connectSrcAllows(connect, `${PROJECT}/auth/v1/signup`), true);
    assert.equal(connectSrcAllows(connect, `${PROJECT}/auth/v1/token?grant_type=password`), true);
    assert.equal(connectSrcAllows(connect, `${PROJECT}/rest/v1/use_logs`), true);
    assert.equal(connectSrcAllows(connect, `${PROJECT}/functions/v1/delete-account`), true);
    assert.equal(connectSrcAllows(connect, 'wss://sgrqnewbqtejxiouzmga.supabase.co/realtime/v1/websocket'), true);
});

test('meta CSP continues to restrict arbitrary external connections', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const connect = parseCspDirectives(metaCspFromHtml(html))['connect-src'];
    assert.equal(connectSrcAllows(connect, 'https://evil.example/auth/v1/signup'), false);
    assert.equal(connectSrcAllows(connect, 'https://another-project.supabase.co/auth/v1/signup'), false);
    assert.equal(connectSrcAllows(connect, 'https://vercel.live/_next/static/feedback.js'), false);
    assert.equal(connectSrcAllows(connect, 'wss://evil.example/realtime'), false);
    assert.deepEqual(connect, connectSrcSources(DEFAULT_SUPABASE_URL));
});

test('meta CSP does not include frame-ancestors and does not weaken other directives', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const policy = metaCspFromHtml(html);
    const directives = parseCspDirectives(policy);
    assert.equal(Object.prototype.hasOwnProperty.call(directives, 'frame-ancestors'), false);
    assert.deepEqual(directives['default-src'], ["'self'"]);
    assert.deepEqual(directives['script-src'], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(directives['style-src'], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(directives['img-src'], ["'self'", 'data:', 'blob:']);
    assert.deepEqual(directives['font-src'], ["'self'", 'data:']);
    assert.deepEqual(directives['object-src'], ["'none'"]);
    assert.deepEqual(directives['base-uri'], ["'self'"]);
    assert.deepEqual(directives['form-action'], ["'none'"]);
    assert.equal(policy.includes('vercel.live'), false);
    assert.equal(policy, buildMetaCsp(DEFAULT_SUPABASE_URL));
});

test('Vercel HTTP CSP permits the same Supabase origin and keeps frame-ancestors', () => {
    const policy = headerCspFromVercel();
    const directives = parseCspDirectives(policy);
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
    assert.equal(connectSrcAllows(directives['connect-src'], `${PROJECT}/auth/v1/signup`), true);
    assert.equal(connectSrcAllows(directives['connect-src'], 'https://evil.example/rest/v1/use_logs'), false);
    assert.equal(connectSrcAllows(directives['connect-src'], 'https://vercel.live/feedback'), false);
    assert.equal(policy.includes('*'), false);
    assert.equal(policy, buildHeaderCsp(DEFAULT_SUPABASE_URL));

    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const xfo = vercel.headers.flatMap(entry => entry.headers).find(h => h.key === 'X-Frame-Options');
    assert.equal(xfo.value, 'DENY');
});

test('CSP builder only accepts the configured Supabase host or local supabase', () => {
    assert.equal(parseAllowedSupabaseOrigin(PROJECT), PROJECT);
    assert.equal(parseAllowedSupabaseOrigin('https://evil.example'), null);
    assert.equal(parseAllowedSupabaseOrigin('https://*.supabase.co'), null);
    assert.equal(parseAllowedSupabaseOrigin('https://example.com'), null);
    assert.equal(parseAllowedSupabaseOrigin('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');

    const local = connectSrcSources('http://127.0.0.1:54321');
    assert.equal(connectSrcAllows(local, 'http://127.0.0.1:54321/auth/v1/signup'), true);
    assert.equal(connectSrcAllows(local, 'ws://127.0.0.1:54321/realtime/v1/websocket'), true);
    assert.equal(connectSrcAllows(local, `${PROJECT}/auth/v1/signup`), false);

    const patched = applyCspToHtml(
        '<meta http-equiv="Content-Security-Policy" content="connect-src \'self\'">',
        PROJECT
    );
    assert.match(patched, /connect-src 'self' https:\/\/sgrqnewbqtejxiouzmga\.supabase\.co wss:\/\/sgrqnewbqtejxiouzmga\.supabase\.co/);
    assert.doesNotMatch(patched, /frame-ancestors/);
});
