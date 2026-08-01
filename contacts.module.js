// ——— Friends & Contacts ———
// Centralized people, suppliers, and recovery support contacts.
// Local-only. Spliced into app.js ahead of `const defaultData`.
// Free-text names remain valid; contactId links are additive and never delete history.

const CONTACT_ROLES = Object.freeze([
    'friend',
    'family',
    'partner',
    'dealer_supplier',
    'dispensary',
    'pharmacy',
    'doctor',
    'therapist',
    'sponsor',
    'accountability_partner',
    'recovery_group',
    'emergency_contact',
    'other'
]);

const CONTACT_ROLE_LABELS = Object.freeze({
    friend: 'Friend',
    family: 'Family',
    partner: 'Partner',
    dealer_supplier: 'Dealer/Supplier',
    dispensary: 'Dispensary',
    pharmacy: 'Pharmacy',
    doctor: 'Doctor',
    therapist: 'Therapist',
    sponsor: 'Sponsor',
    accountability_partner: 'Accountability Partner',
    recovery_group: 'Recovery Group',
    emergency_contact: 'Emergency Contact',
    other: 'Other'
});

const CONTACT_SUPPLIER_ROLES = Object.freeze(['dealer_supplier', 'dispensary', 'pharmacy']);
const CONTACT_SUPPORT_ROLES = Object.freeze(['sponsor', 'accountability_partner', 'therapist', 'doctor', 'recovery_group']);
const CONTACT_FRIEND_ROLES = Object.freeze(['friend', 'family', 'partner']);

let contactsUiState = {
    loading: false,
    error: '',
    view: 'dashboard', // dashboard | list | detail | form | analytics | timeline | suggestions
    filter: 'all',
    search: '',
    detailId: '',
    formDraft: null,
    mergeSourceId: '',
    mergeTargetId: ''
};

function ctTrim(value) {
    return String(value ?? '').trim();
}

function ctKey(value) {
    return ctTrim(value).toLowerCase();
}

function ctToNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function ctRound(value, decimals = 2) {
    const n = ctToNumber(value, NaN);
    if (!Number.isFinite(n)) return null;
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
}

function ctToday() {
    return typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().slice(0, 10);
}

function ctNowIso() {
    return new Date().toISOString();
}

function ctMoney(value) {
    if (value == null || !Number.isFinite(ctToNumber(value, NaN))) return '—';
    const sym = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$';
    return `${sym}${formatAmount(ctToNumber(value, 0), 2)}`;
}

function createContactId() {
    return `contact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultContactRecord() {
    return {
        id: '',
        name: '',
        nickname: '',
        avatar: '',
        tags: [],
        relationship: '',
        roles: [],
        phone: '',
        email: '',
        address: '',
        notes: '',
        birthday: '',
        favorite: false,
        active: true,
        archived: false,
        hidden: false,
        colorLabel: '',
        excludeFromExport: false,
        localNotesOnly: false,
        supplierProfile: {
            reliability: null,
            typicalResponseTime: '',
            availabilityNotes: '',
            paymentMethodsAccepted: []
        },
        supportProfile: {
            meetings: [],
            checkIns: [],
            messages: [],
            goalsDiscussed: [],
            notes: '',
            recoveryMilestones: [],
            nextAppointment: ''
        },
        linkedGoalIds: [],
        linkedPlanIds: [],
        createdAt: '',
        updatedAt: '',
        source: ''
    };
}

function normalizeContactRoles(roles) {
    const list = Array.isArray(roles) ? roles : [];
    const out = [];
    list.forEach(role => {
        const key = ctKey(role).replace(/\s+/g, '_').replace(/\//g, '_');
        const aliases = {
            dealer: 'dealer_supplier',
            supplier: 'dealer_supplier',
            'dealer_supplier': 'dealer_supplier',
            accountability: 'accountability_partner',
            'accountability_partner': 'accountability_partner',
            emergency: 'emergency_contact',
            'emergency_contact': 'emergency_contact',
            group: 'recovery_group',
            'recovery_group': 'recovery_group'
        };
        const normalized = aliases[key] || key;
        if (CONTACT_ROLES.includes(normalized) && !out.includes(normalized)) out.push(normalized);
    });
    return out;
}

function normalizeContactRecord(raw = {}) {
    const base = getDefaultContactRecord();
    const contact = { ...base, ...(raw || {}) };
    contact.id = ctTrim(contact.id) || createContactId();
    contact.name = ctTrim(contact.name);
    contact.nickname = ctTrim(contact.nickname);
    contact.avatar = ctTrim(contact.avatar);
    contact.tags = Array.isArray(contact.tags)
        ? contact.tags.map(ctTrim).filter(Boolean)
        : ctTrim(contact.tags).split(',').map(ctTrim).filter(Boolean);
    contact.relationship = ctTrim(contact.relationship);
    contact.roles = normalizeContactRoles(contact.roles);
    if (!contact.roles.length && contact.relationship) {
        contact.roles = normalizeContactRoles([contact.relationship]);
    }
    contact.phone = ctTrim(contact.phone);
    contact.email = ctTrim(contact.email);
    contact.address = ctTrim(contact.address);
    contact.notes = String(contact.notes || '');
    contact.birthday = ctTrim(contact.birthday);
    contact.favorite = !!contact.favorite;
    contact.active = contact.active !== false;
    contact.archived = !!contact.archived;
    contact.hidden = !!contact.hidden;
    contact.colorLabel = ctTrim(contact.colorLabel);
    contact.excludeFromExport = !!contact.excludeFromExport;
    contact.localNotesOnly = !!contact.localNotesOnly;
    contact.supplierProfile = {
        ...base.supplierProfile,
        ...(contact.supplierProfile && typeof contact.supplierProfile === 'object' ? contact.supplierProfile : {})
    };
    if (!Array.isArray(contact.supplierProfile.paymentMethodsAccepted)) {
        contact.supplierProfile.paymentMethodsAccepted = [];
    }
    contact.supportProfile = {
        ...base.supportProfile,
        ...(contact.supportProfile && typeof contact.supportProfile === 'object' ? contact.supportProfile : {})
    };
    ['meetings', 'checkIns', 'messages', 'goalsDiscussed', 'recoveryMilestones'].forEach(key => {
        if (!Array.isArray(contact.supportProfile[key])) contact.supportProfile[key] = [];
    });
    contact.linkedGoalIds = Array.isArray(contact.linkedGoalIds) ? contact.linkedGoalIds.map(ctTrim).filter(Boolean) : [];
    contact.linkedPlanIds = Array.isArray(contact.linkedPlanIds) ? contact.linkedPlanIds.map(ctTrim).filter(Boolean) : [];
    contact.createdAt = contact.createdAt || ctNowIso();
    contact.updatedAt = contact.updatedAt || contact.createdAt;
    contact.source = ctTrim(contact.source);
    return contact;
}

function ensureContacts(data = appData) {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.contacts)) data.contacts = [];
    data.contacts = data.contacts.map(normalizeContactRecord);
    return data.contacts;
}

function getContacts(data = appData, options = {}) {
    ensureContacts(data);
    let list = data.contacts.slice();
    if (!options.includeArchived) list = list.filter(c => !c.archived);
    if (!options.includeHidden) list = list.filter(c => !c.hidden);
    if (options.onlyActive) list = list.filter(c => c.active);
    if (options.favorites) list = list.filter(c => c.favorite);
    if (options.role) list = list.filter(c => (c.roles || []).includes(options.role));
    if (options.supplier) list = list.filter(c => (c.roles || []).some(r => CONTACT_SUPPLIER_ROLES.includes(r)));
    if (options.friend) list = list.filter(c => (c.roles || []).some(r => CONTACT_FRIEND_ROLES.includes(r)));
    if (options.support) list = list.filter(c => (c.roles || []).some(r => CONTACT_SUPPORT_ROLES.includes(r)));
    if (options.search) {
        const q = ctKey(options.search);
        list = list.filter(c => {
            const hay = [
                c.name, c.nickname, c.relationship, c.notes, c.phone, c.email, c.address,
                ...(c.tags || []), ...(c.roles || []).map(r => CONTACT_ROLE_LABELS[r] || r)
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }
    return list.sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return String(a.name).localeCompare(String(b.name));
    });
}

function getContactById(contactId, data = appData) {
    if (!contactId) return null;
    ensureContacts(data);
    return data.contacts.find(c => c && c.id === contactId) || null;
}

function findContactByName(name, data = appData) {
    const key = ctKey(name);
    if (!key) return null;
    ensureContacts(data);
    return data.contacts.find(c => {
        if (ctKey(c.name) === key || ctKey(c.nickname) === key) return true;
        return (c.tags || []).some(t => ctKey(t) === key);
    }) || null;
}

function resolveContactDisplayName(contactId, fallback = '', data = appData) {
    const contact = getContactById(contactId, data);
    if (contact) return contact.nickname || contact.name;
    return ctTrim(fallback);
}

function contactHasRole(contact, role) {
    return !!(contact && Array.isArray(contact.roles) && contact.roles.includes(role));
}

function isSupplierContact(contact) {
    return !!(contact && (contact.roles || []).some(r => CONTACT_SUPPLIER_ROLES.includes(r)));
}

function isSupportContact(contact) {
    return !!(contact && (contact.roles || []).some(r => CONTACT_SUPPORT_ROLES.includes(r)));
}

function getDefaultContactsPrefs() {
    return {
        showHidden: false,
        showArchived: false,
        lastView: 'dashboard',
        listFilter: 'all'
    };
}

function ensureContactsPrefs(data = appData) {
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultContactsPrefs();
    if (!data.settings.contacts || typeof data.settings.contacts !== 'object') {
        data.settings.contacts = { ...defaults };
    }
    Object.keys(defaults).forEach(key => {
        if (data.settings.contacts[key] === undefined) data.settings.contacts[key] = defaults[key];
    });
    return data.settings.contacts;
}

function persistContactsPrefs(patch = {}, data = appData) {
    const prefs = ensureContactsPrefs(data);
    Object.assign(prefs, patch || {});
    if (typeof saveData === 'function') saveData(data);
    return prefs;
}

function contactAfterMutation(data = appData) {
    ensureContacts(data);
    if (typeof saveData === 'function') saveData(data);
    if (typeof renderContactsView === 'function') {
        try { renderContactsView(); } catch (_) { /* ignore */ }
    }
}

function saveContactRecord(patch, data = appData) {
    ensureContacts(data);
    const isNew = !patch?.id || !getContactById(patch.id, data);
    const existing = isNew ? null : getContactById(patch.id, data);
    const merged = normalizeContactRecord({
        ...(existing || getDefaultContactRecord()),
        ...(patch || {}),
        id: existing?.id || patch?.id || createContactId(),
        createdAt: existing?.createdAt || ctNowIso(),
        updatedAt: ctNowIso()
    });
    if (!merged.name) throw new Error('Contact name is required.');
    if (isNew) data.contacts.push(merged);
    else {
        const idx = data.contacts.findIndex(c => c.id === merged.id);
        data.contacts[idx] = merged;
    }
    contactAfterMutation(data);
    return merged;
}

function archiveContact(contactId, data = appData) {
    const contact = getContactById(contactId, data);
    if (!contact) return null;
    contact.archived = true;
    contact.active = false;
    contact.updatedAt = ctNowIso();
    contactAfterMutation(data);
    return contact;
}

function restoreContact(contactId, data = appData) {
    const contact = getContactById(contactId, data);
    if (!contact) return null;
    contact.archived = false;
    contact.active = true;
    contact.updatedAt = ctNowIso();
    contactAfterMutation(data);
    return contact;
}

function deleteContactRecord(contactId, data = appData) {
    // Soft-delete via archive: never wipe history links on purchases/logs.
    return archiveContact(contactId, data);
}

function unlinkContactFromRecords(contactId, data = appData) {
    // Keep free-text; clear only ID links.
    (data.purchases || []).forEach(p => {
        if (!p) return;
        if (p.giftSourceContactId === contactId) p.giftSourceContactId = '';
        if (p.giftRecipientContactId === contactId) p.giftRecipientContactId = '';
        if (p.supplierContactId === contactId) p.supplierContactId = '';
        if (p.storeContactId === contactId) p.storeContactId = '';
    });
    (data.logs || []).forEach(log => {
        if (!log) return;
        if (log.giftPartyContactId === contactId) log.giftPartyContactId = '';
        if (log.sharedWithContactId === contactId) log.sharedWithContactId = '';
    });
    (data.goals || []).forEach(goal => {
        if (!goal) return;
        if (goal.accountabilityPartnerContactId === contactId) goal.accountabilityPartnerContactId = '';
        if (goal.sponsorContactId === contactId) goal.sponsorContactId = '';
        if (goal.therapistContactId === contactId) goal.therapistContactId = '';
    });
    (data.taperPlansV2 || []).forEach(plan => {
        if (!plan || !Array.isArray(plan.supportContactIds)) return;
        plan.supportContactIds = plan.supportContactIds.filter(id => id !== contactId);
    });
}

function mergeContacts(sourceId, targetId, data = appData) {
    const source = getContactById(sourceId, data);
    const target = getContactById(targetId, data);
    if (!source || !target || source.id === target.id) return null;

    const roles = normalizeContactRoles([...(target.roles || []), ...(source.roles || [])]);
    const tags = [...new Set([...(target.tags || []), ...(source.tags || [])].map(ctTrim).filter(Boolean))];
    target.roles = roles;
    target.tags = tags;
    if (!target.nickname && source.nickname) target.nickname = source.nickname;
    if (!target.phone && source.phone) target.phone = source.phone;
    if (!target.email && source.email) target.email = source.email;
    if (!target.address && source.address) target.address = source.address;
    if (!target.birthday && source.birthday) target.birthday = source.birthday;
    if (source.notes) target.notes = [target.notes, source.notes].filter(Boolean).join('\n\n');
    target.favorite = target.favorite || source.favorite;
    target.linkedGoalIds = [...new Set([...(target.linkedGoalIds || []), ...(source.linkedGoalIds || [])])];
    target.linkedPlanIds = [...new Set([...(target.linkedPlanIds || []), ...(source.linkedPlanIds || [])])];
    target.updatedAt = ctNowIso();

    const rewrite = (obj, fields) => {
        fields.forEach(field => {
            if (obj[field] === source.id) obj[field] = target.id;
        });
    };
    (data.purchases || []).forEach(p => rewrite(p, ['giftSourceContactId', 'giftRecipientContactId', 'supplierContactId', 'storeContactId']));
    (data.logs || []).forEach(log => rewrite(log, ['giftPartyContactId', 'sharedWithContactId']));
    (data.goals || []).forEach(goal => rewrite(goal, ['accountabilityPartnerContactId', 'sponsorContactId', 'therapistContactId']));
    (data.taperPlansV2 || []).forEach(plan => {
        if (!Array.isArray(plan.supportContactIds)) return;
        plan.supportContactIds = [...new Set(plan.supportContactIds.map(id => id === source.id ? target.id : id))];
    });

    data.contacts = data.contacts.filter(c => c.id !== source.id);
    contactAfterMutation(data);
    return target;
}

function collectFreeTextContactNames(data = appData) {
    const names = new Map();
    const add = (name, context) => {
        const trimmed = ctTrim(name);
        if (!trimmed || trimmed.length < 2) return;
        const key = ctKey(trimmed);
        if (!names.has(key)) names.set(key, { name: trimmed, contexts: new Set(), count: 0 });
        const row = names.get(key);
        row.count += 1;
        row.contexts.add(context);
    };

    (data.purchases || []).forEach(p => {
        if (!p) return;
        add(typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource, 'purchase_gift_source');
        add(typeof getPurchaseGiftRecipient === 'function' ? getPurchaseGiftRecipient(p) : p.giftRecipient, 'purchase_gift_recipient');
        add(p.dealer, 'purchase_dealer');
        add(p.contact, 'purchase_contact');
        add(p.store, 'purchase_store');
    });
    (data.logs || []).forEach(log => {
        if (!log) return;
        add(log.giftPartyName || log.recipientName || log.giverName, 'log_gift');
        add(log.sharedWithName, 'log_shared');
    });
    return [...names.values()].map(row => ({
        name: row.name,
        count: row.count,
        contexts: [...row.contexts]
    })).sort((a, b) => b.count - a.count);
}

function inferRolesFromContexts(contexts = []) {
    const roles = new Set();
    contexts.forEach(ctx => {
        if (ctx.includes('gift_source') || ctx.includes('dealer') || ctx.includes('store')) roles.add('dealer_supplier');
        if (ctx.includes('gift_recipient') || ctx.includes('shared')) roles.add('friend');
        if (ctx.includes('gift')) roles.add('friend');
    });
    if (!roles.size) roles.add('other');
    return [...roles];
}

function migrateContactsFromFreeText(data = appData, options = {}) {
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    ensureContacts(data);
    const names = collectFreeTextContactNames(data);
    let created = 0;
    let linked = 0;

    names.forEach(row => {
        let contact = findContactByName(row.name, data);
        if (!contact) {
            contact = normalizeContactRecord({
                id: createContactId(),
                name: row.name,
                roles: inferRolesFromContexts(row.contexts),
                source: 'migration:free-text',
                createdAt: ctNowIso(),
                updatedAt: ctNowIso()
            });
            data.contacts.push(contact);
            created += 1;
        } else {
            contact.roles = normalizeContactRoles([...(contact.roles || []), ...inferRolesFromContexts(row.contexts)]);
        }
    });

    (data.purchases || []).forEach(p => {
        if (!p) return;
        const sourceName = typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource;
        const recipientName = typeof getPurchaseGiftRecipient === 'function' ? getPurchaseGiftRecipient(p) : p.giftRecipient;
        if (!p.giftSourceContactId && sourceName) {
            const c = findContactByName(sourceName, data);
            if (c) { p.giftSourceContactId = c.id; linked += 1; }
        }
        if (!p.giftRecipientContactId && recipientName) {
            const c = findContactByName(recipientName, data);
            if (c) { p.giftRecipientContactId = c.id; linked += 1; }
        }
        if (!p.supplierContactId) {
            const supplierName = p.dealer || p.contact || sourceName || '';
            const c = findContactByName(supplierName, data);
            if (c && isSupplierContact(c)) { p.supplierContactId = c.id; linked += 1; }
        }
        if (!p.storeContactId && p.store) {
            const c = findContactByName(p.store, data);
            if (c && (contactHasRole(c, 'dispensary') || contactHasRole(c, 'pharmacy') || contactHasRole(c, 'dealer_supplier'))) {
                p.storeContactId = c.id;
                linked += 1;
            }
        }
    });

    (data.logs || []).forEach(log => {
        if (!log) return;
        const giftName = log.giftPartyName || log.recipientName || log.giverName;
        if (!log.giftPartyContactId && giftName) {
            const c = findContactByName(giftName, data);
            if (c) { log.giftPartyContactId = c.id; linked += 1; }
        }
        if (!log.sharedWithContactId && log.sharedWithName) {
            const c = findContactByName(log.sharedWithName, data);
            if (c) { log.sharedWithContactId = c.id; linked += 1; }
        }
    });

    data.migrations.contactsFromFreeTextV1 = true;
    if (options.persist !== false && typeof saveData === 'function') {
        try { saveData(data); } catch (_) { /* avoid TDZ during early load */ }
    }
    return { created, linked, scanned: names.length };
}

function ensureContactsMigrated(data = appData) {
    ensureContacts(data);
    ensureContactsPrefs(data);
    if (!data.migrations) data.migrations = {};
    if (!data.migrations.contactsFromFreeTextV1) {
        // Persist via later saveData/load path — never save during ensureAppDataSettings.
        migrateContactsFromFreeText(data, { persist: false });
    }
    return data.contacts;
}

function contactInteractionDate(record) {
    return ctTrim(record?.date || record?.giftDate || '');
}

function buildContactRecoveryMetrics(contactId, data = appData) {
    const contact = getContactById(contactId, data);
    if (!contact) return null;
    const nameKey = ctKey(contact.name);
    const nickKey = ctKey(contact.nickname);

    const matchesName = (value) => {
        const key = ctKey(value);
        return !!key && (key === nameKey || (nickKey && key === nickKey));
    };
    const matchesPurchase = (p) => {
        if (!p) return false;
        if (p.giftSourceContactId === contactId || p.giftRecipientContactId === contactId
            || p.supplierContactId === contactId || p.storeContactId === contactId) return true;
        const source = typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource;
        const recipient = typeof getPurchaseGiftRecipient === 'function' ? getPurchaseGiftRecipient(p) : p.giftRecipient;
        return matchesName(source) || matchesName(recipient) || matchesName(p.dealer) || matchesName(p.contact) || matchesName(p.store);
    };
    const matchesLog = (log) => {
        if (!log) return false;
        if (log.giftPartyContactId === contactId || log.sharedWithContactId === contactId) return true;
        return matchesName(log.giftPartyName) || matchesName(log.recipientName)
            || matchesName(log.giverName) || matchesName(log.sharedWithName);
    };

    const purchases = (data.purchases || []).filter(matchesPurchase);
    const logs = (data.logs || []).filter(matchesLog);
    let giftsReceived = 0;
    let giftsGiven = 0;
    let sharedSessions = 0;
    let moneySpent = 0;
    let moneyReceived = 0;
    const spendAmounts = [];

    purchases.forEach(p => {
        const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType;
        const spend = typeof getPurchaseSpendAmount === 'function' ? ctToNumber(getPurchaseSpendAmount(p), 0) : ctToNumber(p.totalCost, 0);
        const isSource = p.giftSourceContactId === contactId || matchesName(typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource);
        const isRecipient = p.giftRecipientContactId === contactId || matchesName(typeof getPurchaseGiftRecipient === 'function' ? getPurchaseGiftRecipient(p) : p.giftRecipient);
        const isSupplier = p.supplierContactId === contactId || matchesName(p.dealer) || matchesName(p.contact) || matchesName(p.store);
        if (acq === 'gift_received' && isSource) {
            giftsReceived += 1;
            moneyReceived += spend;
        }
        if ((acq === 'purchased_as_gift' || acq === 'purchased') && (isRecipient || isSupplier || isSource)) {
            if (acq === 'purchased_as_gift' && isRecipient) {
                // purchased for them — still your spend
            }
            if (isSupplier || isSource || (acq === 'purchased' && isSupplier)) {
                moneySpent += spend;
                spendAmounts.push(spend);
            }
        }
        if (acq === 'purchased' && (isSupplier || matchesName(p.store))) {
            if (!spendAmounts.includes(spend)) {
                // already counted above in many cases
            }
        }
    });

    // Simpler spend: any purchase linked as supplier/source/store with spend rules
    moneySpent = 0;
    spendAmounts.length = 0;
    purchases.forEach(p => {
        const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType;
        const spend = typeof getPurchaseSpendAmount === 'function'
            ? ctToNumber(getPurchaseSpendAmount(p), 0)
            : ctToNumber(p.totalCost, 0);
        const counts = acq === 'purchased' || acq === 'purchased_as_gift';
        const isSupplierLink = p.supplierContactId === contactId || p.storeContactId === contactId
            || p.giftSourceContactId === contactId
            || matchesName(p.store) || matchesName(p.dealer) || matchesName(p.contact)
            || matchesName(typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource);
        if (counts && isSupplierLink && spend > 0) {
            moneySpent += spend;
            spendAmounts.push(spend);
        }
        if (acq === 'gift_received' && (p.giftSourceContactId === contactId
            || matchesName(typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource))) {
            giftsReceived += 1;
            moneyReceived += typeof getPurchaseQuantityBought === 'function'
                ? ctToNumber(getPurchaseQuantityBought(p), 0)
                : ctToNumber(p.quantityBought ?? p.quantity, 0);
        }
        if (acq === 'purchased_as_gift' && (p.giftRecipientContactId === contactId
            || matchesName(typeof getPurchaseGiftRecipient === 'function' ? getPurchaseGiftRecipient(p) : p.giftRecipient))) {
            giftsGiven += 1;
        }
    });

    logs.forEach(log => {
        const type = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : log.transactionType;
        if (type === 'gift_given' || type === 'gift') giftsGiven += 1;
        if (type === 'gift_received') giftsReceived += 1;
        if (type === 'shared_use' || type === 'session' || log.entryType === 'session') sharedSessions += 1;
    });

    const dates = [
        ...purchases.map(contactInteractionDate),
        ...logs.map(contactInteractionDate)
    ].filter(Boolean).sort();

    return {
        contactId,
        purchasesFromContact: purchases.length,
        giftsReceived,
        giftsGiven,
        sharedSessions,
        sharedPurchases: purchases.filter(p => {
            const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType;
            return acq === 'purchased_as_gift';
        }).length,
        moneySpent: ctRound(moneySpent, 2),
        moneyReceived: ctRound(moneyReceived, 3),
        averagePurchase: spendAmounts.length ? ctRound(spendAmounts.reduce((s, n) => s + n, 0) / spendAmounts.length, 2) : null,
        lastInteraction: dates[dates.length - 1] || '',
        firstInteraction: dates[0] || '',
        interactionCount: purchases.length + logs.length
    };
}

function buildContactSupplierProfile(contactId, data = appData) {
    const metrics = buildContactRecoveryMetrics(contactId, data);
    const contact = getContactById(contactId, data);
    if (!contact || !metrics) return null;
    const purchases = (data.purchases || []).filter(p =>
        p && (p.supplierContactId === contactId || p.storeContactId === contactId
            || p.giftSourceContactId === contactId
            || ctKey(p.store) === ctKey(contact.name)
            || ctKey(p.dealer) === ctKey(contact.name))
    );
    const products = {};
    const payments = new Set(contact.supplierProfile?.paymentMethodsAccepted || []);
    const unitPrices = [];
    purchases.forEach(p => {
        const pt = p.weedProductType || p.productType || p.flavor
            || (typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(p.substanceId, data) : p.substanceId)
            || 'item';
        products[pt] = (products[pt] || 0) + 1;
        if (p.paymentMethod) payments.add(p.paymentMethod);
        const qty = typeof getPurchaseQuantityBought === 'function' ? ctToNumber(getPurchaseQuantityBought(p), 0) : ctToNumber(p.quantityBought, 0);
        const spend = typeof getPurchaseSpendAmount === 'function' ? ctToNumber(getPurchaseSpendAmount(p), 0) : ctToNumber(p.totalCost, 0);
        if (qty > 0 && spend > 0) unitPrices.push(spend / qty);
    });
    const dates = purchases.map(p => p.date).filter(Boolean).sort();
    const gaps = [];
    for (let i = 1; i < dates.length; i += 1) {
        const a = typeof parseLocalDate === 'function' ? parseLocalDate(dates[i - 1]) : null;
        const b = typeof parseLocalDate === 'function' ? parseLocalDate(dates[i]) : null;
        if (a && b) gaps.push(Math.round((b - a) / 86400000));
    }
    const avgGap = gaps.length ? gaps.reduce((s, n) => s + n, 0) / gaps.length : null;
    const reliability = contact.supplierProfile?.reliability != null
        ? contact.supplierProfile.reliability
        : ctRound(Math.min(100, 40 + purchases.length * 3 + (avgGap != null && avgGap < 45 ? 20 : 0)), 0);

    return {
        ...metrics,
        reliability,
        typicalResponseTime: contact.supplierProfile?.typicalResponseTime || '',
        averagePrices: unitPrices.length ? ctRound(unitPrices.reduce((s, n) => s + n, 0) / unitPrices.length, 4) : null,
        mostCommonProducts: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        averagePurchaseSize: metrics.averagePurchase,
        lastPurchase: dates[dates.length - 1] || '',
        purchaseFrequencyDays: avgGap != null ? ctRound(avgGap, 1) : null,
        availabilityNotes: contact.supplierProfile?.availabilityNotes || '',
        paymentMethodsAccepted: [...payments]
    };
}

function buildContactSupportProfile(contactId, data = appData) {
    const contact = getContactById(contactId, data);
    if (!contact) return null;
    const support = contact.supportProfile || {};
    const linkedGoals = (contact.linkedGoalIds || [])
        .map(id => (data.goals || []).find(g => g && g.id === id))
        .filter(Boolean);
    return {
        meetings: support.meetings || [],
        checkIns: support.checkIns || [],
        messages: support.messages || [],
        goalsDiscussed: support.goalsDiscussed || linkedGoals.map(g => g.name),
        notes: support.notes || contact.notes || '',
        recoveryMilestones: support.recoveryMilestones || [],
        nextAppointment: support.nextAppointment || '',
        linkedGoals
    };
}

function buildContactTimeline(contactId, data = appData) {
    const contact = getContactById(contactId, data);
    if (!contact) return [];
    const events = [];
    const metricsMatcherName = ctKey(contact.name);

    (data.purchases || []).forEach(p => {
        if (!p) return;
        const linked = p.giftSourceContactId === contactId || p.giftRecipientContactId === contactId
            || p.supplierContactId === contactId || p.storeContactId === contactId
            || ctKey(p.store) === metricsMatcherName
            || ctKey(typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource) === metricsMatcherName
            || ctKey(typeof getPurchaseGiftRecipient === 'function' ? getPurchaseGiftRecipient(p) : p.giftRecipient) === metricsMatcherName;
        if (!linked) return;
        events.push({
            id: `purchase-${p.id}`,
            type: 'purchase',
            date: p.date,
            label: `Purchase · ${typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(p.substanceId, data) : p.substanceId}`,
            recordKind: 'purchase',
            recordId: p.id
        });
    });

    (data.logs || []).forEach(log => {
        if (!log) return;
        const linked = log.giftPartyContactId === contactId || log.sharedWithContactId === contactId
            || ctKey(log.giftPartyName) === metricsMatcherName
            || ctKey(log.sharedWithName) === metricsMatcherName
            || ctKey(log.recipientName) === metricsMatcherName
            || ctKey(log.giverName) === metricsMatcherName;
        if (!linked) return;
        const type = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : (log.transactionType || 'use');
        events.push({
            id: `log-${log.id}`,
            type: type.includes('gift') ? 'gift' : (type.includes('shared') || type === 'session' ? 'shared' : 'use'),
            date: log.date,
            label: type.replace(/_/g, ' '),
            recordKind: 'log',
            recordId: log.id
        });
    });

    const support = contact.supportProfile || {};
    (support.meetings || []).forEach((m, idx) => {
        events.push({
            id: `meeting-${contactId}-${idx}`,
            type: 'appointment',
            date: m.date || m,
            label: m.label || 'Meeting',
            recordKind: 'contact_meeting',
            recordId: contactId
        });
    });
    if (support.nextAppointment) {
        events.push({
            id: `next-appt-${contactId}`,
            type: 'appointment',
            date: support.nextAppointment,
            label: 'Next appointment',
            recordKind: 'contact_appointment',
            recordId: contactId
        });
    }
    if (contact.notes) {
        events.push({
            id: `notes-${contactId}`,
            type: 'note',
            date: (contact.updatedAt || '').slice(0, 10) || ctToday(),
            label: 'Contact notes updated',
            recordKind: 'contact',
            recordId: contactId
        });
    }
    if (contact.birthday) {
        const year = ctToday().slice(0, 4);
        events.push({
            id: `bday-${contactId}-${year}`,
            type: 'milestone',
            date: `${year}-${contact.birthday.slice(5)}`,
            label: 'Birthday',
            recordKind: 'contact_birthday',
            recordId: contactId
        });
    }

    return events
        .filter(e => e.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.label).localeCompare(String(b.label)));
}

function buildContactsDashboard(data = appData) {
    ensureContactsMigrated(data);
    const all = data.contacts || [];
    const visible = all.filter(c => !c.archived && !c.hidden);
    const month = ctToday().slice(0, 7);
    const year = ctToday().slice(0, 4);
    let activeThisMonth = 0;
    visible.forEach(c => {
        const metrics = buildContactRecoveryMetrics(c.id, data);
        if (metrics?.lastInteraction && String(metrics.lastInteraction).startsWith(month)) activeThisMonth += 1;
    });
    return {
        totalContacts: visible.length,
        friends: visible.filter(c => (c.roles || []).some(r => CONTACT_FRIEND_ROLES.includes(r))).length,
        suppliers: visible.filter(isSupplierContact).length,
        sponsors: visible.filter(c => contactHasRole(c, 'sponsor')).length,
        therapists: visible.filter(c => contactHasRole(c, 'therapist')).length,
        activeThisMonth,
        newThisYear: visible.filter(c => String(c.createdAt || '').startsWith(year)).length,
        favorites: visible.filter(c => c.favorite).length
    };
}

function buildContactAnalytics(data = appData) {
    ensureContactsMigrated(data);
    const suppliers = getContacts(data, { supplier: true, includeArchived: false });
    const rows = suppliers.map(c => {
        const metrics = buildContactRecoveryMetrics(c.id, data);
        const supplier = buildContactSupplierProfile(c.id, data);
        return { contact: c, metrics, supplier };
    });
    const bySpend = rows.filter(r => (r.metrics?.moneySpent || 0) > 0).sort((a, b) => b.metrics.moneySpent - a.metrics.moneySpent);
    const byFreq = rows.filter(r => (r.metrics?.interactionCount || 0) > 0).sort((a, b) => b.metrics.interactionCount - a.metrics.interactionCount);
    const byCheap = rows.filter(r => r.supplier?.averagePrices != null).sort((a, b) => a.supplier.averagePrices - b.supplier.averagePrices);
    const byLongest = rows.filter(r => r.metrics?.firstInteraction).sort((a, b) => String(a.metrics.firstInteraction).localeCompare(String(b.metrics.firstInteraction)));
    const allContacts = getContacts(data, { includeArchived: false });
    const giftRows = allContacts.map(c => ({ contact: c, metrics: buildContactRecoveryMetrics(c.id, data) }));
    const byGifts = giftRows.sort((a, b) => ((b.metrics?.giftsGiven || 0) + (b.metrics?.giftsReceived || 0)) - ((a.metrics?.giftsGiven || 0) + (a.metrics?.giftsReceived || 0)));
    const byShared = giftRows.sort((a, b) => (b.metrics?.sharedSessions || 0) - (a.metrics?.sharedSessions || 0));

    return {
        mostFrequentSupplier: byFreq[0]?.contact || null,
        highestSpendingSupplier: bySpend[0]?.contact || null,
        cheapestSupplier: byCheap[0]?.contact || null,
        longestSupplierRelationship: byLongest[0]?.contact || null,
        mostSharedSessions: byShared[0]?.contact || null,
        mostGiftsExchanged: byGifts[0]?.contact || null,
        mostInteractions: giftRows.sort((a, b) => (b.metrics?.interactionCount || 0) - (a.metrics?.interactionCount || 0))[0]?.contact || null,
        rows
    };
}

function buildContactSuggestions(data = appData) {
    ensureContacts(data);
    const suggestions = [];
    const freeText = collectFreeTextContactNames(data).filter(row => !findContactByName(row.name, data));
    freeText.slice(0, 12).forEach(row => {
        suggestions.push({
            type: 'convert_free_text',
            severity: 'info',
            message: `Convert “${row.name}” (${row.count} uses) into a contact.`,
            name: row.name,
            count: row.count
        });
    });

    const nameMap = new Map();
    (data.contacts || []).filter(c => !c.archived).forEach(c => {
        const key = ctKey(c.name);
        if (!nameMap.has(key)) nameMap.set(key, []);
        nameMap.get(key).push(c);
    });
    nameMap.forEach(list => {
        if (list.length > 1) {
            suggestions.push({
                type: 'duplicate_contacts',
                severity: 'warn',
                message: `Possible duplicates: ${list.map(c => c.name).join(', ')}`,
                contactIds: list.map(c => c.id)
            });
        }
    });

    (data.purchases || []).forEach(p => {
        if (!p) return;
        const source = typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(p) : p.giftSource;
        if (source && !p.giftSourceContactId && !p.supplierContactId) {
            suggestions.push({
                type: 'missing_supplier_link',
                severity: 'info',
                message: `Purchase on ${p.date} has free-text “${source}” without a contact link.`,
                purchaseId: p.id,
                name: source
            });
        }
    });

    const suppliers = getContacts(data, { supplier: true });
    suppliers.forEach(c => {
        const metrics = buildContactRecoveryMetrics(c.id, data);
        if (metrics?.lastInteraction) {
            const last = typeof parseLocalDate === 'function' ? parseLocalDate(metrics.lastInteraction) : null;
            const today = typeof parseLocalDate === 'function' ? parseLocalDate(ctToday()) : null;
            if (last && today && ((today - last) / 86400000) > 90) {
                suggestions.push({
                    type: 'inactive_supplier',
                    severity: 'info',
                    message: `Supplier “${c.name}” has no interactions in 90+ days.`,
                    contactId: c.id
                });
            }
        }
    });

    const hasAccountability = (data.contacts || []).some(c => !c.archived && contactHasRole(c, 'accountability_partner'));
    if (!hasAccountability) {
        suggestions.push({
            type: 'missing_accountability_partner',
            severity: 'info',
            message: 'No accountability partner contact yet.'
        });
    }

    return suggestions.slice(0, 40);
}

function detectDuplicateContacts(data = appData) {
    ensureContacts(data);
    const groups = [];
    const seen = new Set();
    (data.contacts || []).forEach(c => {
        if (!c || seen.has(c.id)) return;
        const matches = (data.contacts || []).filter(other =>
            other && other.id !== c.id && ctKey(other.name) === ctKey(c.name)
        );
        if (matches.length) {
            const group = [c, ...matches];
            group.forEach(x => seen.add(x.id));
            groups.push(group);
        }
    });
    return groups;
}

function mapContactsToCalendarEvents(bounds = null, data = appData) {
    ensureContacts(data);
    const start = bounds?.startDate || '';
    const end = bounds?.endDate || '';
    const events = [];
    (data.contacts || []).forEach(contact => {
        if (!contact || contact.archived || contact.hidden) return;
        if (contact.birthday) {
            const md = contact.birthday.length >= 10 ? contact.birthday.slice(5, 10) : contact.birthday;
            const year = (start || ctToday()).slice(0, 4);
            const date = `${year}-${md}`;
            if ((!start || date >= start) && (!end || date <= end)) {
                events.push({
                    id: `contact-bday-${contact.id}-${year}`,
                    date,
                    type: 'contact_birthday',
                    label: `${contact.name} · Birthday`,
                    recordKind: 'contact',
                    recordId: contact.id,
                    linkedContactId: contact.id,
                    contact: contact.name,
                    searchable: `${contact.name} birthday`
                });
            }
        }
        const next = contact.supportProfile?.nextAppointment;
        if (next && (!start || next >= start) && (!end || next <= end)) {
            events.push({
                id: `contact-appt-${contact.id}-${next}`,
                date: next,
                type: 'contact_appointment',
                label: `${contact.name} · Appointment`,
                recordKind: 'contact',
                recordId: contact.id,
                linkedContactId: contact.id,
                contact: contact.name,
                searchable: `${contact.name} appointment`
            });
        }
        (contact.supportProfile?.meetings || []).forEach((m, idx) => {
            const date = typeof m === 'string' ? m : m?.date;
            if (!date) return;
            if (start && date < start) return;
            if (end && date > end) return;
            events.push({
                id: `contact-meet-${contact.id}-${idx}-${date}`,
                date,
                type: 'contact_meeting',
                label: `${contact.name} · ${m.label || 'Meeting'}`,
                recordKind: 'contact',
                recordId: contact.id,
                linkedContactId: contact.id,
                contact: contact.name,
                searchable: `${contact.name} meeting`
            });
        });
    });
    return events;
}

function buildContactsCsvRows(data = appData) {
    ensureContacts(data);
    const rows = [['id', 'name', 'nickname', 'roles', 'tags', 'phone', 'email', 'favorite', 'active', 'archived', 'hidden', 'birthday', 'notes']];
    (data.contacts || []).forEach(c => {
        if (c.excludeFromExport) return;
        rows.push([
            c.id,
            c.name,
            c.nickname,
            (c.roles || []).join('|'),
            (c.tags || []).join('|'),
            c.phone,
            c.email,
            c.favorite ? '1' : '0',
            c.active ? '1' : '0',
            c.archived ? '1' : '0',
            c.hidden ? '1' : '0',
            c.birthday,
            c.localNotesOnly ? '' : (c.notes || '').replace(/\n/g, ' ')
        ]);
    });
    return rows;
}

function exportContactsCsv(data = appData) {
    const rows = buildContactsCsvRows(data);
    const csv = rows.map(r => r.map(cell => {
        const s = String(cell ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    if (typeof downloadTextFile === 'function') {
        downloadTextFile(`contacts-${ctToday()}.csv`, csv, 'text/csv');
    }
    return csv;
}

function exportContactAnalyticsCsv(data = appData) {
    const analytics = buildContactAnalytics(data);
    const rows = [['metric', 'contactId', 'contactName']];
    const push = (metric, contact) => {
        if (!contact) return;
        rows.push([metric, contact.id, contact.name]);
    };
    push('most_frequent_supplier', analytics.mostFrequentSupplier);
    push('highest_spending_supplier', analytics.highestSpendingSupplier);
    push('cheapest_supplier', analytics.cheapestSupplier);
    push('longest_supplier_relationship', analytics.longestSupplierRelationship);
    push('most_shared_sessions', analytics.mostSharedSessions);
    push('most_gifts_exchanged', analytics.mostGiftsExchanged);
    push('most_interactions', analytics.mostInteractions);
    const csv = rows.map(r => r.join(',')).join('\n');
    if (typeof downloadTextFile === 'function') {
        downloadTextFile(`contact-analytics-${ctToday()}.csv`, csv, 'text/csv');
    }
    return csv;
}

function contactRoleChipsHtml(contact) {
    return (contact.roles || []).map(role =>
        `<span class="ct-role-chip">${escapeHtml(CONTACT_ROLE_LABELS[role] || role)}</span>`
    ).join('') || '<span class="settings-hint">No roles</span>';
}

function renderContactsDashboardHtml(data = appData) {
    const dash = buildContactsDashboard(data);
    const suggestions = buildContactSuggestions(data).slice(0, 5);
    return `
        <div class="ct-dashboard">
            <div class="ct-summary-grid">
                <article class="ct-card"><span>Total contacts</span><strong>${dash.totalContacts}</strong></article>
                <article class="ct-card"><span>Friends</span><strong>${dash.friends}</strong></article>
                <article class="ct-card"><span>Suppliers</span><strong>${dash.suppliers}</strong></article>
                <article class="ct-card"><span>Sponsors</span><strong>${dash.sponsors}</strong></article>
                <article class="ct-card"><span>Therapists</span><strong>${dash.therapists}</strong></article>
                <article class="ct-card"><span>Active this month</span><strong>${dash.activeThisMonth}</strong></article>
                <article class="ct-card"><span>New this year</span><strong>${dash.newThisYear}</strong></article>
                <article class="ct-card"><span>Favorites</span><strong>${dash.favorites}</strong></article>
            </div>
            <div class="ct-actions">
                <button type="button" class="btn-primary" onclick="openContactCreateForm()">Add contact</button>
                <button type="button" class="secondary-btn" onclick="setContactsView('list')">All contacts</button>
                <button type="button" class="secondary-btn" onclick="setContactsView('analytics')">Analytics</button>
                <button type="button" class="secondary-btn" onclick="setContactsView('suggestions')">Suggestions</button>
                <button type="button" class="secondary-btn" onclick="exportContactsCsv()">Export CSV</button>
            </div>
            <section class="ct-panel">
                <h3>Smart suggestions</h3>
                ${suggestions.length
                    ? `<ul class="ct-suggestion-list">${suggestions.map(s => `<li class="ct-suggestion ct-${escapeHtml(s.severity)}">${escapeHtml(s.message)}${s.name ? ` <button type="button" class="btn-small" onclick="convertFreeTextNameToContact('${escapeHtml(s.name)}')">Convert</button>` : ''}${s.contactIds?.length === 2 ? ` <button type="button" class="btn-small" onclick="mergeContacts('${escapeHtml(s.contactIds[0])}','${escapeHtml(s.contactIds[1])}'); renderContactsView();">Merge</button>` : ''}</li>`).join('')}</ul>`
                    : '<p class="settings-hint">No suggestions right now.</p>'}
            </section>
        </div>`;
}

function renderContactsListHtml(data = appData) {
    const prefs = ensureContactsPrefs(data);
    const filter = contactsUiState.filter || prefs.listFilter || 'all';
    const options = {
        search: contactsUiState.search,
        includeArchived: filter === 'archived' || prefs.showArchived,
        includeHidden: prefs.showHidden,
        favorites: filter === 'favorites',
        supplier: filter === 'supplier',
        friend: filter === 'friend',
        support: filter === 'support'
    };
    if (filter === 'active') options.onlyActive = true;
    if (filter === 'archived') {
        // show archived only
    }
    let list = getContacts(data, options);
    if (filter === 'archived') list = (data.contacts || []).filter(c => c.archived);

    return `
        <div class="ct-list-view">
            <div class="ct-toolbar">
                <input type="search" id="ct-search" class="ct-search" placeholder="Search name, role, tags, notes…" value="${escapeHtml(contactsUiState.search || '')}" oninput="onContactsSearchInput(this.value)">
                <select id="ct-filter" onchange="onContactsFilterChange(this.value)">
                    <option value="all"${filter === 'all' ? ' selected' : ''}>All</option>
                    <option value="favorites"${filter === 'favorites' ? ' selected' : ''}>Favorites</option>
                    <option value="active"${filter === 'active' ? ' selected' : ''}>Active</option>
                    <option value="supplier"${filter === 'supplier' ? ' selected' : ''}>Suppliers</option>
                    <option value="friend"${filter === 'friend' ? ' selected' : ''}>Friends</option>
                    <option value="support"${filter === 'support' ? ' selected' : ''}>Recovery support</option>
                    <option value="archived"${filter === 'archived' ? ' selected' : ''}>Archived</option>
                </select>
                <button type="button" class="btn-primary" onclick="openContactCreateForm()">Add</button>
            </div>
            ${list.length ? `<div class="ct-card-list">${list.map(c => {
                const metrics = buildContactRecoveryMetrics(c.id, data);
                return `<button type="button" class="ct-contact-card" onclick="openContactDetail('${escapeHtml(c.id)}')">
                    <div class="ct-contact-card-head">
                        <strong>${escapeHtml(c.name)}${c.favorite ? ' ★' : ''}</strong>
                        <span class="ct-status">${c.archived ? 'Archived' : (c.active ? 'Active' : 'Inactive')}</span>
                    </div>
                    <div class="ct-role-row">${contactRoleChipsHtml(c)}</div>
                    <p class="settings-hint">${metrics?.interactionCount || 0} interactions · Last ${escapeHtml(metrics?.lastInteraction || '—')}</p>
                </button>`;
            }).join('')}</div>` : '<div class="ct-empty"><p>No contacts match these filters.</p><button type="button" class="btn-primary" onclick="openContactCreateForm()">Add contact</button></div>'}
        </div>`;
}

function renderContactDetailHtml(contactId, data = appData) {
    const contact = getContactById(contactId, data);
    if (!contact) return '<div class="ct-error">Contact not found.</div>';
    const metrics = buildContactRecoveryMetrics(contactId, data);
    const supplier = isSupplierContact(contact) ? buildContactSupplierProfile(contactId, data) : null;
    const support = isSupportContact(contact) ? buildContactSupportProfile(contactId, data) : null;
    const timeline = buildContactTimeline(contactId, data).slice(0, 30);
    const duplicates = detectDuplicateContacts(data).find(g => g.some(c => c.id === contactId));

    return `
        <div class="ct-detail">
            <header class="ct-detail-head">
                <div>
                    <h3>${escapeHtml(contact.name)}${contact.nickname ? ` <span class="settings-hint">(${escapeHtml(contact.nickname)})</span>` : ''}</h3>
                    <div class="ct-role-row">${contactRoleChipsHtml(contact)}</div>
                </div>
                <div class="ct-detail-actions">
                    <button type="button" class="btn-small" onclick="openContactEditForm('${escapeHtml(contact.id)}')">Edit</button>
                    <button type="button" class="btn-small" onclick="setContactsView('timeline'); contactsUiState.detailId='${escapeHtml(contact.id)}'; renderContactsView();">Timeline</button>
                    ${contact.archived
                        ? `<button type="button" class="btn-small" onclick="restoreContact('${escapeHtml(contact.id)}')">Restore</button>`
                        : `<button type="button" class="btn-small" onclick="archiveContact('${escapeHtml(contact.id)}')">Archive</button>`}
                    <button type="button" class="btn-small" onclick="closeContactDetail()">Close</button>
                </div>
            </header>
            <div class="ct-summary-grid">
                <article class="ct-card"><span>Purchases</span><strong>${metrics?.purchasesFromContact ?? 0}</strong></article>
                <article class="ct-card"><span>Money spent</span><strong>${ctMoney(metrics?.moneySpent)}</strong></article>
                <article class="ct-card"><span>Gifts given</span><strong>${metrics?.giftsGiven ?? 0}</strong></article>
                <article class="ct-card"><span>Gifts received</span><strong>${metrics?.giftsReceived ?? 0}</strong></article>
                <article class="ct-card"><span>Shared sessions</span><strong>${metrics?.sharedSessions ?? 0}</strong></article>
                <article class="ct-card"><span>Interactions</span><strong>${metrics?.interactionCount ?? 0}</strong></article>
                <article class="ct-card"><span>First</span><strong class="ct-text">${escapeHtml(metrics?.firstInteraction || '—')}</strong></article>
                <article class="ct-card"><span>Last</span><strong class="ct-text">${escapeHtml(metrics?.lastInteraction || '—')}</strong></article>
            </div>
            ${supplier ? `<section class="ct-panel"><h4>Supplier profile</h4>
                <p>Reliability: <strong>${supplier.reliability ?? '—'}</strong> · Avg price: <strong>${supplier.averagePrices == null ? '—' : ctMoney(supplier.averagePrices)}</strong> · Frequency: <strong>${supplier.purchaseFrequencyDays ?? '—'} days</strong></p>
                <p class="settings-hint">Products: ${escapeHtml((supplier.mostCommonProducts || []).map(p => p.name).join(', ') || '—')}</p>
                <p class="settings-hint">${escapeHtml(supplier.availabilityNotes || 'No availability notes.')}</p>
            </section>` : ''}
            ${support ? `<section class="ct-panel"><h4>Recovery support</h4>
                <p>Next appointment: <strong>${escapeHtml(support.nextAppointment || '—')}</strong></p>
                <p class="settings-hint">Goals: ${escapeHtml((support.goalsDiscussed || []).join(', ') || '—')}</p>
                <p class="settings-hint">${escapeHtml(support.notes || '')}</p>
            </section>` : ''}
            <section class="ct-panel">
                <h4>Profile</h4>
                <p>${escapeHtml(contact.phone || 'No phone')} · ${escapeHtml(contact.email || 'No email')}</p>
                <p class="settings-hint">${escapeHtml(contact.address || '')}</p>
                <p class="settings-hint">${escapeHtml(contact.localNotesOnly ? '(Local notes hidden from export)' : (contact.notes || 'No notes'))}</p>
            </section>
            <section class="ct-panel">
                <h4>Recent timeline</h4>
                ${timeline.length
                    ? `<ul class="ct-timeline">${timeline.map(e => `<li><strong>${escapeHtml(e.date)}</strong> · ${escapeHtml(e.label)}</li>`).join('')}</ul>`
                    : '<p class="settings-hint">No linked interactions yet.</p>'}
            </section>
            ${duplicates ? `<section class="ct-panel"><h4>Duplicate detected</h4>
                <p class="settings-hint">Merge preserves the target ID and rewrites links.</p>
                <select id="ct-merge-target">${duplicates.filter(c => c.id !== contact.id).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.id)})</option>`).join('')}</select>
                <button type="button" class="secondary-btn btn-sm" onclick="mergeContacts('${escapeHtml(contact.id)}', document.getElementById('ct-merge-target').value); openContactDetail(document.getElementById('ct-merge-target').value);">Merge into selected</button>
            </section>` : ''}
        </div>`;
}

function renderContactFormHtml(data = appData) {
    const draft = contactsUiState.formDraft || normalizeContactRecord({ id: createContactId() });
    const roleChecks = CONTACT_ROLES.map(role => `
        <label class="ct-role-check"><input type="checkbox" name="ct-role" value="${role}"${draft.roles.includes(role) ? ' checked' : ''}> ${escapeHtml(CONTACT_ROLE_LABELS[role])}</label>
    `).join('');
    return `
        <form class="ct-form" onsubmit="submitContactForm(event)">
            <h3>${getContactById(draft.id, data) ? 'Edit contact' : 'New contact'}</h3>
            <div class="ct-form-grid">
                <label>Name<input id="ct-form-name" required value="${escapeHtml(draft.name)}"></label>
                <label>Nickname<input id="ct-form-nickname" value="${escapeHtml(draft.nickname)}"></label>
                <label>Phone<input id="ct-form-phone" value="${escapeHtml(draft.phone)}"></label>
                <label>Email<input id="ct-form-email" value="${escapeHtml(draft.email)}"></label>
                <label>Birthday<input type="date" id="ct-form-birthday" value="${escapeHtml(draft.birthday)}"></label>
                <label>Color<label><input id="ct-form-color" value="${escapeHtml(draft.colorLabel)}" placeholder="e.g. teal"></label>
                <label class="ct-span-2">Address<input id="ct-form-address" value="${escapeHtml(draft.address)}"></label>
                <label class="ct-span-2">Tags<input id="ct-form-tags" value="${escapeHtml((draft.tags || []).join(', '))}" placeholder="comma separated"></label>
                <label class="ct-span-2">Notes<textarea id="ct-form-notes" rows="3">${escapeHtml(draft.notes)}</textarea></label>
                <label class="ct-span-2">Availability / supplier notes<input id="ct-form-availability" value="${escapeHtml(draft.supplierProfile?.availabilityNotes || '')}"></label>
                <label>Next appointment<input type="date" id="ct-form-next-appt" value="${escapeHtml(draft.supportProfile?.nextAppointment || '')}"></label>
                <label>Typical response time<input id="ct-form-response" value="${escapeHtml(draft.supplierProfile?.typicalResponseTime || '')}"></label>
            </div>
            <fieldset class="ct-roles-fieldset"><legend>Roles</legend><div class="ct-roles-grid">${roleChecks}</div></fieldset>
            <div class="ct-form-toggles">
                <label><input type="checkbox" id="ct-form-favorite"${draft.favorite ? ' checked' : ''}> Favorite</label>
                <label><input type="checkbox" id="ct-form-active"${draft.active !== false ? ' checked' : ''}> Active</label>
                <label><input type="checkbox" id="ct-form-hidden"${draft.hidden ? ' checked' : ''}> Hidden</label>
                <label><input type="checkbox" id="ct-form-exclude-export"${draft.excludeFromExport ? ' checked' : ''}> Exclude from export</label>
                <label><input type="checkbox" id="ct-form-local-notes"${draft.localNotesOnly ? ' checked' : ''}> Local-only notes</label>
            </div>
            <div class="ct-actions">
                <button type="submit" class="btn-primary">Save contact</button>
                <button type="button" class="secondary-btn" onclick="closeContactForm()">Cancel</button>
            </div>
            <input type="hidden" id="ct-form-id" value="${escapeHtml(draft.id)}">
        </form>`;
}

function renderContactsAnalyticsHtml(data = appData) {
    const analytics = buildContactAnalytics(data);
    const label = c => c ? escapeHtml(c.name) : '—';
    return `
        <div class="ct-analytics">
            <div class="ct-actions">
                <button type="button" class="secondary-btn" onclick="exportContactAnalyticsCsv()">Export analytics CSV</button>
                <button type="button" class="secondary-btn" onclick="setContactsView('dashboard')">Back</button>
            </div>
            <div class="ct-summary-grid">
                <article class="ct-card"><span>Most frequent supplier</span><strong class="ct-text">${label(analytics.mostFrequentSupplier)}</strong></article>
                <article class="ct-card"><span>Highest spending supplier</span><strong class="ct-text">${label(analytics.highestSpendingSupplier)}</strong></article>
                <article class="ct-card"><span>Cheapest supplier</span><strong class="ct-text">${label(analytics.cheapestSupplier)}</strong></article>
                <article class="ct-card"><span>Longest supplier relationship</span><strong class="ct-text">${label(analytics.longestSupplierRelationship)}</strong></article>
                <article class="ct-card"><span>Most shared sessions</span><strong class="ct-text">${label(analytics.mostSharedSessions)}</strong></article>
                <article class="ct-card"><span>Most gifts exchanged</span><strong class="ct-text">${label(analytics.mostGiftsExchanged)}</strong></article>
                <article class="ct-card"><span>Most interactions</span><strong class="ct-text">${label(analytics.mostInteractions)}</strong></article>
            </div>
        </div>`;
}

function renderContactsSuggestionsHtml(data = appData) {
    const suggestions = buildContactSuggestions(data);
    return `
        <div class="ct-suggestions-view">
            <div class="ct-actions">
                <button type="button" class="secondary-btn" onclick="runContactsMigration()">Run free-text migration</button>
                <button type="button" class="secondary-btn" onclick="setContactsView('dashboard')">Back</button>
            </div>
            ${suggestions.length
                ? `<ul class="ct-suggestion-list">${suggestions.map(s => `<li class="ct-suggestion ct-${escapeHtml(s.severity)}">${escapeHtml(s.message)}${s.name ? ` <button type="button" class="btn-small" onclick="convertFreeTextNameToContact('${escapeHtml(s.name)}')">Convert</button>` : ''}</li>`).join('')}</ul>`
                : '<p class="ct-empty">No suggestions.</p>'}
        </div>`;
}

function renderContactTimelineHtml(contactId, data = appData) {
    const timeline = buildContactTimeline(contactId, data);
    const contact = getContactById(contactId, data);
    return `
        <div class="ct-timeline-view">
            <div class="ct-actions">
                <button type="button" class="secondary-btn" onclick="openContactDetail('${escapeHtml(contactId)}')">Back to profile</button>
            </div>
            <h3>${escapeHtml(contact?.name || 'Contact')} timeline</h3>
            ${timeline.length
                ? `<ul class="ct-timeline">${timeline.map(e => `<li><strong>${escapeHtml(e.date)}</strong> · ${escapeHtml(e.type)} · ${escapeHtml(e.label)}</li>`).join('')}</ul>`
                : '<p class="ct-empty">No timeline events.</p>'}
        </div>`;
}

function renderContactsView() {
    const root = typeof document !== 'undefined' ? document.getElementById('contacts-root') : null;
    if (!root) return;
    root.innerHTML = '<div class="ct-loading" role="status">Loading contacts…</div>';
    try {
        ensureContactsMigrated(appData);
        const prefs = ensureContactsPrefs(appData);
        const view = contactsUiState.view || prefs.lastView || 'dashboard';
        let body = '';
        if (contactsUiState.formDraft) body = renderContactFormHtml(appData);
        else if (view === 'detail' && contactsUiState.detailId) body = renderContactDetailHtml(contactsUiState.detailId, appData);
        else if (view === 'list') body = renderContactsListHtml(appData);
        else if (view === 'analytics') body = renderContactsAnalyticsHtml(appData);
        else if (view === 'suggestions') body = renderContactsSuggestionsHtml(appData);
        else if (view === 'timeline' && contactsUiState.detailId) body = renderContactTimelineHtml(contactsUiState.detailId, appData);
        else body = renderContactsDashboardHtml(appData);

        root.innerHTML = `
            <div class="ct-page">
                <header class="ct-page-head">
                    <div>
                        <h2>Manage Contacts</h2>
                        <p class="settings-hint">Shared across Log, Inventory, Goals &amp; Plans, Insights, and Home. Free-text history stays intact.</p>
                    </div>
                    <nav class="ct-subnav" aria-label="Contacts sections">
                        <button type="button" class="ct-subnav-btn${view === 'dashboard' ? ' active' : ''}" onclick="setContactsView('dashboard')">Dashboard</button>
                        <button type="button" class="ct-subnav-btn${view === 'list' ? ' active' : ''}" onclick="setContactsView('list')">Contacts</button>
                        <button type="button" class="ct-subnav-btn${view === 'analytics' ? ' active' : ''}" onclick="setContactsView('analytics')">Analytics</button>
                        <button type="button" class="ct-subnav-btn${view === 'suggestions' ? ' active' : ''}" onclick="setContactsView('suggestions')">Suggestions</button>
                    </nav>
                </header>
                ${contactsUiState.error ? `<div class="ct-error" role="alert">${escapeHtml(contactsUiState.error)}</div>` : ''}
                ${body}
            </div>`;
    } catch (err) {
        console.error('[contacts] render failed', err);
        root.innerHTML = `<div class="ct-error" role="alert"><p>Could not load contacts.</p><p class="settings-hint">${escapeHtml(err?.message || String(err))}</p><button type="button" class="secondary-btn btn-sm" onclick="renderContactsView()">Retry</button></div>`;
    }
}

function setContactsView(view) {
    contactsUiState.view = view || 'dashboard';
    contactsUiState.formDraft = null;
    if (view !== 'detail' && view !== 'timeline') contactsUiState.detailId = '';
    persistContactsPrefs({ lastView: contactsUiState.view, listFilter: contactsUiState.filter });
    renderContactsView();
}

function openContactCreateForm() {
    contactsUiState.formDraft = normalizeContactRecord({
        id: createContactId(),
        roles: ['friend'],
        active: true
    });
    contactsUiState.view = 'form';
    renderContactsView();
}

function openContactEditForm(contactId) {
    const contact = getContactById(contactId);
    if (!contact) return;
    contactsUiState.formDraft = normalizeContactRecord(JSON.parse(JSON.stringify(contact)));
    contactsUiState.view = 'form';
    renderContactsView();
}

function closeContactForm() {
    contactsUiState.formDraft = null;
    contactsUiState.view = contactsUiState.detailId ? 'detail' : 'list';
    renderContactsView();
}

function openContactDetail(contactId) {
    if (typeof openContactDetailPanel === 'function' && typeof document !== 'undefined'
        && document.getElementById('contact-detail-panel')) {
        openContactDetailPanel(contactId);
        return;
    }
    contactsUiState.detailId = contactId;
    contactsUiState.formDraft = null;
    contactsUiState.view = 'detail';
    renderContactsView();
}

function closeContactDetail() {
    if (typeof closeContactDetailPanel === 'function' && typeof document !== 'undefined') {
        const panel = document.getElementById('contact-detail-panel');
        if (panel && !panel.classList.contains('hidden')) {
            closeContactDetailPanel();
            return;
        }
    }
    contactsUiState.detailId = '';
    contactsUiState.view = 'list';
    renderContactsView();
}

function submitContactForm(event) {
    event?.preventDefault?.();
    try {
        const roles = [...(document.querySelectorAll('input[name="ct-role"]:checked') || [])].map(el => el.value);
        const saved = saveContactRecord({
            id: document.getElementById('ct-form-id')?.value,
            name: document.getElementById('ct-form-name')?.value,
            nickname: document.getElementById('ct-form-nickname')?.value,
            phone: document.getElementById('ct-form-phone')?.value,
            email: document.getElementById('ct-form-email')?.value,
            birthday: document.getElementById('ct-form-birthday')?.value,
            colorLabel: document.getElementById('ct-form-color')?.value,
            address: document.getElementById('ct-form-address')?.value,
            tags: (document.getElementById('ct-form-tags')?.value || '').split(','),
            notes: document.getElementById('ct-form-notes')?.value,
            favorite: !!document.getElementById('ct-form-favorite')?.checked,
            active: !!document.getElementById('ct-form-active')?.checked,
            hidden: !!document.getElementById('ct-form-hidden')?.checked,
            excludeFromExport: !!document.getElementById('ct-form-exclude-export')?.checked,
            localNotesOnly: !!document.getElementById('ct-form-local-notes')?.checked,
            roles,
            supplierProfile: {
                availabilityNotes: document.getElementById('ct-form-availability')?.value || '',
                typicalResponseTime: document.getElementById('ct-form-response')?.value || ''
            },
            supportProfile: {
                nextAppointment: document.getElementById('ct-form-next-appt')?.value || ''
            }
        });
        contactsUiState.formDraft = null;
        openContactDetail(saved.id);
    } catch (err) {
        contactsUiState.error = err?.message || String(err);
        renderContactsView();
    }
}

function onContactsSearchInput(value) {
    contactsUiState.search = value || '';
    contactsUiState.view = 'list';
    renderContactsView();
}

function onContactsFilterChange(value) {
    contactsUiState.filter = value || 'all';
    persistContactsPrefs({ listFilter: contactsUiState.filter });
    contactsUiState.view = 'list';
    renderContactsView();
}

function convertFreeTextNameToContact(name, data = appData) {
    const existing = findContactByName(name, data);
    if (existing) {
        openContactDetail(existing.id);
        return existing;
    }
    const contexts = collectFreeTextContactNames(data).find(r => ctKey(r.name) === ctKey(name))?.contexts || [];
    const contact = saveContactRecord({
        name: ctTrim(name),
        roles: inferRolesFromContexts(contexts),
        source: 'suggestion:convert'
    }, data);
    migrateContactsFromFreeText(data);
    openContactDetail(contact.id);
    return contact;
}

function runContactsMigration() {
    const result = migrateContactsFromFreeText(appData);
    if (typeof showToast === 'function') {
        showToast(`Migration: ${result.created} created, ${result.linked} links.`, 'success');
    }
    setContactsView('list');
}

function getContactOptionsForSelect(data = appData, roleFilter = null) {
    return getContacts(data, { includeArchived: false }).filter(c => {
        if (!roleFilter) return true;
        if (roleFilter === 'supplier') return isSupplierContact(c);
        if (roleFilter === 'support') return isSupportContact(c);
        return (c.roles || []).includes(roleFilter);
    });
}

function contactSelectHtml(selectId, selectedId = '', roleFilter = null, allowEmpty = true) {
    const options = getContactOptionsForSelect(appData, roleFilter);
    return `<select id="${selectId}" class="ct-inline-select">
        ${allowEmpty ? '<option value="">— Free text / none —</option>' : ''}
        ${options.map(c => `<option value="${escapeHtml(c.id)}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
    </select>`;
}

function resolvePurchaseSupplierContact(purchase, data = appData) {
    if (!purchase) return null;
    if (purchase.supplierContactId) return getContactById(purchase.supplierContactId, data);
    if (purchase.giftSourceContactId) return getContactById(purchase.giftSourceContactId, data);
    if (purchase.storeContactId) return getContactById(purchase.storeContactId, data);
    // Free-text only — do not call financialPurchaseSupplier (would recurse).
    const giftSource = typeof getPurchaseGiftSource === 'function' ? getPurchaseGiftSource(purchase) : purchase.giftSource;
    const name = purchase.store || purchase.location || giftSource || purchase.dealer || purchase.contact || '';
    return findContactByName(name, data);
}
