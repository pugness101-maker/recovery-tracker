import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REFERENCE_DATE = '2026-08-01';

function setup({ contacts = [], logs = [], purchases = [] } = {}) {
    const rt = loadRecoveryTrackerApp();
    rt.setTestReferenceDate(REFERENCE_DATE);
    rt.__setTestAppData({
        substances: [{
            id: 'coke',
            name: 'Coke',
            trackingMode: 'powder',
            primaryUnit: 'g',
            defaultUnit: 'g',
            costTrackingEnabled: true,
            active: true,
            isMain: true
        }],
        logs,
        purchases,
        contacts,
        goals: [],
        budgets: [],
        cravings: [],
        settings: { currency: '$', substanceSettings: {} },
        taperPlans: {},
        taperPlansV2: [],
        recoveryStreaks: {},
        privacy: { enabled: false, pinHash: '', autoLockMinutes: 5 },
        migrations: { contactsFromFreeTextV1: true }
    });
    rt.ensureContacts();
    return rt;
}

test('contact picker ranks favorites first and filters by role/search', () => {
    const rt = setup();
    const a = rt.saveContactRecord({ name: 'Alex', roles: ['dealer_supplier'], favorite: false });
    const b = rt.saveContactRecord({ name: 'Blake', roles: ['friend', 'shared_use_contact'], favorite: true });
    const ranked = rt.rankContactsForPicker(rt.getContacts(), '', 'shared');
    assert.equal(ranked[0].id, b.id);
    const search = rt.rankContactsForPicker(rt.getContacts(), 'ale', 'supplier');
    assert.equal(search.length, 1);
    assert.equal(search[0].id, a.id);
});

test('resolveLogContactLabel prefers linked contact ids', () => {
    const rt = setup();
    const c = rt.saveContactRecord({ name: 'Sam', roles: ['shared_use_contact'] });
    const label = rt.resolveLogContactLabel({
        transactionType: 'shared_use',
        sharedWithContactId: c.id,
        sharedWithName: 'Old Text'
    });
    assert.equal(label, 'Sam');
});

test('home contact cards omit empty state and include recent shared-use', () => {
    const rt = setup();
    assert.equal(rt.buildHomeContactCardsHtml(rt.__getTestAppData()), '');
    const c = rt.saveContactRecord({ name: 'Jordan', roles: ['shared_use_contact'] });
    const data = rt.__getTestAppData();
    data.logs.push({
        id: 'l1',
        substanceId: 'coke',
        date: '2026-07-28',
        amount: 1,
        transactionType: 'shared_use',
        sharedWithContactId: c.id,
        sharedWithName: 'Jordan',
        personalAmount: 0.5,
        sharedAmount: 0.5,
        totalAmount: 1
    });
    const html = rt.buildHomeContactCardsHtml(data);
    assert.match(html, /Recent shared-use/);
    assert.match(html, /Jordan/);
    assert.match(html, /openContactDetailPanel/);
});

test('insights contact analytics html lists supplier metrics', () => {
    const rt = setup();
    const supplier = rt.saveContactRecord({ name: 'Dealer Dan', roles: ['dealer_supplier'] });
    const data = rt.__getTestAppData();
    data.purchases.push({
        id: 'p1',
        substanceId: 'coke',
        date: '2026-07-15',
        quantityBought: 2,
        remainingAmount: 1,
        totalCost: 80,
        acquisitionType: 'purchased',
        supplierContactId: supplier.id,
        store: 'Dealer Dan',
        unit: 'g'
    });
    const html = rt.buildInsightsContactAnalyticsHtml(data);
    assert.match(html, /Dealer Dan/);
    assert.match(html, /Most frequent supplier|Highest spending supplier/);
});

test('goal contact field helpers stay optional', () => {
    const rt = setup();
    const out = rt.applyGoalContactFieldsToDraft({ name: 'Test goal' });
    assert.equal(out.accountabilityPartnerContactId, '');
    const html = rt.renderGoalPlanContactFieldsHtml('goal', null);
    assert.match(html, /Accountability partner/);
    assert.match(html, /goal-accountability-partner/);
});

test('main nav has no Friends tab; settings hosts contacts root', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /data-tab="contacts-tab"/);
    assert.match(html, /data-section="settingsContacts"/);
    assert.match(html, /id="contacts-root"/);
    const rt = setup();
    assert.equal(typeof rt.openManageContactsSettings, 'function');
    assert.equal(typeof rt.openContactDetailPanel, 'function');
    assert.equal(typeof rt.buildContactPickerHtml, 'function');
});
