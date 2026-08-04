import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

const REFERENCE_DATE = '2026-08-01';

function setup({ purchases = [], logs = [], contacts = [], goals = [] } = {}) {
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
        goals,
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

/** Minimal element stub good enough for the contacts views rendered into #contacts-root. */
function makeNode(id) {
    const classes = new Set();
    return {
        id,
        value: '',
        checked: false,
        innerHTML: '',
        textContent: '',
        classList: {
            add: (...names) => names.forEach(n => classes.add(n)),
            remove: (...names) => names.forEach(n => classes.delete(n)),
            contains: name => classes.has(name)
        },
        setAttribute() {},
        querySelectorAll: () => [],
        scrollIntoView() {}
    };
}

function withDom(rt, ids = ['contacts-root']) {
    const nodes = new Map(ids.map(id => [id, makeNode(id)]));
    rt.document.getElementById = id => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = () => [];
    return nodes;
}

test('archive and restore flip visibility without dropping the record', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Riley', roles: ['friend'] });

    rt.archiveContact(contact.id);
    assert.equal(rt.getContactById(contact.id).archived, true);
    assert.equal(rt.getContacts().some(c => c.id === contact.id), false);
    assert.equal(rt.getContacts(rt.__getTestAppData(), { includeArchived: true }).some(c => c.id === contact.id), true);

    const restored = rt.restoreContact(contact.id);
    assert.equal(restored.archived, false);
    assert.equal(restored.active, true);
    assert.equal(rt.getContacts().some(c => c.id === contact.id), true);
    assert.equal(rt.restoreContact('missing-contact'), null);
});

test('display name falls back to nickname then free text', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Jonathan', nickname: 'Jono' });
    assert.equal(rt.resolveContactDisplayName(contact.id), 'Jono');
    assert.equal(rt.resolveContactDisplayName('missing-contact', '  Old text  '), 'Old text');
    assert.equal(rt.resolveContactDisplayName('', ''), '');
});

test('support profile exposes linked goals and falls back to contact notes', () => {
    const rt = setup();
    rt.__getTestAppData().goals.push({ id: 'goal-1', name: 'Stay under 1g', status: 'active' });
    assert.equal(rt.buildContactSupportProfile('missing-contact'), null);

    const contact = rt.saveContactRecord({
        name: 'Dr. Kim',
        roles: ['therapist'],
        notes: 'Weekly sessions',
        linkedGoalIds: ['goal-1', 'goal-missing']
    });
    const profile = rt.buildContactSupportProfile(contact.id);
    assert.equal(profile.notes, 'Weekly sessions');
    assert.equal(profile.linkedGoals.length, 1);
    assert.equal(profile.linkedGoals[0].name, 'Stay under 1g');
    assert.equal(profile.nextAppointment, '');

    const withSupport = rt.saveContactRecord({
        ...contact,
        supportProfile: { notes: 'Override', nextAppointment: '2026-08-10', meetings: [{ date: '2026-07-30', label: 'Check-in' }] }
    });
    const overridden = rt.buildContactSupportProfile(withSupport.id);
    assert.equal(overridden.notes, 'Override');
    assert.equal(overridden.nextAppointment, '2026-08-10');
    assert.equal(overridden.meetings.length, 1);
});

test('suggestions flag unconverted free text, duplicates and unlinked gift sources', () => {
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
            giftSource: 'Casey',
            unit: 'g'
        }]
    });
    rt.saveContactRecord({ name: 'Morgan' });
    rt.saveContactRecord({ name: 'morgan' });

    const suggestions = rt.buildContactSuggestions();
    const convert = suggestions.find(s => s.type === 'convert_free_text');
    assert.equal(convert.name, 'Casey');
    assert.equal(convert.severity, 'info');
    const duplicate = suggestions.find(s => s.type === 'duplicate_contacts');
    assert.equal(duplicate.severity, 'warn');
    assert.equal(duplicate.contactIds.length, 2);
    assert.ok(suggestions.some(s => s.type === 'missing_supplier_link' && s.purchaseId === 'p1'));

    const groups = rt.detectDuplicateContacts();
    assert.equal(groups.length, 1);
    assert.equal(groups[0].length, 2);
});

test('converting a free-text name creates a contact and links matching records', () => {
    const rt = setup({
        purchases: [{
            id: 'p1',
            substanceId: 'coke',
            date: '2026-07-10',
            quantityBought: 1,
            quantity: 1,
            remainingAmount: 1,
            totalCost: 60,
            acquisitionType: 'gift_received',
            giftSource: 'Casey',
            unit: 'g'
        }]
    });
    const created = rt.convertFreeTextNameToContact('Casey');
    assert.equal(created.name, 'Casey');
    assert.equal(created.source, 'suggestion:convert');
    assert.equal(rt.__getTestAppData().purchases[0].giftSourceContactId, created.id);

    const again = rt.convertFreeTextNameToContact('casey');
    assert.equal(again.id, created.id);
    assert.equal(rt.getContacts().length, 1);
});

test('contacts CSV export quotes separators and honours export exclusions', () => {
    const rt = setup();
    rt.saveContactRecord({ name: 'Sam, Jr.', nickname: 'SJ', tags: ['gym', 'sober'], favorite: true, notes: 'line one\nline two' });
    const hidden = rt.saveContactRecord({ name: 'Private Pat' });
    rt.saveContactRecord({ ...hidden, excludeFromExport: true });

    const csv = rt.exportContactsCsv();
    const lines = csv.split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^id,name,nickname,/);
    assert.match(lines[1], /"Sam, Jr\."/);
    assert.match(lines[1], /gym\|sober/);
    assert.match(lines[1], /line one line two/);
    assert.doesNotMatch(csv, /Private Pat/);
});

test('settings contacts view renders the list and a contact profile', () => {
    const rt = setup();
    const nodes = withDom(rt, ['contacts-root']);
    const root = nodes.get('contacts-root');
    const contact = rt.saveContactRecord({ name: 'Taylor', nickname: 'T', roles: ['friend'], favorite: true });

    rt.openManageContactsSettings();
    assert.match(root.innerHTML, /Manage Contacts/);
    assert.match(root.innerHTML, /ct-subnav/);

    rt.openManageContactsSettings(contact.id);
    assert.match(root.innerHTML, /Taylor/);
    assert.equal(typeof rt.__getTestAppData().settings.contacts.lastView, 'string');
});

test('contact detail panel renders into the panel and closes cleanly', () => {
    const rt = setup();
    const nodes = withDom(rt, ['contact-detail-panel', 'contact-detail-panel-body']);
    const panel = nodes.get('contact-detail-panel');
    const body = nodes.get('contact-detail-panel-body');
    const contact = rt.saveContactRecord({ name: 'Robin', roles: ['dealer_supplier'] });

    rt.openContactDetailPanel('');
    assert.equal(body.innerHTML, '');

    rt.openContactDetailPanel(contact.id);
    assert.match(body.innerHTML, /Robin/);
    assert.equal(panel.classList.contains('hidden'), false);

    rt.closeContactDetailPanel();
    assert.equal(panel.classList.contains('hidden'), true);
});

test('timeline view lists purchases, shared use and contact milestones newest first', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Jamie', birthday: '1994-08-20', notes: 'met at group' });
    const data = rt.__getTestAppData();
    data.purchases.push({
        id: 'p1',
        substanceId: 'coke',
        date: '2026-07-15',
        quantityBought: 1,
        quantity: 1,
        remainingAmount: 1,
        totalCost: 50,
        acquisitionType: 'purchased',
        supplierContactId: contact.id,
        unit: 'g'
    });
    data.logs.push({
        id: 'l1',
        substanceId: 'coke',
        date: '2026-07-28',
        amount: 1,
        transactionType: 'shared_use',
        sharedWithContactId: contact.id,
        personalAmount: 0.5,
        sharedAmount: 0.5,
        totalAmount: 1
    });

    const timeline = rt.buildContactTimeline(contact.id);
    const dates = timeline.map(e => e.date);
    assert.deepEqual([...dates], [...dates].sort().reverse());
    assert.ok(timeline.some(e => e.type === 'purchase' && e.recordId === 'p1'));
    assert.ok(timeline.some(e => e.type === 'shared' && e.recordId === 'l1'));
    assert.ok(timeline.some(e => e.type === 'milestone' && e.date === '2026-08-20'));
    assert.ok(timeline.some(e => e.type === 'note'));
    assert.equal(rt.buildContactTimeline('missing-contact').length, 0);
});
