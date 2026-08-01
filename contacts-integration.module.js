// ——— Contacts Cross-Tab Integration ———
// Contacts stay a shared data system; UI lives in Log, Inventory, Goals,
// Insights, Home, and Settings — not a separate main nav tab.
// Spliced into app.js ahead of `const defaultData`. Overrides panel openers.

const CONTACT_PICKER_STATE = {
    activeFieldId: '',
    query: '',
    createForFieldId: '',
    createRoles: []
};

function ctEscAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getContactDisplayName(contactOrId, data = appData) {
    if (!contactOrId) return '';
    if (typeof contactOrId === 'object') {
        return contactOrId.nickname ? `${contactOrId.name} (${contactOrId.nickname})` : (contactOrId.name || '');
    }
    const c = typeof getContactById === 'function' ? getContactById(contactOrId, data) : null;
    return c ? getContactDisplayName(c, data) : '';
}

function rankContactsForPicker(contacts, query = '', roleFilter = null) {
    const q = String(query || '').trim().toLowerCase();
    let list = [...(contacts || [])];
    if (roleFilter) {
        list = list.filter(c => {
            if (roleFilter === 'supplier') return typeof isSupplierContact === 'function' && isSupplierContact(c);
            if (roleFilter === 'support') return typeof isSupportContact === 'function' && isSupportContact(c);
            if (roleFilter === 'friend') return (c.roles || []).includes('friend');
            if (roleFilter === 'gift') {
                return (c.roles || []).some(r => ['gift_giver', 'gift_recipient', 'friend', 'family', 'partner'].includes(r));
            }
            if (roleFilter === 'shared') {
                return (c.roles || []).some(r => ['shared_use_contact', 'friend', 'partner', 'family'].includes(r));
            }
            return (c.roles || []).includes(roleFilter);
        });
    }
    if (q) {
        list = list.filter(c => {
            const hay = [
                c.name, c.nickname, c.phone, c.email,
                ...(c.roles || []).map(r => CONTACT_ROLE_LABELS?.[r] || r),
                ...(c.tags || [])
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }
    return list.sort((a, b) => {
        if (!!b.favorite - !!a.favorite) return !!b.favorite - !!a.favorite;
        const aLast = a.lastLinkedDate || a.updatedAt || '';
        const bLast = b.lastLinkedDate || b.updatedAt || '';
        if (aLast !== bLast) return String(bLast).localeCompare(String(aLast));
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function buildContactPickerHtml({
    fieldId,
    selectedId = '',
    freeTextValue = '',
    roleFilter = null,
    label = 'Contact',
    required = false,
    allowFreeText = true
} = {}) {
    const contacts = typeof getContacts === 'function'
        ? getContacts(appData, { includeArchived: false, includeHidden: false })
        : [];
    const ranked = rankContactsForPicker(contacts, '', roleFilter);
    const favorites = ranked.filter(c => c.favorite).slice(0, 8);
    const recent = ranked.filter(c => !c.favorite).slice(0, 12);
    const selected = selectedId && typeof getContactById === 'function' ? getContactById(selectedId) : null;
    const display = selected ? getContactDisplayName(selected) : (freeTextValue || '');
    return `
        <div class="ct-picker" data-ct-picker="${ctEscAttr(fieldId)}" data-role-filter="${ctEscAttr(roleFilter || '')}">
            <label class="ct-picker-label" for="${ctEscAttr(fieldId)}-search">${ctEscAttr(label)}${required ? ' *' : ''}</label>
            <div class="ct-picker-row">
                <input type="search" id="${ctEscAttr(fieldId)}-search" class="ct-picker-search" placeholder="Search contacts…" autocomplete="off"
                    value="${ctEscAttr(display)}"
                    oninput="onContactPickerSearch('${ctEscAttr(fieldId)}', this.value)"
                    onfocus="openContactPickerMenu('${ctEscAttr(fieldId)}')">
                <button type="button" class="btn-small secondary-btn" onclick="openContactPickerCreate('${ctEscAttr(fieldId)}', '${ctEscAttr(roleFilter || '')}')" title="Add contact">+</button>
                <button type="button" class="btn-small secondary-btn" onclick="clearContactPicker('${ctEscAttr(fieldId)}')" title="Clear">×</button>
            </div>
            <input type="hidden" id="${ctEscAttr(fieldId)}-contact-id" value="${ctEscAttr(selectedId || '')}">
            ${allowFreeText ? `<input type="hidden" id="${ctEscAttr(fieldId)}" value="${ctEscAttr(freeTextValue || (selected ? selected.name : ''))}">` : ''}
            <div id="${ctEscAttr(fieldId)}-menu" class="ct-picker-menu hidden" role="listbox">
                ${favorites.length ? `<div class="ct-picker-group"><span>Favorites</span>${favorites.map(c =>
                    `<button type="button" class="ct-picker-option" onclick="selectContactPickerValue('${ctEscAttr(fieldId)}','${ctEscAttr(c.id)}')">${escapeHtml(getContactDisplayName(c))}${c.favorite ? ' ★' : ''}</button>`
                ).join('')}</div>` : ''}
                ${recent.length ? `<div class="ct-picker-group"><span>Recent</span>${recent.map(c =>
                    `<button type="button" class="ct-picker-option" onclick="selectContactPickerValue('${ctEscAttr(fieldId)}','${ctEscAttr(c.id)}')">${escapeHtml(getContactDisplayName(c))}</button>`
                ).join('')}</div>` : ''}
                ${!favorites.length && !recent.length ? '<p class="settings-hint ct-picker-empty">No contacts yet. Use + to add one.</p>' : ''}
                <button type="button" class="ct-picker-option ct-picker-add" onclick="openContactPickerCreate('${ctEscAttr(fieldId)}', '${ctEscAttr(roleFilter || '')}')">Add new contact…</button>
            </div>
            ${selectedId ? `<p class="ct-picker-selected settings-hint">Linked: <button type="button" class="link-btn" onclick="openContactDetailPanel('${ctEscAttr(selectedId)}')">${escapeHtml(getContactDisplayName(selected))}</button>${typeof openContactEditForm === 'function' ? ` · <button type="button" class="link-btn" onclick="openContactEditInPanel('${ctEscAttr(selectedId)}')">Edit</button>` : ''}</p>` : (freeTextValue ? `<p class="ct-picker-selected settings-hint weed-needs-review">Unlinked text: ${escapeHtml(freeTextValue)}</p>` : '')}
        </div>`;
}

function refreshContactPickerMenu(fieldId, query = '') {
    const menu = document.getElementById(`${fieldId}-menu`);
    const wrap = document.querySelector(`[data-ct-picker="${fieldId}"]`);
    if (!menu || !wrap) return;
    const roleFilter = wrap.getAttribute('data-role-filter') || null;
    const contacts = typeof getContacts === 'function'
        ? getContacts(appData, { includeArchived: false, includeHidden: false })
        : [];
    const ranked = rankContactsForPicker(contacts, query, roleFilter || null);
    const favorites = ranked.filter(c => c.favorite).slice(0, 8);
    const rest = ranked.filter(c => !c.favorite).slice(0, 20);
    menu.innerHTML = `
        ${favorites.length ? `<div class="ct-picker-group"><span>Favorites</span>${favorites.map(c =>
            `<button type="button" class="ct-picker-option" onclick="selectContactPickerValue('${ctEscAttr(fieldId)}','${ctEscAttr(c.id)}')">${escapeHtml(getContactDisplayName(c))} ★</button>`
        ).join('')}</div>` : ''}
        ${rest.length ? `<div class="ct-picker-group"><span>${query ? 'Matches' : 'Contacts'}</span>${rest.map(c =>
            `<button type="button" class="ct-picker-option" onclick="selectContactPickerValue('${ctEscAttr(fieldId)}','${ctEscAttr(c.id)}')">${escapeHtml(getContactDisplayName(c))}</button>`
        ).join('')}</div>` : ''}
        ${!ranked.length ? '<p class="settings-hint ct-picker-empty">No matches.</p>' : ''}
        <button type="button" class="ct-picker-option ct-picker-add" onclick="openContactPickerCreate('${ctEscAttr(fieldId)}', '${ctEscAttr(roleFilter || '')}')">Add new contact…</button>`;
}

function openContactPickerMenu(fieldId) {
    CONTACT_PICKER_STATE.activeFieldId = fieldId;
    document.querySelectorAll('.ct-picker-menu').forEach(el => {
        if (el.id !== `${fieldId}-menu`) el.classList.add('hidden');
    });
    const menu = document.getElementById(`${fieldId}-menu`);
    menu?.classList.remove('hidden');
    refreshContactPickerMenu(fieldId, document.getElementById(`${fieldId}-search`)?.value || '');
}

function onContactPickerSearch(fieldId, value) {
    CONTACT_PICKER_STATE.query = value || '';
    openContactPickerMenu(fieldId);
    refreshContactPickerMenu(fieldId, value);
    const free = document.getElementById(fieldId);
    if (free && !document.getElementById(`${fieldId}-contact-id`)?.value) {
        free.value = value || '';
    }
}

function selectContactPickerValue(fieldId, contactId) {
    const contact = typeof getContactById === 'function' ? getContactById(contactId) : null;
    const idEl = document.getElementById(`${fieldId}-contact-id`);
    const freeEl = document.getElementById(fieldId);
    const searchEl = document.getElementById(`${fieldId}-search`);
    if (idEl) idEl.value = contactId || '';
    if (freeEl) freeEl.value = contact?.name || '';
    if (searchEl) searchEl.value = contact ? getContactDisplayName(contact) : '';
    document.getElementById(`${fieldId}-menu`)?.classList.add('hidden');
    const selectedLine = document.querySelector(`[data-ct-picker="${fieldId}"] .ct-picker-selected`);
    if (selectedLine && contact) {
        selectedLine.className = 'ct-picker-selected settings-hint';
        selectedLine.innerHTML = `Linked: <button type="button" class="link-btn" onclick="openContactDetailPanel('${ctEscAttr(contact.id)}')">${escapeHtml(getContactDisplayName(contact))}</button>`;
    }
}

function clearContactPicker(fieldId) {
    const idEl = document.getElementById(`${fieldId}-contact-id`);
    const freeEl = document.getElementById(fieldId);
    const searchEl = document.getElementById(`${fieldId}-search`);
    if (idEl) idEl.value = '';
    if (freeEl) freeEl.value = '';
    if (searchEl) searchEl.value = '';
    document.getElementById(`${fieldId}-menu`)?.classList.add('hidden');
    const selectedLine = document.querySelector(`[data-ct-picker="${fieldId}"] .ct-picker-selected`);
    if (selectedLine) selectedLine.textContent = '';
}

function getContactPickerSelection(fieldId) {
    const contactId = document.getElementById(`${fieldId}-contact-id`)?.value || '';
    const freeText = document.getElementById(fieldId)?.value
        || document.getElementById(`${fieldId}-search`)?.value
        || '';
    const contact = contactId && typeof getContactById === 'function' ? getContactById(contactId) : null;
    return {
        contactId: contact?.id || '',
        name: contact?.name || String(freeText || '').trim()
    };
}

function openContactPickerCreate(fieldId, roleFilter = '') {
    CONTACT_PICKER_STATE.createForFieldId = fieldId;
    const roles = [];
    if (roleFilter === 'supplier') roles.push('dealer_supplier');
    else if (roleFilter === 'shared') roles.push('shared_use_contact', 'friend');
    else if (roleFilter === 'gift') roles.push('gift_recipient', 'friend');
    else if (roleFilter === 'support') roles.push('accountability_partner');
    else if (roleFilter) roles.push(roleFilter);
    else roles.push('friend');
    CONTACT_PICKER_STATE.createRoles = roles;
    const nameHint = document.getElementById(`${fieldId}-search`)?.value || '';
    openContactCreateModal({
        name: nameHint,
        roles,
        onSaved: (contact) => {
            selectContactPickerValue(fieldId, contact.id);
        }
    });
}

function openContactCreateModal(options = {}) {
    const modal = document.getElementById('contact-quick-modal');
    if (!modal) {
        if (typeof openContactCreateForm === 'function') openContactCreateForm();
        return;
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const nameEl = document.getElementById('ct-quick-name');
    if (nameEl) nameEl.value = options.name || '';
    const rolesWrap = document.getElementById('ct-quick-roles');
    if (rolesWrap && typeof CONTACT_ROLES !== 'undefined') {
        const selected = new Set(options.roles || ['friend']);
        rolesWrap.innerHTML = CONTACT_ROLES.map(role =>
            `<label class="ct-role-check"><input type="checkbox" name="ct-quick-role" value="${role}"${selected.has(role) ? ' checked' : ''}> ${escapeHtml(CONTACT_ROLE_LABELS[role] || role)}</label>`
        ).join('');
    }
    CONTACT_PICKER_STATE._onSaved = options.onSaved || null;
    nameEl?.focus();
}

function closeContactCreateModal() {
    const modal = document.getElementById('contact-quick-modal');
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    CONTACT_PICKER_STATE.createForFieldId = '';
    CONTACT_PICKER_STATE._onSaved = null;
}

function submitContactQuickCreate(event) {
    event?.preventDefault?.();
    const name = document.getElementById('ct-quick-name')?.value?.trim();
    if (!name) {
        if (typeof showToast === 'function') showToast('Enter a contact name.', 'error');
        return;
    }
    const roles = [...(document.querySelectorAll('input[name="ct-quick-role"]:checked') || [])].map(el => el.value);
    const saved = saveContactRecord({
        name,
        nickname: document.getElementById('ct-quick-nickname')?.value || '',
        roles: roles.length ? roles : ['friend'],
        favorite: !!document.getElementById('ct-quick-favorite')?.checked,
        source: 'quick-create'
    });
    const onSaved = CONTACT_PICKER_STATE._onSaved;
    closeContactCreateModal();
    if (typeof onSaved === 'function') onSaved(saved);
    if (typeof showToast === 'function') showToast(`Saved ${saved.name}`, 'success');
    if (document.getElementById('contacts-root')) renderContactsView();
}

function openContactDetailPanel(contactId) {
    if (!contactId) return;
    const panel = document.getElementById('contact-detail-panel');
    const body = document.getElementById('contact-detail-panel-body');
    if (!panel || !body) {
        // Fallback: settings manage contacts
        openManageContactsSettings(contactId);
        return;
    }
    contactsUiState.detailId = contactId;
    body.innerHTML = typeof renderContactDetailHtml === 'function'
        ? renderContactDetailHtml(contactId, appData)
        : '<p class="ct-error">Contact detail unavailable.</p>';
    // Retarget close/edit to panel mode
    body.querySelectorAll('[onclick*="closeContactDetail"]').forEach(btn => {
        btn.setAttribute('onclick', 'closeContactDetailPanel()');
    });
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
}

function closeContactDetailPanel() {
    const panel = document.getElementById('contact-detail-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
}

function openContactEditInPanel(contactId) {
    openManageContactsSettings(contactId);
    if (typeof openContactEditForm === 'function') openContactEditForm(contactId);
}

function openManageContactsSettings(detailId = '') {
    if (typeof switchTab === 'function') switchTab('settings-tab');
    const section = document.querySelector('[data-section="settingsContacts"]');
    if (section?.classList.contains('collapsed')) {
        if (typeof toggleSection === 'function') toggleSection('settingsContacts');
    }
    if (detailId) {
        contactsUiState.detailId = detailId;
        contactsUiState.view = 'detail';
    } else if (!contactsUiState.view) {
        contactsUiState.view = 'list';
    }
    if (typeof renderContactsView === 'function') renderContactsView();
    section?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function mountLogContactPickers() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    try {
        const giftGroup = document.getElementById('use-gift-party-group');
        const sharedEl = document.getElementById('use-shared-with');
        const sharedGroup = sharedEl && typeof sharedEl.closest === 'function' ? sharedEl.closest('.form-group') : null;
        if (giftGroup && typeof giftGroup.querySelector === 'function' && !giftGroup.querySelector('[data-ct-picker="use-gift-party"]')) {
            const label = document.getElementById('use-gift-party-label')?.textContent || 'Contact';
            const existing = document.getElementById('use-gift-party');
            const currentVal = existing?.value || '';
            const wrap = document.createElement('div');
            wrap.innerHTML = buildContactPickerHtml({
                fieldId: 'use-gift-party',
                freeTextValue: currentVal,
                roleFilter: 'gift',
                label,
                allowFreeText: true
            });
            if (wrap.firstElementChild && typeof existing?.replaceWith === 'function') {
                existing.replaceWith(wrap.firstElementChild);
            }
        }
        if (sharedGroup && typeof sharedGroup.querySelector === 'function' && !sharedGroup.querySelector('[data-ct-picker="use-shared-with"]')) {
            const existing = document.getElementById('use-shared-with');
            const currentVal = existing?.value || '';
            const wrap = document.createElement('div');
            wrap.innerHTML = buildContactPickerHtml({
                fieldId: 'use-shared-with',
                freeTextValue: currentVal,
                roleFilter: 'shared',
                label: 'Shared with',
                allowFreeText: true
            });
            if (wrap.firstElementChild && typeof sharedGroup.appendChild === 'function') {
                sharedGroup.innerHTML = '';
                sharedGroup.appendChild(wrap.firstElementChild);
            }
        }
    } catch (err) {
        console.warn('[contacts] mountLogContactPickers skipped', err?.message || err);
    }
}

function mountBuyContactPickers() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    try {
        const mount = (groupId, fieldId, label, roleFilter, required = false) => {
            const group = document.getElementById(groupId);
            if (!group || typeof group.querySelector !== 'function' || group.querySelector(`[data-ct-picker="${fieldId}"]`)) return;
            if (typeof group.appendChild !== 'function') return;
            const existing = document.getElementById(fieldId);
            const currentVal = existing?.value || '';
            const wrap = document.createElement('div');
            wrap.innerHTML = buildContactPickerHtml({
                fieldId,
                freeTextValue: currentVal,
                roleFilter,
                label,
                required,
                allowFreeText: true
            });
            if (!wrap.firstElementChild) return;
            group.innerHTML = '';
            group.appendChild(wrap.firstElementChild);
        };
        mount('buy-gift-source-group', 'buy-gift-source', 'Gift From', 'gift', false);
        mount('buy-gift-recipient-group', 'buy-gift-recipient', 'Gift Recipient', 'gift', true);

        const storeGroup = document.getElementById('buy-store-group');
        if (storeGroup && typeof storeGroup.insertAdjacentElement === 'function'
            && !document.getElementById('buy-supplier-contact-picker')) {
            const holder = document.createElement('div');
            holder.id = 'buy-supplier-contact-picker';
            holder.className = 'form-group';
            holder.innerHTML = buildContactPickerHtml({
                fieldId: 'buy-supplier-contact',
                roleFilter: 'supplier',
                label: 'Supplier contact (optional)',
                allowFreeText: true
            });
            storeGroup.insertAdjacentElement('afterend', holder);
        }
    } catch (err) {
        console.warn('[contacts] mountBuyContactPickers skipped', err?.message || err);
    }
}

function applyLogContactIdsToEntry(base) {
    if (!base) return base;
    const gift = getContactPickerSelection('use-gift-party');
    const shared = getContactPickerSelection('use-shared-with');
    if (base.transactionType === 'gift_given' || base.transactionType === 'gift_received') {
        if (gift.contactId) base.giftPartyContactId = gift.contactId;
        if (gift.name) {
            base.giftPartyName = gift.name;
            if (base.transactionType === 'gift_given') base.recipientName = gift.name;
            if (base.transactionType === 'gift_received') base.giverName = gift.name;
        }
    }
    if (base.transactionType === 'shared_use') {
        if (shared.contactId) base.sharedWithContactId = shared.contactId;
        if (shared.name) base.sharedWithName = shared.name;
    }
    return base;
}

function applyBuyContactIdsToPayload(payload) {
    if (!payload) return payload;
    const source = getContactPickerSelection('buy-gift-source');
    const recipient = getContactPickerSelection('buy-gift-recipient');
    const supplier = getContactPickerSelection('buy-supplier-contact');
    if (source.contactId) payload.giftSourceContactId = source.contactId;
    if (source.name) payload.giftSource = source.name;
    if (recipient.contactId) payload.giftRecipientContactId = recipient.contactId;
    if (recipient.name) payload.giftRecipient = recipient.name;
    if (supplier.contactId) payload.supplierContactId = supplier.contactId;
    if (supplier.name && !payload.store) payload.store = supplier.name;
    return payload;
}

function resolveLogContactLabel(log, data = appData) {
    if (!log) return '';
    const tx = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : log.transactionType;
    if (tx === 'shared_use') {
        if (log.sharedWithContactId) return getContactDisplayName(log.sharedWithContactId, data);
        return log.sharedWithName || '';
    }
    if (tx === 'gift_given' || tx === 'gift_received') {
        if (log.giftPartyContactId) return getContactDisplayName(log.giftPartyContactId, data);
        return log.giftPartyName || log.recipientName || log.giverName || '';
    }
    return '';
}

function buildHomeContactCardsHtml(data = appData) {
    if (typeof buildContactAnalytics !== 'function' || typeof buildContactsDashboard !== 'function') return '';
    const analytics = buildContactAnalytics(data);
    const contacts = typeof getContacts === 'function' ? getContacts(data, { includeArchived: false }) : [];
    const visible = contacts.filter(c => !c.hidden && !c.hideFromDashboard);
    if (!visible.length && !(data.contacts || []).length) return '';

    const cards = [];
    const pushCard = (label, contact, meta = '') => {
        if (!contact || contact.hideFromDashboard) return;
        cards.push(`<article class="ct-home-card">
            <span>${escapeHtml(label)}</span>
            <strong><button type="button" class="link-btn" onclick="openContactDetailPanel('${ctEscAttr(contact.id)}')">${escapeHtml(contact.name)}</button></strong>
            ${meta ? `<p class="settings-hint">${escapeHtml(meta)}</p>` : ''}
        </article>`);
    };

    // Most recent shared-use contact
    const sharedLogs = (data.logs || [])
        .filter(l => (typeof getLogTransactionType === 'function' ? getLogTransactionType(l) : l.transactionType) === 'shared_use')
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (sharedLogs[0]) {
        const c = sharedLogs[0].sharedWithContactId
            ? getContactById(sharedLogs[0].sharedWithContactId, data)
            : findContactByName(sharedLogs[0].sharedWithName, data);
        pushCard('Recent shared-use', c, sharedLogs[0].date || '');
    }

    pushCard('Top supplier this month', analytics.mostFrequentSupplier);
    pushCard('Highest spending supplier', analytics.highestSpendingSupplier);

    const support = visible.find(c => typeof isSupportContact === 'function' && isSupportContact(c) && c.supportProfile?.nextAppointment);
    if (support) pushCard('Upcoming support', support, `Appt ${support.supportProfile.nextAppointment}`);

    const giftRecv = (data.purchases || [])
        .filter(p => (typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType) === 'gift_received')
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (giftRecv) {
        const c = giftRecv.giftSourceContactId
            ? getContactById(giftRecv.giftSourceContactId, data)
            : findContactByName(giftRecv.giftSource, data);
        pushCard('Recent gift giver', c, giftRecv.date || '');
    }

    if (!cards.length) return '';
    return `<section class="ct-home-section collapsible-section" data-section="dashContacts">
        <button type="button" class="section-toggle" onclick="toggleSection('dashContacts')">
            <span>Contacts</span><span class="chevron">⌄</span>
        </button>
        <div class="section-content">
            <div class="ct-home-grid">${cards.join('')}</div>
            <p class="settings-hint"><button type="button" class="link-btn" onclick="openManageContactsSettings()">Manage contacts in Settings</button></p>
        </div>
    </section>`;
}

function renderHomeContactCards() {
    const host = document.getElementById('dash-contacts-root');
    if (!host) return;
    try {
        host.innerHTML = buildHomeContactCardsHtml(appData);
        if (typeof applyCollapsedSections === 'function') applyCollapsedSections();
    } catch (err) {
        console.error('[contacts] home cards failed', err);
        host.innerHTML = '';
    }
}

function buildInsightsContactAnalyticsHtml(data = appData) {
    if (typeof buildContactAnalytics !== 'function') return '';
    const analytics = buildContactAnalytics(data);
    const suppliers = (typeof getContacts === 'function' ? getContacts(data, { includeArchived: false }) : [])
        .filter(c => typeof isSupplierContact === 'function' && isSupplierContact(c))
        .map(c => ({ contact: c, profile: buildContactSupplierProfile(c.id, data) }))
        .filter(row => (row.profile?.purchaseCount || 0) > 0)
        .sort((a, b) => (b.profile.totalSpent || 0) - (a.profile.totalSpent || 0))
        .slice(0, 8);
    const label = c => c ? `<button type="button" class="link-btn" onclick="openContactDetailPanel('${ctEscAttr(c.id)}')">${escapeHtml(c.name)}</button>` : '—';
    return `
        <div class="ct-insights">
            <div class="ct-toolbar">
                <label>Filter contact
                    <select id="ct-insights-contact-filter" onchange="onInsightsContactFilterChange(this.value)">
                        <option value="">All contacts</option>
                        ${(typeof getContacts === 'function' ? getContacts(data, { includeArchived: false }) : []).map(c =>
                            `<option value="${ctEscAttr(c.id)}">${escapeHtml(c.name)}</option>`
                        ).join('')}
                    </select>
                </label>
                <button type="button" class="secondary-btn btn-sm" onclick="openManageContactsSettings()">Manage contacts</button>
            </div>
            <div class="ct-summary-grid">
                <article class="ct-card"><span>Most frequent supplier</span><strong class="ct-text">${label(analytics.mostFrequentSupplier)}</strong></article>
                <article class="ct-card"><span>Highest spending supplier</span><strong class="ct-text">${label(analytics.highestSpendingSupplier)}</strong></article>
                <article class="ct-card"><span>Most shared sessions</span><strong class="ct-text">${label(analytics.mostSharedSessions)}</strong></article>
                <article class="ct-card"><span>Most gifts exchanged</span><strong class="ct-text">${label(analytics.mostGiftsExchanged)}</strong></article>
            </div>
            ${suppliers.length ? `<div class="table-scroll"><table class="sheet-table"><thead><tr>
                <th>Supplier</th><th>Purchases</th><th>Total spent</th><th>Avg cost</th><th>Avg days between</th>
            </tr></thead><tbody>${suppliers.map(row => `<tr>
                <td>${label(row.contact)}</td>
                <td>${row.profile.purchaseCount || 0}</td>
                <td>${typeof ctMoney === 'function' ? ctMoney(row.profile.totalSpent) : row.profile.totalSpent}</td>
                <td>${row.profile.averagePrices == null ? '—' : (typeof ctMoney === 'function' ? ctMoney(row.profile.averagePrices) : row.profile.averagePrices)}</td>
                <td>${row.profile.purchaseFrequencyDays ?? '—'}</td>
            </tr>`).join('')}</tbody></table></div>` : '<p class="settings-hint">No supplier purchase history yet.</p>'}
        </div>`;
}

function renderInsightsContactAnalytics() {
    const root = document.getElementById('insights-contacts-root');
    if (!root) return;
    try {
        root.innerHTML = buildInsightsContactAnalyticsHtml(appData);
    } catch (err) {
        console.error('[contacts] insights analytics failed', err);
        root.innerHTML = `<div class="ct-error" role="alert">Could not load contact analytics.</div>`;
    }
}

function onInsightsContactFilterChange(contactId) {
    if (contactId) openContactDetailPanel(contactId);
}

function applyGoalContactFieldsToDraft(draft) {
    if (!draft) return draft;
    const partner = getContactPickerSelection('goal-accountability-partner');
    const support = getContactPickerSelection('goal-support-contact');
    const checkin = getContactPickerSelection('goal-checkin-contact');
    draft.accountabilityPartnerContactId = partner.contactId || '';
    draft.supportContactId = support.contactId || '';
    draft.checkInContactId = checkin.contactId || '';
    draft.accountabilityPartnerName = partner.name || '';
    draft.supportContactName = support.name || '';
    draft.checkInContactName = checkin.name || '';
    return draft;
}

function applyPlanContactFieldsToDraft(draft) {
    if (!draft) return draft;
    const sponsor = getContactPickerSelection('plan-sponsor-contact');
    const partner = getContactPickerSelection('plan-partner-contact');
    const support = getContactPickerSelection('plan-support-contact');
    draft.sponsorContactId = sponsor.contactId || '';
    draft.planPartnerContactId = partner.contactId || '';
    draft.supportContactId = support.contactId || '';
    draft.sponsorName = sponsor.name || '';
    draft.planPartnerName = partner.name || '';
    draft.supportContactName = support.name || '';
    return draft;
}

function renderGoalPlanContactFieldsHtml(kind = 'goal', record = null) {
    if (kind === 'plan') {
        return `
            <div class="ct-goal-fields">
                ${buildContactPickerHtml({ fieldId: 'plan-sponsor-contact', selectedId: record?.sponsorContactId || '', freeTextValue: record?.sponsorName || '', roleFilter: 'support', label: 'Sponsor (optional)' })}
                ${buildContactPickerHtml({ fieldId: 'plan-partner-contact', selectedId: record?.planPartnerContactId || '', freeTextValue: record?.planPartnerName || '', roleFilter: 'support', label: 'Plan partner (optional)' })}
                ${buildContactPickerHtml({ fieldId: 'plan-support-contact', selectedId: record?.supportContactId || '', freeTextValue: record?.supportContactName || '', roleFilter: 'support', label: 'Support contact (optional)' })}
            </div>`;
    }
    return `
        <div class="ct-goal-fields">
            ${buildContactPickerHtml({ fieldId: 'goal-accountability-partner', selectedId: record?.accountabilityPartnerContactId || '', freeTextValue: record?.accountabilityPartnerName || '', roleFilter: 'support', label: 'Accountability partner (optional)' })}
            ${buildContactPickerHtml({ fieldId: 'goal-support-contact', selectedId: record?.supportContactId || '', freeTextValue: record?.supportContactName || '', roleFilter: 'support', label: 'Support contact (optional)' })}
            ${buildContactPickerHtml({ fieldId: 'goal-checkin-contact', selectedId: record?.checkInContactId || '', freeTextValue: record?.checkInContactName || '', roleFilter: 'support', label: 'Check-in contact (optional)' })}
        </div>`;
}

function formatGoalLinkedContactsHtml(goal, data = appData) {
    if (!goal) return '';
    const parts = [];
    const add = (label, id, name) => {
        if (id) parts.push(`${label}: <button type="button" class="link-btn" onclick="openContactDetailPanel('${ctEscAttr(id)}')">${escapeHtml(getContactDisplayName(id, data) || name || 'Contact')}</button>`);
        else if (name) parts.push(`${label}: ${escapeHtml(name)}`);
    };
    add('Accountability', goal.accountabilityPartnerContactId, goal.accountabilityPartnerName);
    add('Support', goal.supportContactId, goal.supportContactName);
    add('Check-in', goal.checkInContactId, goal.checkInContactName);
    return parts.length ? `<p class="settings-hint ct-linked-line">${parts.join(' · ')}</p>` : '';
}

function initContactsIntegrationUi() {
    mountLogContactPickers();
    mountBuyContactPickers();
    if (typeof document !== 'undefined') {
        document.addEventListener('click', (event) => {
            const t = event.target;
            if (!(t instanceof Element)) return;
            if (t.closest('.ct-picker')) return;
            document.querySelectorAll('.ct-picker-menu').forEach(el => el.classList.add('hidden'));
        });
    }
}
