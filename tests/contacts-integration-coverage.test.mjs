import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

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

function makeNode(id) {
    const classes = new Set();
    return {
        id,
        value: '',
        innerHTML: '',
        textContent: '',
        classList: {
            add: (...names) => names.forEach(n => classes.add(n)),
            remove: (...names) => names.forEach(n => classes.delete(n)),
            contains: name => classes.has(name)
        },
        getAttribute: () => null,
        setAttribute() {},
        querySelectorAll: () => []
    };
}

/** Wires the picker field ids a form needs: `${fieldId}`, `-contact-id`, `-search`, `-menu`. */
function mountPickerDom(rt, fieldIds) {
    const nodes = new Map();
    const selected = new Map();
    fieldIds.forEach(fieldId => {
        [fieldId, `${fieldId}-contact-id`, `${fieldId}-search`, `${fieldId}-menu`].forEach(id => nodes.set(id, makeNode(id)));
        selected.set(`[data-ct-picker="${fieldId}"] .ct-picker-selected`, makeNode(`${fieldId}-selected`));
    });
    rt.document.getElementById = id => nodes.get(id) || null;
    rt.document.querySelector = selector => selected.get(selector) || null;
    rt.document.querySelectorAll = () => [];
    return { nodes, selected };
}

test('picker markup shows the linked contact and keeps unlinked free text visible', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Avery', roles: ['shared_use_contact'] });

    const linked = rt.buildContactPickerHtml({ fieldId: 'use-shared-with', selectedId: contact.id, label: 'Shared with' });
    assert.match(linked, /data-ct-picker="use-shared-with"/);
    assert.match(linked, /Linked: /);
    assert.match(linked, /Avery/);

    const freeText = rt.buildContactPickerHtml({ fieldId: 'use-shared-with', freeTextValue: 'Unknown friend', label: 'Shared with' });
    assert.match(freeText, /Unlinked text: Unknown friend/);
    assert.doesNotMatch(freeText, /Linked: /);
});

test('selecting and clearing a picker keeps the id, free-text and search inputs in sync', () => {
    const rt = setup();
    const contact = rt.saveContactRecord({ name: 'Avery', nickname: 'Ave', roles: ['shared_use_contact'] });
    const { nodes, selected } = mountPickerDom(rt, ['use-shared-with']);

    rt.selectContactPickerValue('use-shared-with', contact.id);
    assert.equal(nodes.get('use-shared-with-contact-id').value, contact.id);
    assert.equal(nodes.get('use-shared-with').value, 'Avery');
    assert.equal(nodes.get('use-shared-with-search').value, 'Avery (Ave)');
    assert.equal(nodes.get('use-shared-with-menu').classList.contains('hidden'), true);
    assert.match(selected.get('[data-ct-picker="use-shared-with"] .ct-picker-selected').innerHTML, /Ave/);

    assert.deepEqual({ ...rt.getContactPickerSelection('use-shared-with') }, { contactId: contact.id, name: 'Avery' });

    rt.clearContactPicker('use-shared-with');
    assert.equal(nodes.get('use-shared-with-contact-id').value, '');
    assert.equal(nodes.get('use-shared-with').value, '');
    assert.equal(nodes.get('use-shared-with-search').value, '');
    assert.equal(selected.get('[data-ct-picker="use-shared-with"] .ct-picker-selected').textContent, '');
});

test('picker selection falls back to typed free text when nothing is linked', () => {
    const rt = setup();
    const { nodes } = mountPickerDom(rt, ['use-gift-party']);
    nodes.get('use-gift-party').value = '  Unknown friend  ';

    const selection = rt.getContactPickerSelection('use-gift-party');
    assert.equal(selection.contactId, '');
    assert.equal(selection.name, 'Unknown friend');
});

test('log entries pick up contact ids and names per transaction type', () => {
    const rt = setup();
    const { nodes } = mountPickerDom(rt, ['use-gift-party']);

    // shared_use is legacy-read-only: contact picker no longer writes shared-with fields
    const shared = rt.applyLogContactIdsToEntry({
        transactionType: 'shared_use',
        sharedWithContactId: 'legacy-id',
        sharedWithName: 'Legacy Friend'
    });
    assert.equal(shared.sharedWithContactId, 'legacy-id');
    assert.equal(shared.sharedWithName, 'Legacy Friend');
    assert.equal(shared.giftPartyContactId, undefined);

    nodes.get('use-gift-party').value = 'Jesse';
    const giftGiven = rt.applyLogContactIdsToEntry({ transactionType: 'gift_given' });
    assert.equal(giftGiven.giftPartyName, 'Jesse');
    assert.equal(giftGiven.recipientName, 'Jesse');
    assert.equal(giftGiven.giverName, undefined);

    const giftReceived = rt.applyLogContactIdsToEntry({ transactionType: 'gift_received' });
    assert.equal(giftReceived.giverName, 'Jesse');

    const plainUse = rt.applyLogContactIdsToEntry({ transactionType: 'use' });
    assert.equal(plainUse.sharedWithContactId, undefined);
    assert.equal(plainUse.giftPartyContactId, undefined);
    assert.equal(rt.applyLogContactIdsToEntry(null), null);
});

test('purchase payloads pick up gift and supplier contacts without overwriting the store', () => {
    const rt = setup();
    const supplier = rt.saveContactRecord({ name: 'Dealer Dan', roles: ['dealer_supplier'] });
    const { nodes } = mountPickerDom(rt, ['buy-gift-source', 'buy-gift-recipient', 'buy-supplier-contact']);

    nodes.get('buy-gift-source').value = 'Sasha';
    nodes.get('buy-gift-recipient').value = 'Kim';
    nodes.get('buy-supplier-contact-contact-id').value = supplier.id;

    const payload = rt.applyBuyContactIdsToPayload({});
    assert.equal(payload.giftSource, 'Sasha');
    assert.equal(payload.giftRecipient, 'Kim');
    assert.equal(payload.supplierContactId, supplier.id);
    assert.equal(payload.store, 'Dealer Dan');

    const withStore = rt.applyBuyContactIdsToPayload({ store: 'Corner shop' });
    assert.equal(withStore.store, 'Corner shop');
    assert.equal(rt.applyBuyContactIdsToPayload(null), null);
});

test('plan contact fields read their own pickers and stay optional', () => {
    const rt = setup();
    const sponsor = rt.saveContactRecord({ name: 'Pat', roles: ['sponsor'] });
    const { nodes } = mountPickerDom(rt, ['plan-sponsor-contact', 'plan-partner-contact', 'plan-support-contact']);
    nodes.get('plan-sponsor-contact-contact-id').value = sponsor.id;

    const draft = rt.applyPlanContactFieldsToDraft({ name: 'Taper plan' });
    assert.equal(draft.sponsorContactId, sponsor.id);
    assert.equal(draft.sponsorName, 'Pat');
    assert.equal(draft.planPartnerContactId, '');
    assert.equal(draft.supportContactId, '');
    assert.equal(rt.applyPlanContactFieldsToDraft(null), null);

    const html = rt.renderGoalPlanContactFieldsHtml('plan', { sponsorContactId: sponsor.id });
    assert.match(html, /plan-sponsor-contact/);
    assert.match(html, /Sponsor/);
});

test('log pickers mount once into the gift form group', () => {
    const rt = setup();
    const giftGroup = makeNode('use-gift-party-group');
    let giftReplacedWith = null;
    const giftInput = makeNode('use-gift-party');
    giftInput.replaceWith = node => { giftReplacedWith = node; };

    const nodes = new Map([
        ['use-gift-party-group', giftGroup],
        ['use-gift-party', giftInput]
    ]);
    giftGroup.querySelector = () => null;
    rt.document.getElementById = id => nodes.get(id) || null;
    rt.document.querySelector = () => null;
    rt.document.querySelectorAll = () => [];
    rt.document.createElement = () => {
        const node = makeNode('wrap');
        node.firstElementChild = makeNode('picker');
        return node;
    };

    rt.mountLogContactPickers();
    assert.ok(giftReplacedWith, 'gift free-text input should be replaced by a picker');
    assert.equal(rt.document.getElementById('use-shared-with'), null, 'shared-with field is removed from the form');

    // Already mounted: a second call must not replace again.
    giftGroup.querySelector = () => makeNode('existing');
    const firstPicker = giftReplacedWith;
    rt.mountLogContactPickers();
    assert.equal(giftReplacedWith, firstPicker);
});
