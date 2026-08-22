// ——— Inventory page (combined table filters + summary) ———
// Inventory list, filters, summary cards, and status helpers for the Inventory page.
// Remaining-amount math, purchase migrations, and the buy form stay in app.js.
// Public function names stay global after splice.

let inventoryTabFilter = 'all';
let inventorySearchQuery = '';
const inventorySelectedIds = new Set();
const inventoryListFilters = {
    substanceId: '',
    datePreset: 'all',
    dateStart: '',
    dateEnd: '',
    hasRemaining: '',
    hasCost: '',
    vapeOnly: false
};
let inventoryFiltersPanelOpen = false;
const INVENTORY_FILTERS_PANEL_KEY = 'recoveryTracker.inventoryFiltersPanel.v1';
const INVENTORY_FILTERS_STORAGE_KEY = 'recoveryTracker.inventoryFilters.v2';
function getPurchaseInventoryTab(purchase) {
    if (!purchase) return 'all';
    if (purchase.inventoryHidden) return 'hidden';
    if (purchaseIsPurchasedAsGift(purchase) || purchase.inventoryStatus === 'gifted') {
        return 'gifted';
    }
    if (isPurchaseEffectivelyDepleted(purchase)) {
        return 'depleted';
    }
    return 'active';
}
function purchaseMatchesInventorySearch(purchase, query, data = appData) {
    if (!query) return true;
    const q = query.toLowerCase();
    const sub = getSubstance(getPurchaseSubstanceId(purchase), data);
    const haystackParts = [
        purchase.store, purchase.location, purchase.notes, purchase.substanceName,
        sub?.name, purchase.paymentMethod,
        getPurchaseGiftSource(purchase), getPurchaseGiftRecipient(purchase)
    ];
    if (purchaseSupportsFlavor(purchase, data)) {
        haystackParts.push(getVapePurchaseFlavor(purchase));
    }
    const haystack = haystackParts.filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
}
function purchaseMatchesInventoryStatus(purchase, status = inventoryTabFilter) {
    const tab = getPurchaseInventoryTab(purchase);
    const normalized = normalizeInventoryStatusFilter(status);
    if (normalized === 'all') return true;
    if (normalized === 'history') return tab === 'depleted' || tab === 'gifted' || tab === 'hidden';
    return tab === normalized;
}
function purchaseMatchesInventoryFilters(purchase, filters = inventoryListFilters, data = appData) {
    if (filters.substanceId && getPurchaseSubstanceId(purchase) !== filters.substanceId) return false;
    const bounds = getInventoryDateFilterBounds(filters, data);
    const dateStr = typeof getPurchaseDateStr === 'function' ? getPurchaseDateStr(purchase) : purchase.date;
    if (!dateStrInShortcutRange(dateStr, bounds)) return false;
    if (filters.hasRemaining === 'yes' && getPurchaseRemainingAmount(purchase) <= INVENTORY_EPS) return false;
    if (filters.hasRemaining === 'no' && getPurchaseRemainingAmount(purchase) > INVENTORY_EPS) return false;
    const cost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    if (filters.hasCost === 'yes' && cost <= 0) return false;
    if (filters.hasCost === 'no' && cost > 0) return false;
    if (filters.vapeOnly && !isVapePuffPurchase(purchase, data)) return false;
    return true;
}
function getInventoryFilteredPurchases(substanceId, data = appData) {
    let list = [...(data.purchases || [])];
    if (substanceId && substanceId !== DASHBOARD_ALL) {
        list = list.filter(p => purchaseMatchesSubstance(p, substanceId, data));
    }
    if (inventoryTabFilter !== 'all') {
        list = list.filter(p => purchaseMatchesInventoryStatus(p, inventoryTabFilter));
    }
    if (inventorySearchQuery) {
        list = list.filter(p => purchaseMatchesInventorySearch(p, inventorySearchQuery, data));
    }
    list = list.filter(p => purchaseMatchesInventoryFilters(p, inventoryListFilters, data));
    if (purchaseHistorySort.colId === 'flavor' && substanceShowsPurchaseFlavor(substanceId)) {
        return list.sort((a, b) => comparePurchaseHistoryByFlavor(a, b, purchaseHistorySort.dir));
    }
    return list.sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
}
function comparePurchaseHistoryByFlavor(a, b, dir = 'asc') {
    const fa = getVapePurchaseFlavor(a).toLowerCase();
    const fb = getVapePurchaseFlavor(b).toLowerCase();
    const cmp = fa.localeCompare(fb, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
    return getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a);
}
function togglePurchaseHistoryFlavorSort() {
    if (purchaseHistorySort.colId === 'flavor') {
        purchaseHistorySort.dir = purchaseHistorySort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        purchaseHistorySort = { colId: 'flavor', dir: 'asc' };
    }
    renderPurchaseHistory(null);
}
function markPurchaseInventoryStatus(purchaseId, status, persist = true) {
    const purchase = findPurchase(purchaseId);
    if (!purchase) return false;
    if (purchaseIsPurchasedAsGift(purchase)) {
        applyPurchasedAsGiftInventoryState(purchase);
        purchase.updatedAt = new Date().toISOString();
        if (persist) {
            saveData(appData);
            refreshBuyTrackerRelatedViews();
        }
        return true;
    }
    const now = new Date().toISOString();
    if (status === 'active') {
        purchase.inventoryStatus = 'active';
        purchase.inventoryHidden = false;
        purchase.depletedAt = null;
        if (getPurchaseRemainingAmount(purchase) > INVENTORY_EPS) purchase.isDepleted = false;
    } else if (status === 'depleted') {
        purchase.inventoryStatus = 'depleted';
        purchase.isDepleted = true;
        purchase.depletedAt = now;
        purchase.remainingAmount = 0;
        if (isVapePuffPurchase(purchase)) purchase.remainingPuffs = 0;
    }
    purchase.updatedAt = now;
    if (persist) {
        saveData(appData);
        refreshBuyTrackerRelatedViews();
    }
    return true;
}
function setPurchaseHidden(purchaseId, hidden, persist = true) {
    const purchase = findPurchase(purchaseId);
    if (!purchase) return false;
    purchase.inventoryHidden = !!hidden;
    purchase.updatedAt = new Date().toISOString();
    if (persist) {
        saveData(appData);
        refreshBuyTrackerRelatedViews();
    }
    return true;
}
function isInventoryAllSubstancesFilter(selectedSubstanceId) {
    return !selectedSubstanceId || selectedSubstanceId === DASHBOARD_ALL;
}
function getInventorySubstanceFilterId() {
    return isSelectedAllSubstances() ? '' : selectedSubstanceId;
}
function syncInventorySubstanceFilterState() {
    inventoryListFilters.substanceId = getInventorySubstanceFilterId();
}
function getFilteredPurchases(purchases, selectedSubstanceId, selectedStatus = null, data = appData) {
    let list = [...(purchases || [])];
    if (!isInventoryAllSubstancesFilter(selectedSubstanceId)) {
        list = list.filter(p => purchaseMatchesSubstance(p, selectedSubstanceId, data));
    }
    if (selectedStatus) {
        list = list.filter(p => getPurchaseInventoryTab(p) === selectedStatus);
    }
    return list;
}
function getInventoryPurchaseEstimatedValue(purchase, data = appData) {
    const rem = getPurchaseRemainingDisplayAmount(purchase);
    const cpu = parseFloat(purchase.costPerUnit) || 0;
    const totalCost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    if (isVapePuffPurchase(purchase, data)) {
        if (cpu > 0) return rem * cpu;
        const starting = getVapeStartingPuffsLeft(purchase);
        return starting > 0 ? totalCost * (rem / starting) : 0;
    }
    return rem * cpu;
}
function getInventorySummary(selectedSubstanceId, data = appData, purchaseList = null) {
    const scope = purchaseList ?? getFilteredPurchases(data.purchases || [], selectedSubstanceId, null, data);
    const active = scope.filter(p => getPurchaseInventoryTab(p) === 'active');
    const depleted = scope.filter(p => getPurchaseInventoryTab(p) === 'depleted');
    const gifted = scope.filter(p => getPurchaseInventoryTab(p) === 'gifted');
    const hidden = scope.filter(p => getPurchaseInventoryTab(p) === 'hidden');

    let inventoryValue = 0;
    let totalRemaining = 0;
    let totalRemainingUnit = null;
    let vapePuffsLeft = 0;
    let vapeActiveCount = 0;
    let oldestActive = null;
    const remainingBySubstance = {};

    active.forEach(p => {
        const sid = getPurchaseSubstanceId(p);
        const rem = getPurchaseRemainingDisplayAmount(p);
        if (isVapePuffPurchase(p, data)) {
            vapePuffsLeft += rem;
            vapeActiveCount++;
        } else {
            totalRemaining += rem;
            remainingBySubstance[sid] = (remainingBySubstance[sid] || 0) + rem;
            if (!totalRemainingUnit) totalRemainingUnit = getPurchaseRemainingDisplayUnit(p);
        }
        inventoryValue += getInventoryPurchaseEstimatedValue(p, data);
        if (!oldestActive || getPurchaseDatetimeMs(p) < getPurchaseDatetimeMs(oldestActive)) {
            oldestActive = p;
        }
    });

    return {
        activeCount: active.length,
        depletedCount: depleted.length,
        giftedCount: gifted.length,
        hiddenCount: hidden.length,
        inventoryValue,
        totalRemaining,
        totalRemainingUnit,
        vapePuffsLeft,
        vapeActiveCount,
        oldestActive,
        remainingBySubstance
    };
}
function formatInventoryTotalRemainingValue(summary, selectedSubstanceId, data = appData) {
    if (isInventoryAllSubstancesFilter(selectedSubstanceId)) {
        const lines = Object.entries(summary.remainingBySubstance || {})
            .filter(([, amt]) => amt > INVENTORY_EPS)
            .map(([sid, amt]) => {
                const sub = getSubstance(sid, data);
                if (isXanaxSubstanceId(sid, data)) {
                    const sum = getXanaxTotalRemainingSummary(sid, data);
                    return `${sub?.name || sid}: ${formatAmount(sum.pills)} pills · ${formatAmount(sum.mg)} mg`;
                }
                if (isLsdSubstanceId(sid, data)) {
                    const sum = getLsdTotalRemainingSummary(sid, data);
                    return `${sub?.name || sid}: ${formatAmount(sum.tabs)} tabs / ${formatAmount(sum.ug)} ug`;
                }
                const unit = sub?.defaultUnit || 'units';
                return `${sub?.name || sid}: ${formatAmountWithUnit(amt, unit)}`;
            });
        return lines.length ? lines.join(' · ') : '—';
    }
    if (isXanaxSubstanceId(selectedSubstanceId, data)) {
        const sum = getXanaxTotalRemainingSummary(selectedSubstanceId, data);
        return sum.pills > INVENTORY_EPS || sum.mg > INVENTORY_EPS
            ? `${formatAmount(sum.pills)} pills · ${formatAmount(sum.mg)} mg`
            : '—';
    }
    if (isLsdSubstanceId(selectedSubstanceId, data)) {
        const sum = getLsdTotalRemainingSummary(selectedSubstanceId, data);
        return sum.tabs > INVENTORY_EPS || sum.ug > INVENTORY_EPS
            ? `${formatAmount(sum.tabs)} tabs / ${formatAmount(sum.ug)} ug`
            : '—';
    }
    const sub = getSubstance(selectedSubstanceId, data);
    const unit = sub?.defaultUnit || summary.totalRemainingUnit || 'units';
    return formatAmountWithUnit(summary.totalRemaining, unit);
}
function shouldShowVapeInventorySummaryCards(selectedSubstanceId) {
    return isInventoryAllSubstancesFilter(selectedSubstanceId)
        || (isNicotineSubstanceId(selectedSubstanceId) && !isInventoryAllSubstancesFilter(selectedSubstanceId));
}
function shouldShowTotalRemainingInventoryCard(selectedSubstanceId) {
    return isInventoryAllSubstancesFilter(selectedSubstanceId)
        || !isNicotineSubstanceId(selectedSubstanceId);
}
function formatNicotineInventorySummary(selectedSubstanceId, data = appData) {
    const purchases = (data.purchases || []).filter(p => purchaseMatchesSubstance(p, selectedSubstanceId, data));
    const stats = getNicotineInventoryAnalytics(purchases, data);
    const parts = [
        `Vape: ${stats.vapeActive} active, ${stats.vapeDepleted} depleted`,
        `Cigarettes: ${stats.cigarettePacks} active pack${stats.cigarettePacks === 1 ? '' : 's'}`,
        `Pouches: ${stats.pouches}`,
        `Gum: ${stats.gumPieces > 0 ? formatAmount(stats.gumPieces) : '0'}`,
        `Patches: ${stats.patches}`
    ];
    return parts.join(' · ');
}
function renderInventorySummaryCards() {
    const container = document.getElementById('inventory-summary-cards');
    if (!container) return;
    const selectedId = getInventorySubstanceFilterId();
    const statusScoped = getInventoryFilteredPurchases(selectedId || null);
    const m = getInventorySummary(selectedId || null, appData, statusScoped);
    const cur = getCurrencySymbol();

    const metaParts = [`Value <strong>${fmtSheetMoney(m.inventoryValue, cur)}</strong>`];

    if (shouldShowTotalRemainingInventoryCard(selectedId)) {
        const rem = formatInventoryTotalRemainingValue(m, selectedId);
        metaParts.push(`Remaining <strong>${rem}</strong>`);
    }
    if (isNicotineSubstanceId(selectedId)) {
        metaParts.push(`<span class="inventory-nicotine-summary">${formatNicotineInventorySummary(selectedId)}</span>`);
    }
    if (shouldShowVapeInventorySummaryCards(selectedId)) {
        metaParts.push(`Puffs <strong>${formatAmountWithUnit(m.vapePuffsLeft, 'puffs')}</strong>`);
        metaParts.push(`Vapes <strong>${m.vapeActiveCount}</strong>`);
    }

    container.innerHTML = `
        <div class="inventory-summary-compact">
            <div class="inventory-status-counts">
                <span class="inventory-count-pill"><span class="inventory-count-label">Active</span><strong>${m.activeCount}</strong></span>
                <span class="inventory-count-pill"><span class="inventory-count-label">Depleted</span><strong>${m.depletedCount}</strong></span>
                <span class="inventory-count-pill"><span class="inventory-count-label">Gifted</span><strong>${m.giftedCount || 0}</strong></span>
                <span class="inventory-count-pill"><span class="inventory-count-label">Hidden</span><strong>${m.hiddenCount}</strong></span>
            </div>
            <div class="inventory-summary-meta">${metaParts.join('<span class="inventory-meta-sep">·</span>')}</div>
        </div>`;
}
function getInventoryStatusFilterLabel() {
    switch (inventoryTabFilter) {
        case 'all': return 'Any status';
        case 'depleted': return 'Depleted';
        case 'gifted': return 'Gifted';
        case 'hidden': return 'Hidden';
        case 'history': return 'History';
        case 'active':
        default: return 'Active';
    }
}
function normalizeInventoryStatusFilter(value) {
    const status = value === 'stored' ? 'active' : (value === 'purchases' ? 'all' : (value || 'all'));
    return ['active', 'depleted', 'gifted', 'hidden', 'history', 'all'].includes(status) ? status : 'all';
}
function syncInventoryStatusFilterUI() {
    inventoryTabFilter = normalizeInventoryStatusFilter(inventoryTabFilter);
    const statusEl = document.getElementById('inventory-filter-status');
    if (statusEl && statusEl.value !== inventoryTabFilter) {
        statusEl.value = inventoryTabFilter;
    }
}
function countActiveInventoryFilters() {
    let count = 0;
    const preset = normalizeDateRangeShortcut(inventoryListFilters.datePreset);
    if (preset !== 'all') count++;
    if (inventoryListFilters.hasRemaining) count++;
    if (inventoryListFilters.hasCost) count++;
    if (inventoryListFilters.vapeOnly) count++;
    return count;
}
function hasActiveInventoryFilters() {
    return countActiveInventoryFilters() > 0;
}
function loadInventoryFiltersPanelState() {
    inventoryTabFilter = normalizeInventoryStatusFilter(inventoryTabFilter);
    try {
        const raw = localStorage.getItem(INVENTORY_FILTERS_STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            if (saved.status != null) inventoryTabFilter = normalizeInventoryStatusFilter(saved.status);
            if (typeof saved.search === 'string') inventorySearchQuery = saved.search;
            if (saved.dateStart != null) inventoryListFilters.dateStart = saved.dateStart;
            if (saved.dateEnd != null) inventoryListFilters.dateEnd = saved.dateEnd;
            if (saved.datePreset != null) {
                inventoryListFilters.datePreset = normalizeDateRangeShortcut(saved.datePreset);
            } else if (saved.dateStart || saved.dateEnd) {
                inventoryListFilters.datePreset = 'custom';
            }
            if (saved.hasRemaining != null) inventoryListFilters.hasRemaining = saved.hasRemaining;
            if (saved.hasCost != null) inventoryListFilters.hasCost = saved.hasCost;
            if (typeof saved.vapeOnly === 'boolean') inventoryListFilters.vapeOnly = saved.vapeOnly;
        }
        if (localStorage.getItem(INVENTORY_FILTERS_PANEL_KEY) === '1') {
            inventoryFiltersPanelOpen = true;
        }
    } catch (_) { /* ignore */ }
    if (hasActiveInventoryFilters()) inventoryFiltersPanelOpen = true;
    syncInventoryStatusFilterUI();
    const searchEl = document.getElementById('inventory-search');
    if (searchEl) searchEl.value = inventorySearchQuery;
    ['inventory-filter-date-start', 'inventory-filter-date-end',
        'inventory-filter-remaining', 'inventory-filter-cost'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'inventory-filter-date-start') el.value = inventoryListFilters.dateStart;
        else if (id === 'inventory-filter-date-end') el.value = inventoryListFilters.dateEnd;
        else if (id === 'inventory-filter-remaining') el.value = inventoryListFilters.hasRemaining;
        else if (id === 'inventory-filter-cost') el.value = inventoryListFilters.hasCost;
    });
    const vapeOnlyEl = document.getElementById('inventory-filter-vape-only');
    if (vapeOnlyEl) vapeOnlyEl.checked = inventoryListFilters.vapeOnly;
    syncInventoryDateShortcutButtons();
    syncInventoryCustomDateInputs();
}
function saveInventoryFiltersPanelState() {
    try {
        localStorage.setItem(INVENTORY_FILTERS_PANEL_KEY, inventoryFiltersPanelOpen ? '1' : '0');
    } catch (_) { /* ignore */ }
}
function saveInventoryFilterState() {
    saveInventoryFiltersPanelState();
    try {
        localStorage.setItem(INVENTORY_FILTERS_STORAGE_KEY, JSON.stringify({
            status: inventoryTabFilter,
            search: inventorySearchQuery,
            datePreset: inventoryListFilters.datePreset,
            dateStart: inventoryListFilters.dateStart,
            dateEnd: inventoryListFilters.dateEnd,
            hasRemaining: inventoryListFilters.hasRemaining,
            hasCost: inventoryListFilters.hasCost,
            vapeOnly: inventoryListFilters.vapeOnly
        }));
    } catch (_) { /* ignore */ }
}
function toggleInventoryFiltersPanel() {
    inventoryFiltersPanelOpen = !inventoryFiltersPanelOpen;
    saveInventoryFilterState();
    updateInventoryFiltersPanelUI();
}
function updateInventoryBulkBarUI() {
    const bar = document.getElementById('inventory-bulk-bar');
    const countEl = document.getElementById('inventory-bulk-count');
    const n = inventorySelectedIds.size;
    if (bar) bar.classList.toggle('hidden', n === 0);
    if (countEl) countEl.textContent = n ? `${n} selected` : '';
}
function renderInventoryFilterChips() {
    const container = document.getElementById('inventory-filter-chips');
    if (!container) return;
    const chips = [];
    if (inventorySearchQuery) {
        chips.push(`<span class="inventory-filter-chip">Search: ${escapeHtml(inventorySearchQuery)}</span>`);
    }
    const datePreset = normalizeDateRangeShortcut(inventoryListFilters.datePreset);
    if (datePreset !== 'all') {
        if (datePreset === 'custom' && (inventoryListFilters.dateStart || inventoryListFilters.dateEnd)) {
            const start = inventoryListFilters.dateStart ? formatDate(inventoryListFilters.dateStart) : '…';
            const end = inventoryListFilters.dateEnd ? formatDate(inventoryListFilters.dateEnd) : '…';
            chips.push(`<span class="inventory-filter-chip">Date: ${start}–${end}</span>`);
        } else {
            chips.push(`<span class="inventory-filter-chip">Date: ${escapeHtml(getDateRangeShortcutLabel(datePreset))}</span>`);
        }
    }
    if (inventoryTabFilter !== 'all') {
        chips.push(`<span class="inventory-filter-chip">Status: ${escapeHtml(getInventoryStatusFilterLabel())}</span>`);
    }
    if (inventoryListFilters.hasRemaining === 'yes') {
        chips.push('<span class="inventory-filter-chip">Remaining: Has remaining</span>');
    } else if (inventoryListFilters.hasRemaining === 'no') {
        chips.push('<span class="inventory-filter-chip">Remaining: No remaining</span>');
    }
    if (inventoryListFilters.hasCost === 'yes') {
        chips.push('<span class="inventory-filter-chip">Cost: Has cost</span>');
    } else if (inventoryListFilters.hasCost === 'no') {
        chips.push('<span class="inventory-filter-chip">Cost: No cost</span>');
    }
    if (inventoryListFilters.vapeOnly) {
        chips.push('<span class="inventory-filter-chip">Vape only</span>');
    }
    container.innerHTML = chips.join('');
    container.classList.toggle('hidden', !chips.length);
}
function updateInventoryFiltersPanelUI() {
    const panel = document.getElementById('inventory-filter-panel');
    const toggle = document.getElementById('inventory-filter-toggle');
    const countEl = document.getElementById('inventory-filter-count');
    panel?.classList.toggle('hidden', !inventoryFiltersPanelOpen);
    toggle?.classList.toggle('open', inventoryFiltersPanelOpen);
    const count = countActiveInventoryFilters();
    if (countEl) countEl.textContent = count > 0 ? `(${count})` : '';
    renderInventoryFilterChips();
    syncInventorySearchPlaceholder();
}
function clearInventoryFilters() {
    inventorySearchQuery = '';
    inventoryListFilters.datePreset = 'all';
    inventoryListFilters.dateStart = '';
    inventoryListFilters.dateEnd = '';
    inventoryListFilters.hasRemaining = '';
    inventoryListFilters.hasCost = '';
    inventoryListFilters.vapeOnly = false;
    inventoryTabFilter = 'all';
    inventoryFiltersPanelOpen = false;
    const searchEl = document.getElementById('inventory-search');
    if (searchEl) searchEl.value = '';
    ['inventory-filter-date-start', 'inventory-filter-date-end',
        'inventory-filter-remaining', 'inventory-filter-cost'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const vapeOnlyEl = document.getElementById('inventory-filter-vape-only');
    if (vapeOnlyEl) vapeOnlyEl.checked = false;
    syncInventorySubstanceFilterState();
    syncInventoryStatusFilterUI();
    syncInventoryDateShortcutButtons();
    syncInventoryCustomDateInputs();
    saveInventoryFilterState();
    renderPurchaseHistory(null);
    renderInventorySummaryCards();
    updateInventoryFiltersPanelUI();
}
function syncInventoryDateShortcutButtons(preset = inventoryListFilters.datePreset) {
    const next = normalizeDateRangeShortcut(preset);
    document.querySelectorAll('[data-inv-date]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-inv-date') === next);
    });
}
function syncInventoryCustomDateInputs() {
    const wrap = document.getElementById('inventory-custom-dates');
    const custom = normalizeDateRangeShortcut(inventoryListFilters.datePreset) === 'custom';
    wrap?.classList.toggle('hidden', !custom);
    const startEl = document.getElementById('inventory-filter-date-start');
    const endEl = document.getElementById('inventory-filter-date-end');
    if (startEl) startEl.value = inventoryListFilters.dateStart || '';
    if (endEl) endEl.value = inventoryListFilters.dateEnd || '';
}
function setInventoryDateFilter(preset) {
    inventoryListFilters.datePreset = normalizeDateRangeShortcut(preset);
    if (inventoryListFilters.datePreset !== 'custom') {
        inventoryListFilters.dateStart = '';
        inventoryListFilters.dateEnd = '';
    }
    syncInventoryDateShortcutButtons();
    syncInventoryCustomDateInputs();
    saveInventoryFilterState();
    renderPurchaseHistory(null);
    renderInventorySummaryCards();
    updateInventoryFiltersPanelUI();
}
function applyInventoryCustomDates() {
    inventoryListFilters.datePreset = 'custom';
    inventoryListFilters.dateStart = document.getElementById('inventory-filter-date-start')?.value || '';
    inventoryListFilters.dateEnd = document.getElementById('inventory-filter-date-end')?.value || '';
    syncInventoryDateShortcutButtons('custom');
    syncInventoryCustomDateInputs();
    saveInventoryFilterState();
    renderPurchaseHistory(null);
    renderInventorySummaryCards();
    updateInventoryFiltersPanelUI();
}
function applyInventorySearchFilters() {
    inventorySearchQuery = document.getElementById('inventory-search')?.value?.trim() || '';
    const start = document.getElementById('inventory-filter-date-start')?.value || '';
    const end = document.getElementById('inventory-filter-date-end')?.value || '';
    if (normalizeDateRangeShortcut(inventoryListFilters.datePreset) === 'custom' || start || end) {
        inventoryListFilters.dateStart = start;
        inventoryListFilters.dateEnd = end;
        if (start || end) inventoryListFilters.datePreset = 'custom';
    }
    inventoryTabFilter = normalizeInventoryStatusFilter(
        document.getElementById('inventory-filter-status')?.value || 'all'
    );
    inventoryListFilters.hasRemaining = document.getElementById('inventory-filter-remaining')?.value || '';
    inventoryListFilters.hasCost = document.getElementById('inventory-filter-cost')?.value || '';
    inventoryListFilters.vapeOnly = !!document.getElementById('inventory-filter-vape-only')?.checked;
    syncInventorySubstanceFilterState();
    syncInventoryStatusFilterUI();
    syncInventoryDateShortcutButtons();
    syncInventoryCustomDateInputs();
    if (hasActiveInventoryFilters()) inventoryFiltersPanelOpen = true;
    saveInventoryFilterState();
    renderPurchaseHistory(null);
    renderInventorySummaryCards();
    updateInventoryFiltersPanelUI();
}
function runInventoryBulkAction(action) {
    const ids = [...inventorySelectedIds];
    if (!ids.length) {
        alert('Select at least one purchase.');
        return;
    }
    if (action === 'delete' && !confirm(`Delete ${ids.length} purchase(s)?`)) return;
    createAutoBackup(`before-inventory-bulk-${action}`);
    ids.forEach(id => {
        if (action === 'active') markPurchaseInventoryStatus(id, 'active', false);
        else if (action === 'depleted') markPurchaseInventoryStatus(id, 'depleted', false);
        else if (action === 'hide') setPurchaseHidden(id, true, false);
        else if (action === 'unhide') setPurchaseHidden(id, false, false);
        else if (action === 'recalculate') recalculatePurchaseRemaining(id);
        else if (action === 'delete') {
            appData.purchases = (appData.purchases || []).filter(p => !purchaseIdEquals(p.id, id));
        }
    });
    saveData(appData);
    inventorySelectedIds.clear();
    updateInventoryBulkBarUI();
    refreshBuyTrackerRelatedViews();
}
function onInventorySubstanceChange() {
    const id = document.getElementById('inventory-substance')?.value;
    if (!id) return;
    setSelectedSubstanceId(id, { source: 'inventory-substance' });
}
function getInventoryDateFilterBounds(filters = inventoryListFilters, data = appData) {
    return getDateRangeShortcutBounds(filters.datePreset || 'all', {
        customStart: filters.dateStart,
        customEnd: filters.dateEnd,
        data
    });
}
function getInventorySearchPlaceholder(substanceId = getInventorySubstanceFilterId()) {
    return substanceShowsPurchaseFlavor(substanceId)
        ? 'Search store, notes, flavor…'
        : 'Search store, notes…';
}
function syncInventorySearchPlaceholder(substanceId = getInventorySubstanceFilterId()) {
    const el = document.getElementById('inventory-search');
    if (el) el.placeholder = getInventorySearchPlaceholder(substanceId);
}
// ——— END Inventory page (splice boundary — do not remove) ———
