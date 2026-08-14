#!/usr/bin/env node
/**
 * Write dist/cloud-config.js from environment variables.
 * Never embeds the service-role key.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCspToHtml, DEFAULT_SUPABASE_URL } from './csp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function loadEnvFile(file) {
    if (!existsSync(file)) return;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
    }
}

loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local'));

const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const anon = String(process.env.SUPABASE_ANON_KEY || '').trim();
const configured = !!(url && anon);

const body = `/* Generated at build time. Public anon key only. */
window.__RECOVERY_TRACKER_CLOUD__ = {
    supabaseUrl: ${JSON.stringify(configured ? url : '')},
    supabaseAnonKey: ${JSON.stringify(configured ? anon : '')},
    configured: ${configured ? 'true' : 'false'}
};
`;

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'cloud-config.js'), body);

const htmlPath = join(dist, 'index.html');
if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf8');
    writeFileSync(htmlPath, applyCspToHtml(html, url || DEFAULT_SUPABASE_URL));
}

console.log(configured
    ? 'Wrote dist/cloud-config.js (cloud configured)'
    : 'Wrote dist/cloud-config.js (cloud not configured)');
