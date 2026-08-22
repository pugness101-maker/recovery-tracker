// ——— Inventory Source (unified Store + Supplier Contact) ———
// One optional Source field for businesses and people. Keeps `store` /
// `supplierContactId` / gift fields in sync for backward-compatible analytics.
// Does not reuse purchase.source (legacy acquisition-type marker).

const INVENTORY_SOURCE_KINDS = Object.freeze([
    'business',
    'individual',
    'dealer',
    'friend',
    'family',
    'online',
    'event',
    'other'
]);

const INVENTORY_SOURCE_KIND_LABELS = Object.freeze({
    business: 'Business/store',
    individual: 'Individual contact',
    dealer: 'Dealer/supplier',
    friend: 'Friend',
    family: 'Family',
    online: 'Online',
    event: 'Event',
    other: 'Other'
});

const INVENTORY_SOURCE_KIND_ICONS = Object.freeze({
    business: '🏪',
    individual: '👤',
    dealer: '👤',
    friend: '👤',
    family: '👤',
    online: '🌐',
    event: '📍',
    other: '•'
});

const BUY_SOURCE_ADD_NEW = '__add_new_source__';

function invSrcTrim(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function invSrcEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
}

function normalizeInventorySourceKind(kind) {
    const raw = String(kind || '').trim().toLowerCase();
    if (INVENTORY_SOURCE_KINDS.includes(raw)) return raw;
    const aliases = {
        store: 'business',
        location: 'business',
        business_store: 'business',
        person: 'individual',
        contact: 'individual',
        supplier: 'dealer',
        dealer_supplier: 'dealer',
        dispensary: 'business',
        pharmacy: 'business',
        website: 'online',
        web: 'online'
    };
    return aliases[raw] || 'other';
}

function inventorySourceKindLabel(kind) {
    return INVENTORY_SOURCE_KIND_LABELS[normalizeInventorySourceKind(kind)] || 'Other';
}

function inventorySourceIcon(kind) {
    return INVENTORY_SOURCE_KIND_ICONS[normalizeInventorySourceKind(kind)] || '•';
}

function inventorySourceIsPersonKind(kind) {
    const k = normalizeInventorySourceKind(kind);
    return k === 'individual' || k === 'dealer' || k === 'friend' || k === 'family';
}

function inventorySourceIsBusinessKind(kind) {
    const k = normalizeInventorySourceKind(kind);
    return k === 'business' || k === 'online' || k === 'event';
}

function inferInventorySourceKindFromContact(contact) {
    if (!contact) return 'individual';
    const roles = contact.roles || [];
    if (typeof contactHasRole === 'function') {
        if (contactHasRole(contact, 'dealer_supplier')) return 'dealer';
        if (contactHasRole(contact, 'friend')) return 'friend';
        if (contactHasRole(contact, 'family')) return 'family';
        if (contactHasRole(contact, 'dispensary') || contactHasRole(contact, 'pharmacy')) return 'business';
    } else {
        if (roles.includes('dealer_supplier')) return 'dealer';
        if (roles.includes('friend')) return 'friend';
        if (roles.includes('family')) return 'family';
        if (roles.includes('dispensary') || roles.includes('pharmacy')) return 'business';
    }
    return 'individual';
}

function getPurchaseSourceName(purchase) {
    if (!purchase) return '';
    // Prefer the unified Source field; fall back to store, then supplier / gift legacy fields.
    const named = invSrcTrim(purchase.sourceName);
    if (named) return named;
    if (purchase.sourceContactId && typeof getContactDisplayName === 'function') {
        const n = invSrcTrim(getContactDisplayName(purchase.sourceContactId));
        if (n) return n;
    }
    const store = invSrcTrim(purchase.store || purchase.location || '');
    if (store) return store;
    if (purchase.supplierContactId && typeof getContactDisplayName === 'function') {
        const n = invSrcTrim(getContactDisplayName(purchase.supplierContactId));
        if (n) return n;
    }
    const gift = typeof getPurchaseGiftSource === 'function' ? invSrcTrim(getPurchaseGiftSource(purchase)) : '';
    if (gift) return gift;
    if (typeof purchaseIsPurchasedAsGift === 'function' && purchaseIsPurchasedAsGift(purchase)) {
        const recip = typeof getPurchaseGiftRecipient === 'function'
            ? invSrcTrim(getPurchaseGiftRecipient(purchase))
            : invSrcTrim(purchase.giftRecipient || '');
        if (recip) return recip;
    }
    return invSrcTrim(purchase.dealer || purchase.contact || '');
}

function getPurchaseSourceKind(purchase) {
    if (!purchase) return 'other';
    if (purchase.sourceKind) return normalizeInventorySourceKind(purchase.sourceKind);
    if (purchase.sourceContactId || purchase.supplierContactId) {
        const id = purchase.sourceContactId || purchase.supplierContactId;
        const contact = typeof getContactById === 'function' ? getContactById(id) : null;
        return inferInventorySourceKindFromContact(contact);
    }
    const store = invSrcTrim(purchase.store || purchase.location || '');
    if (store) {
        const lower = store.toLowerCase();
        if (/online|amazon|ebay|\.com|website|shipped/.test(lower)) return 'online';
        if (/festival|concert|party|event/.test(lower)) return 'event';
        return 'business';
    }
    if (purchase.dealer || purchase.contact) return 'dealer';
    return 'other';
}

function getPurchaseSourceContactId(purchase) {
    if (!purchase) return '';
    if (purchase.sourceContactId != null && String(purchase.sourceContactId).trim() !== '') {
        return String(purchase.sourceContactId).trim();
    }
    // If Source is already a business/store name, do not fall back to a different supplier contact
    if (purchase.sourceName && inventorySourceIsBusinessKind(purchase.sourceKind)) {
        return '';
    }
    return String(purchase.supplierContactId || purchase.storeContactId || '').trim();
}

function formatPurchaseSourceDisplay(purchase) {
    const name = getPurchaseSourceName(purchase);
    if (!name) return '—';
    const kind = getPurchaseSourceKind(purchase);
    return `${inventorySourceIcon(kind)} ${name}`;
}

function getBuySourceFieldLabel(acquisitionType) {
    const type = typeof normalizePurchaseAcquisitionType === 'function'
        ? normalizePurchaseAcquisitionType(acquisitionType)
        : acquisitionType;
    if (type === 'gift_received') return 'Gift From';
    if (type === 'purchased_as_gift') return 'Gift Recipient';
    if (type === 'other_adjustment') return 'Related Person / Source';
    return 'Source';
}

function getBuySourcePlaceholder(acquisitionType) {
    const type = typeof normalizePurchaseAcquisitionType === 'function'
        ? normalizePurchaseAcquisitionType(acquisitionType)
        : acquisitionType;
    if (type === 'gift_received') return 'Who gave this to you?';
    if (type === 'purchased_as_gift') return 'Who is this gift for?';
    if (type === 'other_adjustment') return 'Related person or source (optional)';
    return 'Search stores and contacts (optional)';
}

/**
 * Sync sourceName/sourceKind/sourceContactId onto legacy store / supplier / gift fields.
 * Never writes acquisition-type values into sourceName.
 */
function syncPurchaseSourceFields(purchase, data = appData) {
    if (!purchase || typeof purchase !== 'object') return purchase;
    const name = getPurchaseSourceName(purchase);
    const kind = getPurchaseSourceKind(purchase);
    const contactId = getPurchaseSourceContactId(purchase);

    if (name) purchase.sourceName = name;
    purchase.sourceKind = kind;
    if (contactId) purchase.sourceContactId = contactId;
    else if (purchase.sourceContactId === undefined) purchase.sourceContactId = '';

    const acq = typeof getPurchaseAcquisitionType === 'function'
        ? getPurchaseAcquisitionType(purchase)
        : (purchase.acquisitionType || 'purchased');

    if (acq === 'gift_received') {
        if (name) {
            purchase.giftSource = name;
            purchase.giverName = name;
            purchase.giftPartyName = name;
        }
        if (contactId) purchase.giftSourceContactId = contactId;
        purchase.store = '';
        purchase.supplierContactId = contactId || '';
    } else if (acq === 'purchased_as_gift') {
        if (name) {
            purchase.giftRecipient = name;
            purchase.recipientName = name;
            purchase.giftPartyName = name;
        }
        if (contactId) purchase.giftRecipientContactId = contactId;
        // Source is the gift recipient. Preserve store when it is a separate purchase location.
        if (inventorySourceIsBusinessKind(kind) && name && !purchase.giftRecipient) {
            purchase.store = name;
            purchase.supplierContactId = '';
        } else if (inventorySourceIsPersonKind(kind) || contactId) {
            purchase.supplierContactId = contactId || purchase.supplierContactId || '';
            // do not clear store — may still hold where the gift was purchased
        }
    } else {
        // purchased / other_adjustment
        if (inventorySourceIsPersonKind(kind) || contactId) {
            purchase.supplierContactId = contactId || purchase.supplierContactId || '';
            // Keep store empty when the Source is a person (avoid duplicate store+supplier)
            if (!inventorySourceIsBusinessKind(kind)) purchase.store = '';
            else if (name) purchase.store = name;
        } else if (name) {
            purchase.store = name;
            if (!contactId) purchase.supplierContactId = purchase.supplierContactId || '';
        }
    }
    return purchase;
}

function migratePurchaseSourceFields(purchase, data = appData) {
    if (!purchase || typeof purchase !== 'object') return { changed: false };
    if (purchase.sourceName) {
        syncPurchaseSourceFields(purchase, data);
        return { changed: false };
    }

    const store = invSrcTrim(purchase.store || purchase.location || '');
    const supplierId = String(purchase.supplierContactId || purchase.storeContactId || '').trim();
    const giftSource = invSrcTrim(purchase.giftSource || purchase.giverName || '');
    const giftRecipient = invSrcTrim(purchase.giftRecipient || purchase.recipientName || '');
    const acq = typeof getPurchaseAcquisitionType === 'function'
        ? getPurchaseAcquisitionType(purchase)
        : (purchase.acquisitionType || 'purchased');

    let name = '';
    let kind = 'other';
    let contactId = '';

    if (acq === 'gift_received' && (giftSource || purchase.giftSourceContactId)) {
        name = giftSource;
        contactId = String(purchase.giftSourceContactId || '').trim();
        kind = contactId ? inferInventorySourceKindFromContact(
            typeof getContactById === 'function' ? getContactById(contactId, data) : null
        ) : 'individual';
    } else if (acq === 'purchased_as_gift' && (giftRecipient || purchase.giftRecipientContactId)) {
        name = giftRecipient;
        contactId = String(purchase.giftRecipientContactId || '').trim();
        kind = contactId ? inferInventorySourceKindFromContact(
            typeof getContactById === 'function' ? getContactById(contactId, data) : null
        ) : 'individual';
    } else if (store) {
        // Prefer store; Supplier Contact only becomes Source when Store is empty
        name = store;
        kind = 'business';
        contactId = '';
        if (supplierId) {
            const c = typeof getContactById === 'function' ? getContactById(supplierId) : null;
            const cName = c ? invSrcTrim(typeof getContactDisplayName === 'function' ? getContactDisplayName(c) : c.name) : '';
            if (cName && cName.toLowerCase() === store.toLowerCase()) {
                contactId = supplierId;
                kind = inferInventorySourceKindFromContact(c);
            }
        }
    } else if (supplierId) {
        contactId = supplierId;
        const c = typeof getContactById === 'function' ? getContactById(supplierId, data) : null;
        name = c
            ? invSrcTrim(typeof getContactDisplayName === 'function' ? getContactDisplayName(c) : c.name)
            : '';
        kind = inferInventorySourceKindFromContact(c);
    } else if (purchase.dealer || purchase.contact) {
        name = invSrcTrim(purchase.dealer || purchase.contact);
        kind = 'dealer';
    }

    if (!name && !contactId) return { changed: false };

    purchase.sourceName = name;
    purchase.sourceKind = kind;
    purchase.sourceContactId = contactId;
    syncPurchaseSourceFields(purchase, data);
    return { changed: true };
}

function migrateInventorySources(data = appData) {
    if (!data || typeof data !== 'object') return { migrated: 0 };
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    let migrated = 0;
    (data.purchases || []).forEach(p => {
        const result = migratePurchaseSourceFields(p, data);
        if (result.changed) migrated += 1;
        else syncPurchaseSourceFields(p, data);
    });
    data.migrations.inventorySourceV1 = true;
    data.migrations.inventorySourceReport = { migrated, at: new Date().toISOString() };
    return data.migrations.inventorySourceReport;
}

function ensureInventorySourcesMigrated(data = appData) {
    if (!data || typeof data !== 'object') return null;
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    if (data.migrations.inventorySourceV1) {
        (data.purchases || []).forEach(p => syncPurchaseSourceFields(p, data));
        return data.migrations.inventorySourceReport || null;
    }
    return migrateInventorySources(data);
}

function collectInventorySourceOptions(data = appData) {
    const businesses = new Map(); // key -> { name, kind }
    const people = [];

    (data.purchases || []).forEach(p => {
        const name = getPurchaseSourceName(p);
        if (!name) return;
        const kind = getPurchaseSourceKind(p);
        if (inventorySourceIsPersonKind(kind) || p.sourceContactId || p.supplierContactId) return;
        const key = name.toLowerCase();
        if (!businesses.has(key)) businesses.set(key, { name, kind, icon: inventorySourceIcon(kind) });
    });

    // Also include saved store names that may not have sourceName yet
    if (typeof getSavedStoreNames === 'function') {
        getSavedStoreNames(data).forEach(store => {
            const key = store.toLowerCase();
            if (!businesses.has(key)) businesses.set(key, { name: store, kind: 'business', icon: '🏪' });
        });
    }

    const contacts = typeof getContacts === 'function'
        ? getContacts(data, { includeArchived: false, includeHidden: false })
        : [];
    contacts.forEach(c => {
        const name = typeof getContactDisplayName === 'function' ? getContactDisplayName(c) : c.name;
        if (!name) return;
        people.push({
            id: c.id,
            name,
            kind: inferInventorySourceKindFromContact(c),
            icon: inventorySourceIcon(inferInventorySourceKindFromContact(c)),
            favorite: !!c.favorite
        });
    });

    people.sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return {
        businesses: [...businesses.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        people
    };
}

function getBuyFormSourceSelection() {
    const contactId = document.getElementById('buy-source-contact-id')?.value || '';
    const name = invSrcTrim(
        document.getElementById('buy-source-search')?.value
        || document.getElementById('buy-source-new')?.value
        || document.getElementById('buy-source')?.value
        || ''
    );
    const kindSelect = document.getElementById('buy-source-kind')?.value;
    let kind = kindSelect ? normalizeInventorySourceKind(kindSelect) : '';
    if (!kind && contactId) {
        const c = typeof getContactById === 'function' ? getContactById(contactId) : null;
        kind = inferInventorySourceKindFromContact(c);
    }
    if (!kind && name) kind = 'business';
    if (!kind) kind = 'other';
    return { name, kind, contactId };
}

function applyInventorySourceToPayload(payload) {
    if (!payload) return payload;
    const sel = getBuyFormSourceSelection();
    const acq = payload.acquisitionType || 'purchased';
    const hasSource = !!(sel.name || sel.contactId);

    // If the Source picker is empty, keep whatever the form already wrote (legacy store / gift fields)
    if (!hasSource) {
        // Still promote gift recipient/source into sourceName when those fields were filled
        if (acq === 'gift_received' && payload.giftSource) {
            payload.sourceName = invSrcTrim(payload.giftSource);
            payload.sourceKind = payload.giftSourceContactId ? 'individual' : 'individual';
            payload.sourceContactId = payload.giftSourceContactId || '';
        } else if (acq === 'purchased_as_gift' && payload.giftRecipient) {
            payload.sourceName = invSrcTrim(payload.giftRecipient);
            payload.sourceKind = payload.giftRecipientContactId ? 'individual' : 'individual';
            payload.sourceContactId = payload.giftRecipientContactId || '';
            // Preserve store (where bought) when Source is the recipient
        } else if (payload.store) {
            payload.sourceName = invSrcTrim(payload.store);
            payload.sourceKind = 'business';
            payload.sourceContactId = '';
        }
        syncPurchaseSourceFields(payload);
        // For purchased_as_gift, sync may clear store when kind is person — restore purchase location
        if (acq === 'purchased_as_gift' && payload._preservedStore == null) {
            /* store already on payload from form */
        }
        return payload;
    }

    payload.sourceName = sel.name || '';
    payload.sourceKind = sel.kind || 'other';
    payload.sourceContactId = sel.contactId || '';

    if (acq === 'gift_received') {
        payload.giftSource = sel.name || '';
        payload.giftSourceContactId = sel.contactId || '';
        payload.store = '';
        payload.supplierContactId = sel.contactId || '';
        if (sel.name) {
            payload.giverName = sel.name;
            payload.giftPartyName = sel.name;
        }
    } else if (acq === 'purchased_as_gift') {
        const priorStore = invSrcTrim(payload.store || '');
        payload.giftRecipient = sel.name || '';
        payload.giftRecipientContactId = sel.contactId || '';
        if (sel.name) {
            payload.recipientName = sel.name;
            payload.giftPartyName = sel.name;
        }
        // Source is the recipient; keep any prior store as purchase location when Source is a person
        if (inventorySourceIsBusinessKind(sel.kind) && sel.name) {
            payload.store = sel.name;
            payload.supplierContactId = '';
        } else {
            payload.store = priorStore;
            payload.supplierContactId = sel.contactId || '';
        }
    } else {
        if (inventorySourceIsPersonKind(sel.kind) || sel.contactId) {
            payload.store = inventorySourceIsBusinessKind(sel.kind) ? (sel.name || '') : '';
            payload.supplierContactId = sel.contactId || '';
            if (!sel.contactId && sel.name && inventorySourceIsPersonKind(sel.kind)) {
                payload.dealer = sel.name;
            }
        } else {
            payload.store = sel.name || '';
            payload.supplierContactId = '';
        }
    }

    const preservedStore = acq === 'purchased_as_gift' ? invSrcTrim(payload.store || '') : '';
    syncPurchaseSourceFields(payload);
    if (acq === 'purchased_as_gift' && preservedStore && inventorySourceIsPersonKind(payload.sourceKind)) {
        payload.store = preservedStore;
    }
    return payload;
}

function buildBuySourcePickerHtml(acquisitionType = 'purchased') {
    const label = getBuySourceFieldLabel(acquisitionType);
    const placeholder = getBuySourcePlaceholder(acquisitionType);
    return `
        <div class="form-group buy-source-group" id="buy-source-group" data-buy-source="1">
            <label for="buy-source-search" id="buy-source-label">${invSrcEsc(label)}</label>
            <div class="buy-source-picker" data-buy-source-picker="1">
                <input type="hidden" id="buy-source" value="">
                <input type="hidden" id="buy-source-contact-id" value="">
                <input type="hidden" id="buy-source-kind" value="">
                <input type="search" id="buy-source-search" class="buy-source-search"
                    placeholder="${invSrcEsc(placeholder)}" autocomplete="off"
                    onfocus="openBuySourceMenu()"
                    oninput="onBuySourceSearch(this.value)">
                <div id="buy-source-menu" class="buy-source-menu ct-picker-menu hidden" role="listbox"></div>
            </div>
            <div class="buy-source-meta">
                <button type="button" class="secondary-btn btn-sm" id="buy-source-clear-btn" onclick="clearBuySourceSelection()">Clear</button>
            </div>
            <div class="form-group buy-source-new-group hidden" id="buy-source-new-group">
                <label for="buy-source-new">New source name</label>
                <input type="text" id="buy-source-new" placeholder="Enter business or person name" autocomplete="off"
                    oninput="onBuySourceNewInput(this.value)">
            </div>
            <p class="settings-hint">Search businesses and contacts. Selecting either fills Source — no separate supplier field.</p>
        </div>`;
}

function refreshBuySourceMenu(query = '') {
    const menu = document.getElementById('buy-source-menu');
    if (!menu) return;
    const q = String(query || '').trim().toLowerCase();
    const { businesses, people } = collectInventorySourceOptions(appData);
    const filter = (name) => !q || String(name).toLowerCase().includes(q);
    const biz = businesses.filter(b => filter(b.name)).slice(0, 12);
    const ppl = people.filter(p => filter(p.name)).slice(0, 16);
    const bizHtml = biz.length
        ? `<div class="buy-source-group-label">Businesses</div>${biz.map(b =>
            `<button type="button" class="ct-picker-option buy-source-option" data-src-name="${invSrcEsc(b.name)}" data-src-kind="${b.kind}" onclick="selectBuySourceBusiness(this.getAttribute('data-src-name'), this.getAttribute('data-src-kind'))">${b.icon} ${invSrcEsc(b.name)}</button>`
        ).join('')}`
        : '';
    const pplHtml = ppl.length
        ? `<div class="buy-source-group-label">Contacts</div>${ppl.map(p =>
            `<button type="button" class="ct-picker-option buy-source-option" data-src-id="${invSrcEsc(p.id)}" onclick="selectBuySourceContact(this.getAttribute('data-src-id'))">${p.icon} ${invSrcEsc(p.name)}</button>`
        ).join('')}`
        : '';
    menu.innerHTML = `
        ${bizHtml}
        ${pplHtml}
        ${!biz.length && !ppl.length ? '<p class="settings-hint">No matches.</p>' : ''}
        <button type="button" class="ct-picker-option ct-picker-add" onclick="startBuySourceAddNew()">+ Add new source…</button>`;
}

function openBuySourceMenu() {
    const menu = document.getElementById('buy-source-menu');
    if (!menu) return;
    menu.classList.remove('hidden');
    refreshBuySourceMenu(document.getElementById('buy-source-search')?.value || '');
}

function closeBuySourceMenu() {
    document.getElementById('buy-source-menu')?.classList.add('hidden');
}

function onBuySourceSearch(value) {
    const idEl = document.getElementById('buy-source-contact-id');
    const free = document.getElementById('buy-source');
    if (idEl) idEl.value = '';
    if (free) free.value = value || '';
    document.getElementById('buy-source-new-group')?.classList.add('hidden');
    openBuySourceMenu();
    refreshBuySourceMenu(value);
}

function onBuySourceNewInput(value) {
    const free = document.getElementById('buy-source');
    const search = document.getElementById('buy-source-search');
    if (free) free.value = value || '';
    if (search) search.value = value || '';
    const idEl = document.getElementById('buy-source-contact-id');
    if (idEl) idEl.value = '';
    const kindEl = document.getElementById('buy-source-kind');
    if (kindEl && !kindEl.value) kindEl.value = 'business';
}

function startBuySourceAddNew() {
    document.getElementById('buy-source-new-group')?.classList.remove('hidden');
    closeBuySourceMenu();
    const kind = document.getElementById('buy-source-kind');
    if (kind && !kind.value) kind.value = 'business';
    document.getElementById('buy-source-new')?.focus();
}

function clearBuySourceSelection() {
    ['buy-source', 'buy-source-contact-id', 'buy-source-kind', 'buy-source-search', 'buy-source-new'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('buy-source-new-group')?.classList.add('hidden');
    closeBuySourceMenu();
}

function selectBuySourceBusiness(name, kind = 'business') {
    const n = invSrcTrim(name);
    const free = document.getElementById('buy-source');
    const search = document.getElementById('buy-source-search');
    const idEl = document.getElementById('buy-source-contact-id');
    const kindEl = document.getElementById('buy-source-kind');
    if (free) free.value = n;
    if (search) search.value = n;
    if (idEl) idEl.value = '';
    if (kindEl) kindEl.value = normalizeInventorySourceKind(kind);
    document.getElementById('buy-source-new-group')?.classList.add('hidden');
    closeBuySourceMenu();
    // Hide any leftover supplier picker
    document.getElementById('buy-supplier-contact-picker')?.classList.add('hidden');
}

function selectBuySourceContact(contactId) {
    const contact = typeof getContactById === 'function' ? getContactById(contactId) : null;
    const name = contact
        ? (typeof getContactDisplayName === 'function' ? getContactDisplayName(contact) : contact.name)
        : '';
    const kind = inferInventorySourceKindFromContact(contact);
    const free = document.getElementById('buy-source');
    const search = document.getElementById('buy-source-search');
    const idEl = document.getElementById('buy-source-contact-id');
    const kindEl = document.getElementById('buy-source-kind');
    if (free) free.value = name || '';
    if (search) search.value = name || '';
    if (idEl) idEl.value = contactId || '';
    if (kindEl) kindEl.value = kind;
    document.getElementById('buy-source-new-group')?.classList.add('hidden');
    closeBuySourceMenu();
    document.getElementById('buy-supplier-contact-picker')?.classList.add('hidden');
}

function setBuySourceFieldValue(purchaseOrName, maybeKind = '', maybeContactId = '') {
    ensureBuySourcePickerMounted();
    let name = '';
    let kind = '';
    let contactId = '';
    if (purchaseOrName && typeof purchaseOrName === 'object') {
        name = getPurchaseSourceName(purchaseOrName);
        kind = getPurchaseSourceKind(purchaseOrName);
        contactId = getPurchaseSourceContactId(purchaseOrName);
    } else {
        name = invSrcTrim(purchaseOrName);
        kind = normalizeInventorySourceKind(maybeKind || (maybeContactId ? 'individual' : 'business'));
        contactId = String(maybeContactId || '');
    }
    const free = document.getElementById('buy-source');
    const search = document.getElementById('buy-source-search');
    const idEl = document.getElementById('buy-source-contact-id');
    const kindEl = document.getElementById('buy-source-kind');
    if (free) free.value = name;
    if (search) search.value = name;
    if (idEl) idEl.value = contactId;
    if (kindEl) kindEl.value = name || contactId ? kind : '';
    document.getElementById('buy-source-new-group')?.classList.add('hidden');
}

function updateBuySourceFieldLabel() {
    const type = typeof getBuyFormAcquisitionType === 'function'
        ? getBuyFormAcquisitionType()
        : (document.getElementById('buy-acquisition-type')?.value || 'purchased');
    const label = document.getElementById('buy-source-label');
    if (label) label.textContent = getBuySourceFieldLabel(type);
    const search = document.getElementById('buy-source-search');
    if (search) search.placeholder = getBuySourcePlaceholder(type);
}

let inventorySourcePickerMounted = false;
let inventorySourcePickerMountWarned = false;

function isInventorySourceDomElement(node) {
    return !!node && typeof node === 'object' && !Array.isArray(node) && typeof node.insertAdjacentHTML === 'function';
}

function isInventorySourceMountTarget(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
    if (typeof node.insertAdjacentHTML === 'function') return true;
    if (typeof Node !== 'undefined' && node instanceof Node && node.nodeType === 1) return true;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node) || node, 'innerHTML')
        || Object.getOwnPropertyDescriptor(node, 'innerHTML');
    return !!(desc && typeof desc.set === 'function');
}

function mountBuySourcePickerHtml(html) {
    if (typeof document === 'undefined') return false;
    const hasPickerMarkup = () => html.includes('id="buy-source-group"') || html.includes("id='buy-source-group'");
    const mount = document.getElementById('buy-source-mount');
    if (isInventorySourceMountTarget(mount)) {
        mount.innerHTML = html;
        return hasPickerMarkup();
    }
    const storeGroup = document.getElementById('buy-store-group');
    if (isInventorySourceDomElement(storeGroup)) {
        storeGroup.insertAdjacentHTML('beforebegin', html);
        return hasPickerMarkup();
    }
    const paymentGroup = document.getElementById('buy-payment-group');
    if (isInventorySourceDomElement(paymentGroup)) {
        paymentGroup.insertAdjacentHTML('beforebegin', html);
        return hasPickerMarkup();
    }
    return false;
}

function hideLegacyBuySourceFields() {
    const type = typeof getBuyFormAcquisitionType === 'function'
        ? getBuyFormAcquisitionType()
        : normalizePurchaseAcquisitionType(document.getElementById('buy-acquisition-type')?.value || 'purchased');
    const sourcePickerActive = !!document.getElementById('buy-source-group') || inventorySourcePickerMounted;
    if (sourcePickerActive) {
        document.getElementById('buy-supplier-contact-picker')?.classList?.add?.('hidden');
        document.getElementById('buy-store-group')?.classList?.toggle?.('hidden', type !== 'purchased_as_gift');
    }
}

function buySourcePickerMarkupPresent() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById('buy-source-group')) return true;
    const mount = document.getElementById('buy-source-mount');
    return !!(mount && typeof mount.innerHTML === 'string' && mount.innerHTML.includes('buy-source-group'));
}

function ensureBuySourcePickerMounted() {
    if (typeof document === 'undefined') return false;
    if (buySourcePickerMarkupPresent()) {
        inventorySourcePickerMounted = true;
        updateBuySourceFieldLabel();
        hideLegacyBuySourceFields();
        return true;
    }
    if (inventorySourcePickerMounted) return true;

    const type = typeof getBuyFormAcquisitionType === 'function'
        ? getBuyFormAcquisitionType()
        : 'purchased';
    const html = buildBuySourcePickerHtml(type);
    const mounted = mountBuySourcePickerHtml(html);
    if (!mounted) {
        if (!inventorySourcePickerMountWarned) {
            inventorySourcePickerMountWarned = true;
            console.warn('[inventory-source] Source picker mount skipped — buy form target elements are not ready');
        }
        return false;
    }

    inventorySourcePickerMounted = true;
    hideLegacyBuySourceFields();
    updateBuySourceFieldLabel();
    return true;
}

function applyBuySourceAcquisitionUiPatch() {
    if (!buySourcePickerMarkupPresent() && !inventorySourcePickerMounted) {
        ensureBuySourcePickerMounted();
    }
    updateBuySourceFieldLabel();
    hideLegacyBuySourceFields();
    document.getElementById('buy-source-group')?.classList?.remove?.('hidden');
    const type = typeof getBuyFormAcquisitionType === 'function' ? getBuyFormAcquisitionType() : '';
    if (type === 'purchased_as_gift') {
        document.getElementById('buy-gift-date-group')?.classList?.remove?.('hidden');
    }
}

function patchInventorySourceBuyForm() {
    if (typeof updateBuyAcquisitionTypeUI === 'function' && !updateBuyAcquisitionTypeUI.__sourcePatched) {
        const original = updateBuyAcquisitionTypeUI;
        updateBuyAcquisitionTypeUI = function patchedBuyAcquisitionTypeUI() {
            const result = original.apply(this, arguments);
            try {
                applyBuySourceAcquisitionUiPatch();
            } catch (err) {
                if (!inventorySourcePickerMountWarned) {
                    inventorySourcePickerMountWarned = true;
                    console.warn('[inventory-source] acquisition UI patch failed', err);
                }
            }
            return result;
        };
        updateBuyAcquisitionTypeUI.__sourcePatched = true;
    }

    if (typeof buildPurchaseFromForm === 'function' && !buildPurchaseFromForm.__sourcePatched) {
        const original = buildPurchaseFromForm;
        buildPurchaseFromForm = function patchedBuildPurchaseFromForm() {
            const payload = original.apply(this, arguments);
            try {
                applyInventorySourceToPayload(payload);
                // Restore legacy acquisition marker on `source` after our sourceName write
                const acq = payload.acquisitionType || 'purchased';
                if (acq !== 'purchased') payload.source = acq;
                else if (payload.source === 'purchased') delete payload.source;
            } catch (err) {
                console.warn('[inventory-source] apply to payload failed', err);
            }
            return payload;
        };
        buildPurchaseFromForm.__sourcePatched = true;
    }

    if (typeof fillBuyFormFromPurchase === 'function' && !fillBuyFormFromPurchase.__sourcePatched) {
        const original = fillBuyFormFromPurchase;
        fillBuyFormFromPurchase = function patchedFillBuyFormFromPurchase(purchase) {
            const result = original.apply(this, arguments);
            try {
                ensureBuySourcePickerMounted();
                setBuySourceFieldValue(purchase);
                updateBuySourceFieldLabel();
            } catch (err) {
                console.warn('[inventory-source] fill form failed', err);
            }
            return result;
        };
        fillBuyFormFromPurchase.__sourcePatched = true;
    }

    if (typeof getBuyFormStoreValue === 'function' && !getBuyFormStoreValue.__sourcePatched) {
        const original = getBuyFormStoreValue;
        getBuyFormStoreValue = function patchedGetBuyFormStoreValue() {
            const sel = getBuyFormSourceSelection();
            if (sel.name || sel.contactId) {
                if (inventorySourceIsBusinessKind(sel.kind) || (!sel.contactId && !inventorySourceIsPersonKind(sel.kind))) {
                    return sel.name;
                }
                return '';
            }
            return original.apply(this, arguments);
        };
        getBuyFormStoreValue.__sourcePatched = true;
    }
}

function patchInventorySourceAnalytics() {
    if (typeof financialPurchaseStore === 'function' && !financialPurchaseStore.__sourcePatched) {
        const original = financialPurchaseStore;
        financialPurchaseStore = function patchedFinancialPurchaseStore(purchase) {
            const kind = getPurchaseSourceKind(purchase);
            if (inventorySourceIsBusinessKind(kind) || kind === 'other') {
                const name = getPurchaseSourceName(purchase);
                if (name && !inventorySourceIsPersonKind(kind)) return name;
            }
            // Person sources should not count as stores
            if (inventorySourceIsPersonKind(kind)) return '';
            return original(purchase);
        };
        financialPurchaseStore.__sourcePatched = true;
    }

    if (typeof financialPurchaseSupplier === 'function' && !financialPurchaseSupplier.__sourcePatched) {
        const original = financialPurchaseSupplier;
        financialPurchaseSupplier = function patchedFinancialPurchaseSupplier(purchase) {
            const kind = getPurchaseSourceKind(purchase);
            const name = getPurchaseSourceName(purchase);
            if (inventorySourceIsPersonKind(kind) || kind === 'dealer') return name || original(purchase);
            if (purchase?.sourceContactId || purchase?.supplierContactId) return name || original(purchase);
            return original(purchase);
        };
        financialPurchaseSupplier.__sourcePatched = true;
    }
}

function patchInventorySourceHistoryColumns() {
    const removed = typeof PURCHASE_HISTORY_REMOVED_COLUMN_IDS !== 'undefined'
        ? PURCHASE_HISTORY_REMOVED_COLUMN_IDS
        : ['supplier', 'giftRecipient', 'budgetStatus', 'productType', 'inventoryLifespan', 'giftStatus', 'linkedUsers', 'purchaseQualityRating'];
    try {
        if (typeof TABLE_COLUMN_LABELS !== 'undefined' && TABLE_COLUMN_LABELS.purchaseHistory) {
            TABLE_COLUMN_LABELS.purchaseHistory.store = 'Source';
            removed.forEach(id => { delete TABLE_COLUMN_LABELS.purchaseHistory[id]; });
        }
    } catch (_) { /* optional */ }

    try {
        if (typeof TABLE_COLUMN_DEFAULTS !== 'undefined' && TABLE_COLUMN_DEFAULTS.purchaseHistory) {
            const drop = new Set(removed);
            const defaults = TABLE_COLUMN_DEFAULTS.purchaseHistory;
            if (Array.isArray(defaults.order)) {
                defaults.order = defaults.order.filter(id => !drop.has(id));
            }
            if (Array.isArray(defaults.hidden)) {
                defaults.hidden = defaults.hidden.filter(id => !drop.has(id));
            }
            if (defaults.widths && typeof defaults.widths === 'object') {
                removed.forEach(id => { delete defaults.widths[id]; });
            }
        }
    } catch (_) { /* optional */ }
}

let inventorySourceClickListenerBound = false;

function initInventorySource() {
    ensureInventorySourcesMigrated(appData);
    patchInventorySourceBuyForm();
    patchInventorySourceAnalytics();
    patchInventorySourceHistoryColumns();
    if (typeof document !== 'undefined') {
        ensureBuySourcePickerMounted();
        if (!inventorySourceClickListenerBound) {
            inventorySourceClickListenerBound = true;
            document.addEventListener('click', (e) => {
                const menu = document.getElementById('buy-source-menu');
                const picker = document.querySelector('[data-buy-source-picker]');
                if (!menu || menu.classList.contains('hidden')) return;
                if (picker && picker.contains(e.target)) return;
                closeBuySourceMenu();
            });
        }
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try { initInventorySource(); } catch (err) { console.error('[inventory-source] init failed', err); }
        });
    } else {
        try { initInventorySource(); } catch (_) { /* tests / early */ }
    }
}
