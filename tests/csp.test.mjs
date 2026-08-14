import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    applyCspToHtml,
    buildHeaderCsp,
    buildMetaCsp,
    connectSrcAllows,
    connectSrcSources,
    parseCspDirectives
} from '../scripts/csp.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BLOCKED = [
    'https://sgrqnewbqtejxiouzmga.supabase.co/auth/v1/signup',
    'https://sgrqnewbqtejxiouzmga.supabase.co/auth/v1/token',
    'https://sgrqnewbqtejxiouzmga.supabase.co/rest/v1/use_logs',
    'wss://sgrqnewbqtejxiouzmga.supabase.co/realtime/v1/websocket',
    'https://evil.example/auth/v1/signup',
    'https://vercel.live/_next/static/feedback.js'
];

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

test('meta CSP is local-only and blocks Supabase and other external connections', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const policy = metaCspFromHtml(html);
    const directives = parseCspDirectives(policy);
    assert.deepEqual(directives['connect-src'], ["'self'"]);
    assert.deepEqual(directives['connect-src'], connectSrcSources());
    assert.equal(policy.includes('*'), false);
    assert.equal(policy.includes('supabase'), false);
    for (const url of BLOCKED) {
        assert.equal(connectSrcAllows(directives['connect-src'], url), false, url);
    }
    assert.equal(Object.prototype.hasOwnProperty.call(directives, 'frame-ancestors'), false);
    assert.deepEqual(directives['default-src'], ["'self'"]);
    assert.deepEqual(directives['object-src'], ["'none'"]);
    assert.deepEqual(directives['form-action'], ["'none'"]);
    assert.equal(policy, buildMetaCsp());
});

test('Vercel HTTP CSP keeps framing protection and still blocks Supabase', () => {
    const policy = headerCspFromVercel();
    const directives = parseCspDirectives(policy);
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
    assert.deepEqual(directives['connect-src'], ["'self'"]);
    assert.equal(policy.includes('supabase'), false);
    for (const url of BLOCKED) {
        assert.equal(connectSrcAllows(directives['connect-src'], url), false, url);
    }
    assert.equal(policy, buildHeaderCsp());
    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const xfo = vercel.headers.flatMap(entry => entry.headers).find(h => h.key === 'X-Frame-Options');
    assert.equal(xfo.value, 'DENY');
});

test('applyCspToHtml stamps the local-only meta policy', () => {
    const patched = applyCspToHtml(
        '<meta http-equiv="Content-Security-Policy" content="connect-src https://example.com">'
    );
    assert.match(patched, /connect-src 'self'/);
    assert.doesNotMatch(patched, /supabase|example\.com|frame-ancestors/);
});
