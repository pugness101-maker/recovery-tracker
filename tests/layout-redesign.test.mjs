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
    assert.doesNotMatch(html, /sidebar-heading">Quick Add</);
    assert.doesNotMatch(html, /openLayoutAddAdjustment/);
    assert.match(html, /Today at a Glance/);
    assert.match(html, /id="today-glance"/);
    assert.match(html, /id="simple-home"[^>]*layout-legacy-hidden/);
    assert.match(html, /dash-safety layout-legacy-hidden/);
    const homeSaved = html.match(/<p\b[^>]*id="home-last-saved"[^>]*>/);
    assert.ok(homeSaved, 'home-last-saved compatibility hook must exist');
    assert.match(homeSaved[0], /data-last-saved-display/);
    assert.match(homeSaved[0], /layout-legacy-hidden/);
    assert.ok((html.match(/data-last-saved-display/g) || []).length >= 2, 'dashboard should expose last-saved display hooks');
    assert.doesNotMatch(html, /id="dashboard-last-saved"/);
    assert.doesNotMatch(html, /data-inv-view="active"/);
    assert.doesNotMatch(html, /data-inv-view="purchases"/);
    assert.doesNotMatch(html, /data-inv-view="history"/);
    assert.match(html, /data-inv-date="today"/);
    assert.match(html, /data-inv-date="last-7"/);
    assert.match(html, /data-inv-date="all"/);
    assert.match(html, /openLayoutAddPurchase\(\)">\+ Add Purchase</);
    assert.match(html, /data-taper-workspace="weekly"/);
    assert.match(html, /data-settings-cat-btn="substances"/);
    assert.match(html, /data-settings-cat-btn="data"/);
    assert.match(html, /data-settings-cat-btn="appearance"/);
    assert.match(html, /data-settings-cat-btn="advanced"/);
    assert.match(html, /data-settings-cat-btn="about"/);
    assert.match(html, /setInsightsCalendarView\('money'\)">Spending</);
    assert.doesNotMatch(html, /Low Stock Alerts/);
    assert.doesNotMatch(html, /<option value="shared_use">/);
    assert.doesNotMatch(html, /<option value="inventory_adjustment">/);
    assert.match(html, /data-section="recentUse"/);
    const glanceIdx = html.indexOf('id="today-glance"');
    const wrapIdx = html.indexOf('id="advanced-home-wrap"');
    assert.ok(glanceIdx > 0 && wrapIdx > glanceIdx, 'today-glance must render outside the legacy advanced home wrap');
});

test('layout redesign CSS includes sidebar and shared cards', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.app-sidebar/);
    assert.match(css, /\.today-glance/);
    assert.match(css, /\.layout-legacy-hidden/);
    assert.match(css, /data-view-layout="laptop"\] \.app-sidebar/);
    assert.match(css, /body\.layout-redesign #simple-home/);
    assert.match(css, /body\.experience-simple\.layout-redesign \.bottom-nav/);
    assert.match(css, /glance-status-grid \{\s*grid-template-columns: repeat\(6/);
});

test('layout helpers keep inventory views and settings categories', () => {
    const rt = loadRecoveryTrackerApp();
    assert.deepEqual([...rt.LAYOUT_INVENTORY_VIEWS], ['all']);
    assert.deepEqual([...rt.LAYOUT_TAPER_WORKSPACE_VIEWS], ['weekly', 'purchases', 'details']);
    assert.deepEqual([...rt.LAYOUT_SETTINGS_CATEGORIES], ['substances', 'data', 'appearance', 'advanced', 'about']);
    assert.equal(typeof rt.renderTodayAtAGlance, 'function');
    assert.equal(typeof rt.setLayoutInventoryView, 'function');
    assert.equal(rt.getLayoutTodayActivityLabel({ name: 'Coke', unit: 'g' }), 'used today');
    assert.equal(rt.getLayoutTodayActivityLabel({ name: 'Nicotine', unit: 'puffs' }), 'puffs today');
    assert.equal(rt.getLayoutTodayActivityLabel({ name: 'LSD', unit: 'tabs' }), 'tabs / µg today');
    assert.equal(rt.getLayoutTodayActivityLabel({ name: 'Xanax', unit: 'mg' }), 'pills / mg today');
    assert.deepEqual([...rt.CALENDAR_UI_HIDDEN_EVENT_TYPES].sort(), [
        'craving',
        'inventory_adjustment',
        'recovery_milestone',
        'shared_use'
    ]);
});
