import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecoveryTrackerApp } from './harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REFERENCE_DATE = '2026-08-01';

function setup({ purchases = [], logs = [], contacts = [] } = {}) {
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

test('markup keeps contacts in Settings without a Friends main nav tab', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /data-tab="contacts-tab"/);
    assert.match(html, /data-section="settingsContacts"/);
    assert.match(html, /id="contacts-root"/);
    assert.match(html, /id="contact-detail-panel"/);
    assert.match(html, /id="dash-contacts-root"/);
    assert.match(html, /id="insights-contacts-root"/);
    assert.match(html, /data-tab="goals-plans-tab"/);
});

test('normalize and save contact preserves permanent id and multi-roles', () => {
    const rt = setup();
    const saved = rt.saveContactRecord({
        name: 'Michael',
        roles: ['friend', 'dealer_supplier'],
        favorite: true
    });
    assert.ok(saved.id.startsWith('contact-'));
    assert.equal(saved.name, 'Michael');
    assert.ok(saved.roles.includes('friend'));
    assert.ok(saved.roles.includes('dealer_supplier'));
    const again = rt.getContactById(saved.id);
    assert.equal(again.id, saved.id);
});

test('migration converts free-text gift names into contacts and links ids', () => {
    const rt = setup({
        purchases: [{
            id: 'p1',
            substanceId: 'coke',
            date: '2026-07-10',
            quantityBought: 2,
            quantity: 2,
            remainingAmount: 2,
            totalCost: 80,
            acquisitionType: 'gift_received',
            giftSource: 'Alex',
            unit: 'g'
        }],
        logs: [{
            id: 'l1',
            substanceId: 'coke',
            date: '2026-07-12',
            amount: 0.5,
            transactionType: 'gift_given',
            recipientName: 'Sam',
            giftPartyName: 'Sam'
        }],
        contacts: []
    });
    const data = rt.__getTestAppData();
    data.migrations.contactsFromFreeTextV1 = false;
    const result = rt.migrateContactsFromFreeText(data);
    assert.ok(result.created >= 2);
    assert.ok(rt.findContactByName('Alex', data));
    assert.ok(rt.findContactByName('Sam', data));
    assert.ok(data.purchases[0].giftSourceContactId);
    assert.ok(data.logs[0].giftPartyContactId);
    // free-text preserved
    assert.equal(data.purchases[0].giftSource, 'Alex');
});

test('merge contacts rewrites links and preserves target id', () => {
    const rt = setup();
    const a = rt.saveContactRecord({ name: 'Jordan', roles: ['friend'] });
    const b = rt.saveContactRecord({ name: 'Jordan', roles: ['dealer_supplier'] });
    const data = rt.__getTestAppData();
    data.purchases = [{
        id: 'p-merge',
        substanceId: 'coke',
        date: '2026-07-01',
        quantityBought: 1,
        quantity: 1,
        remainingAmount: 1,
        totalCost: 40,
        acquisitionType: 'purchased',
        store: 'Jordan',
        supplierContactId: a.id,
        unit: 'g'
    }];
    const merged = rt.mergeContacts(a.id, b.id, data);
    assert.equal(merged.id, b.id);
    assert.ok(merged.roles.includes('friend'));
    assert.ok(merged.roles.includes('dealer_supplier'));
    assert.equal(rt.getContactById(a.id, data), null);
    assert.equal(data.purchases[0].supplierContactId, b.id);
});

test('recovery metrics and timeline use linked purchases and logs', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Dealer Dan', roles: ['dealer_supplier'] });
    const data = rt.__getTestAppData();
    data.purchases = [{
        id: 'p1',
        substanceId: 'coke',
        date: '2026-07-01',
        quantityBought: 2,
        quantity: 2,
        remainingAmount: 1,
        totalCost: 100,
        acquisitionType: 'purchased',
        store: 'Dealer Dan',
        supplierContactId: contact.id,
        unit: 'g'
    }];
    data.logs = [{
        id: 'l1',
        substanceId: 'coke',
        date: '2026-07-05',
        amount: 0.2,
        transactionType: 'shared_use',
        sharedWithName: 'Dealer Dan',
        sharedWithContactId: contact.id
    }];
    const metrics = rt.buildContactRecoveryMetrics(contact.id, data);
    assert.ok(metrics.purchasesFromContact >= 1);
    assert.equal(metrics.moneySpent, 100);
    assert.ok(metrics.sharedSessions >= 1);
    const timeline = rt.buildContactTimeline(contact.id, data);
    assert.ok(timeline.some(e => e.type === 'purchase'));
    assert.ok(timeline.some(e => e.type === 'shared' || e.type === 'use' || e.label));
});

test('archive does not delete history links on purchases', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Keep History', roles: ['friend'] });
    const data = rt.__getTestAppData();
    data.purchases = [{
        id: 'p1',
        substanceId: 'coke',
        date: '2026-07-01',
        quantityBought: 1,
        quantity: 1,
        remainingAmount: 1,
        totalCost: 20,
        acquisitionType: 'purchased_as_gift',
        giftRecipient: 'Keep History',
        giftRecipientContactId: contact.id,
        unit: 'g'
    }];
    rt.archiveContact(contact.id, data);
    assert.equal(rt.getContactById(contact.id, data).archived, true);
    assert.equal(data.purchases[0].giftRecipientContactId, contact.id);
    assert.equal(data.purchases[0].giftRecipient, 'Keep History');
});

test('export csv excludes export-excluded contacts and strips local-only notes in backup map', () => {
    const rt = setup();
    rt.saveContactRecord({ name: 'Public', roles: ['friend'], notes: 'ok' });
    rt.saveContactRecord({ name: 'Hidden Export', roles: ['friend'], excludeFromExport: true, notes: 'secret' });
    const rows = rt.buildContactsCsvRows(rt.__getTestAppData());
    assert.ok(rows.some(r => r[1] === 'Public'));
    assert.ok(!rows.some(r => r[1] === 'Hidden Export'));
    const exported = rt.cleanExportData(rt.__getTestAppData());
    assert.ok(Array.isArray(exported.contacts));
    assert.ok(exported.contacts.every(c => c.name !== 'Hidden Export'));
});

test('dashboard and analytics expose required summary fields', () => {
    const rt = setup();
    rt.saveContactRecord({ name: 'A', roles: ['friend'], favorite: true });
    rt.saveContactRecord({ name: 'B', roles: ['dealer_supplier'] });
    rt.saveContactRecord({ name: 'C', roles: ['sponsor'] });
    const dash = rt.buildContactsDashboard(rt.__getTestAppData());
    assert.ok('totalContacts' in dash);
    assert.ok('friends' in dash);
    assert.ok('suppliers' in dash);
    assert.ok('sponsors' in dash);
    assert.ok('favorites' in dash);
    const analytics = rt.buildContactAnalytics(rt.__getTestAppData());
    assert.ok('mostFrequentSupplier' in analytics);
    assert.ok('highestSpendingSupplier' in analytics);
});
