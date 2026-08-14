import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('layout redesign markup uses the approved page hierarchy', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="app-sidebar"/);
    assert.match(html, /Today at a Glance/);
    assert.match(html, /id="today-glance"/);
    assert.match(html, /data-inv-view="active"/);
    assert.match(html, /data-inv-view="purchases"/);
    assert.match(html, /data-inv-view="history"/);
    assert.match(html, /data-taper-workspace="weekly"/);
    assert.match(html, /data-settings-cat-btn="substances"/);
    assert.match(html, /data-settings-cat-btn="data"/);
    assert.match(html, /data-settings-cat-btn="appearance"/);
    assert.match(html, /data-settings-cat-btn="advanced"/);
    assert.match(html, /data-settings-cat-btn="about"/);
    assert.match(html, /setInsightsCalendarView\('money'\)">Spending</);
    assert.doesNotMatch(html, /Low Stock Alerts/);
    assert.match(html, /data-section="recentUse"/);
});

test('layout redesign CSS includes sidebar and shared cards', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.app-sidebar/);
    assert.match(css, /\.today-glance/);
    assert.match(css, /\.layout-legacy-hidden/);
    assert.match(css, /data-view-layout="laptop"\] \.app-sidebar/);
});

test('layout helpers keep inventory views and settings categories', () => {
    const rt = loadRecoveryTrackerApp();
    assert.deepEqual([...rt.LAYOUT_INVENTORY_VIEWS], ['active', 'purchases', 'history']);
    assert.deepEqual([...rt.LAYOUT_TAPER_WORKSPACE_VIEWS], ['weekly', 'purchases', 'details']);
    assert.deepEqual([...rt.LAYOUT_SETTINGS_CATEGORIES], ['substances', 'data', 'appearance', 'advanced', 'about']);
    assert.equal(typeof rt.renderTodayAtAGlance, 'function');
    assert.equal(typeof rt.setLayoutInventoryView, 'function');
});
