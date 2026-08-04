import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const PAYLOAD = '<img src=x onerror=alert(1)>';

function makeSubstance(overrides = {}) {
    return {
        id: 'weed-thc',
        name: 'Weed/THC',
        icon: '🌿',
        color: '#66bb6a',
        trackingMode: 'weed',
        primaryUnit: 'grams',
        units: ['grams'],
        defaultUnit: 'grams',
        costTrackingEnabled: true,
        taperTrackingEnabled: true,
        active: true,
        ...overrides
    };
}

function makeLog(overrides = {}) {
    return {
        id: 1,
        substanceId: 'weed-thc',
        date: '2025-01-05',
        time: '12:00',
        startTime: '12:00',
        amount: 1,
        unit: 'grams',
        transactionType: 'use',
        type: 'quick',
        ...overrides
    };
}

test('escapeHtml neutralizes HTML and both quote characters', () => {
    const rt = loadRecoveryTrackerApp();
    const escaped = rt.escapeHtml(`<b>"x"</b> 'y' & z`);
    assert.equal(escaped, '&lt;b&gt;&quot;x&quot;&lt;/b&gt; &#39;y&#39; &amp; z');
});

test('escapeAttr neutralizes quotes and angle brackets', () => {
    const rt = loadRecoveryTrackerApp();
    const escaped = rt.escapeAttr(`" onload='x' <y>`);
    assert.equal(escaped, '&quot; onload=&#39;x&#39; &lt;y&gt;');
});

test('use history notes and substance names are escaped', () => {
    const rt = loadRecoveryTrackerApp();
    const sub = makeSubstance({ name: PAYLOAD });
    const entry = makeLog({ notes: PAYLOAD });

    const notesCell = rt.renderUseHistoryBodyCell('notes', entry, sub, null);
    assert.ok(!notesCell.includes('<img'), 'notes cell must not contain raw markup');
    assert.ok(notesCell.includes('&lt;img'), 'notes cell must contain escaped markup');

    const substanceCell = rt.renderUseHistoryBodyCell('substance', entry, sub, null);
    assert.ok(!substanceCell.includes('<img'), 'substance cell must not contain raw markup');

    const card = rt.renderUseHistoryCard(entry, sub, null);
    assert.ok(!card.includes('<img'), 'use history card must not contain raw markup');
    assert.ok(card.includes('&lt;img'), 'use history card must contain escaped markup');
});
