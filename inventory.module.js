// ——— Inventory page (combined table filters + summary) ———
// Inventory list, filters, summary cards, and status helpers for the Inventory page.
// Remaining-amount math, purchase migrations, and the buy form stay in app.js.
// Public function names stay global after splice.

let inventoryTabFilter = 'all';
let inventorySearchQuery = '';
const inventorySelectedIds = new Set();
const INVENTORY_RANGE_FILTER_KEYS = Object.freeze([
    'totalCostMin', 'totalCostMax',
    'costPerUnitMin', 'costPerUnitMax',
    'qtyBoughtMin', 'qtyBoughtMax',
    'qtyRemainingMin', 'qtyRemainingMax',
    'amountUsedMin', 'amountUsedMax',
    'pctUsedMin', 'pctUsedMax',
    'purchaseDateMin', 'purchaseDateMax'
]);

const inventoryListFilters = {
    substanceId: '',
    datePreset: 'all',
    dateStart: '',
    dateEnd: '',
    hasRemaining: '',
    hasCost: '',
    acquisitionType: '',
    totalCostMin: '',
    totalCostMax: '',
    costPerUnitMin: '',
    costPerUnitMax: '',
    qtyBoughtMin: '',
    qtyBoughtMax: '',
    qtyRemainingMin: '',
    qtyRemainingMax: '',
    amountUsedMin: '',
    amountUsedMax: '',
    pctUsedMin: '',
    pctUsedMax: '',
    purchaseDateMin: '',
    purchaseDateMax: ''
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
function getPurchaseFilterTotalCost(purchase) {
    const cost = parseFloat(typeof getPurchaseTotalCost === 'function' ? getPurchaseTotalCost(purchase) : purchase?.totalCost);
    return Number.isFinite(cost) ? cost : null;
}

function getPurchaseFilterCostPerUnit(purchase) {
    const cpu = parseFloat(purchase?.costPerUnit);
    if (Number.isFinite(cpu)) return cpu;
    const cost = getPurchaseFilterTotalCost(purchase);
    const qty = typeof getPurchaseQuantityBought === 'function'
        ? getPurchaseQuantityBought(purchase)
        : parseFloat(purchase?.quantityBought);
    if (cost == null || !Number.isFinite(qty) || qty <= 0) return null;
    return cost / qty;
}

function getPurchaseFilterQuantityBought(purchase) {
    const qty = typeof getPurchaseQuantityBought === 'function'
        ? getPurchaseQuantityBought(purchase)
        : parseFloat(purchase?.quantityBought ?? purchase?.quantity);
    return Number.isFinite(qty) ? qty : null;
}

function getPurchaseFilterQuantityRemaining(purchase) {
    const rem = typeof getPurchaseRemainingDisplayAmount === 'function'
        ? getPurchaseRemainingDisplayAmount(purchase)
        : (typeof getPurchaseRemainingAmount === 'function'
            ? getPurchaseRemainingAmount(purchase)
            : parseFloat(purchase?.remainingAmount));
    return rem == null || !Number.isFinite(rem) ? null : rem;
}

function getPurchaseFilterAmountUsed(purchase) {
    const bought = getPurchaseFilterQuantityBought(purchase);
    const remaining = getPurchaseFilterQuantityRemaining(purchase);
    if (bought == null || remaining == null) return null;
    return Math.max(0, bought - remaining);
}

function getPurchaseFilterPercentUsed(purchase) {
    if (typeof getPurchasePercentUsed === 'function') {
        const pct = getPurchasePercentUsed(purchase);
        return Number.isFinite(pct) ? pct : null;
    }
    const bought = getPurchaseFilterQuantityBought(purchase);
    const used = getPurchaseFilterAmountUsed(purchase);
    if (bought == null || !(bought > 0) || used == null) return null;
    return Math.round((used / bought) * 100);
}

function getInventoryFilterUnitLabel(selectedSubstanceId = getInventorySubstanceFilterId()) {
    if (!selectedSubstanceId) return 'record unit';
    if (typeof getSubstancePrimaryUnit === 'function') {
        return getSubstancePrimaryUnit(selectedSubstanceId) || 'units';
    }
    const sub = typeof getSubstance === 'function' ? getSubstance(selectedSubstanceId) : null;
    return sub?.primaryUnit || sub?.defaultUnit || 'units';
}

function purchaseMatchesInventoryRangeFilters(purchase, filters = inventoryListFilters) {
    const parse = typeof parseOptionalFilterNumber === 'function'
        ? parseOptionalFilterNumber
        : (value) => {
            if (value == null || value === '') return null;
            const n = parseFloat(value);
            return Number.isFinite(n) ? n : null;
        };
    const matches = typeof valueMatchesMinMax === 'function'
        ? valueMatchesMinMax
        : (value, min, max) => {
            if (min == null && max == null) return true;
            if (value == null || !Number.isFinite(value)) return false;
            if (min != null && value < min) return false;
            if (max != null && value > max) return false;
            return true;
        };
    if (!matches(getPurchaseFilterTotalCost(purchase), parse(filters.totalCostMin), parse(filters.totalCostMax))) return false;
    if (!matches(getPurchaseFilterCostPerUnit(purchase), parse(filters.costPerUnitMin), parse(filters.costPerUnitMax))) return false;
    if (!matches(getPurchaseFilterQuantityBought(purchase), parse(filters.qtyBoughtMin), parse(filters.qtyBoughtMax))) return false;
    if (!matches(getPurchaseFilterQuantityRemaining(purchase), parse(filters.qtyRemainingMin), parse(filters.qtyRemainingMax))) return false;
    if (!matches(getPurchaseFilterAmountUsed(purchase), parse(filters.amountUsedMin), parse(filters.amountUsedMax))) return false;
    if (!matches(getPurchaseFilterPercentUsed(purchase), parse(filters.pctUsedMin), parse(filters.pctUsedMax))) return false;
    const dateStr = typeof getPurchaseDateStr === 'function' ? getPurchaseDateStr(purchase) : purchase?.date;
    if (filters.purchaseDateMin && (!dateStr || dateStr < filters.purchaseDateMin)) return false;
    if (filters.purchaseDateMax && (!dateStr || dateStr > filters.purchaseDateMax)) return false;
    return true;
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
    if (filters.acquisitionType) {
        const acq = typeof getPurchaseAcquisitionType === 'function'
            ? getPurchaseAcquisitionType(purchase)
            : (purchase?.acquisitionType || 'purchased');
        if (acq !== filters.acquisitionType) return false;
    }
    if (!purchaseMatchesInventoryRangeFilters(purchase, filters)) return false;
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
    if (inventoryListFilters.acquisitionType) count++;
    if (inventoryListFilters.totalCostMin !== '' || inventoryListFilters.totalCostMax !== '') count++;
    if (inventoryListFilters.costPerUnitMin !== '' || inventoryListFilters.costPerUnitMax !== '') count++;
    if (inventoryListFilters.qtyBoughtMin !== '' || inventoryListFilters.qtyBoughtMax !== '') count++;
    if (inventoryListFilters.qtyRemainingMin !== '' || inventoryListFilters.qtyRemainingMax !== '') count++;
    if (inventoryListFilters.amountUsedMin !== '' || inventoryListFilters.amountUsedMax !== '') count++;
    if (inventoryListFilters.pctUsedMin !== '' || inventoryListFilters.pctUsedMax !== '') count++;
    if (inventoryListFilters.purchaseDateMin || inventoryListFilters.purchaseDateMax) count++;
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
            if (saved.acquisitionType != null) inventoryListFilters.acquisitionType = saved.acquisitionType;
            INVENTORY_RANGE_FILTER_KEYS.forEach(key => {
                if (saved[key] != null) inventoryListFilters[key] = saved[key];
            });
            // Legacy vapeOnly is ignored so old saved filters still load.
        }
        if (localStorage.getItem(INVENTORY_FILTERS_PANEL_KEY) === '1') {
            inventoryFiltersPanelOpen = true;
        }
    } catch (_) { /* ignore */ }
    if (hasActiveInventoryFilters()) inventoryFiltersPanelOpen = true;
    syncInventoryStatusFilterUI();
    const searchEl = document.getElementById('inventory-search');
    if (searchEl) searchEl.value = inventorySearchQuery;
    syncInventoryFilterInputsFromState();
    syncInventoryDateShortcutButtons();
    syncInventoryCustomDateInputs();
    syncInventoryFilterUnitLabels();
}
function saveInventoryFiltersPanelState() {
    try {
        localStorage.setItem(INVENTORY_FILTERS_PANEL_KEY, inventoryFiltersPanelOpen ? '1' : '0');
    } catch (_) { /* ignore */ }
}
function saveInventoryFilterState() {
    saveInventoryFiltersPanelState();
    try {
        const payload = {
            status: inventoryTabFilter,
            search: inventorySearchQuery,
            datePreset: inventoryListFilters.datePreset,
            dateStart: inventoryListFilters.dateStart,
            dateEnd: inventoryListFilters.dateEnd,
            hasRemaining: inventoryListFilters.hasRemaining,
            hasCost: inventoryListFilters.hasCost,
            acquisitionType: inventoryListFilters.acquisitionType
        };
        INVENTORY_RANGE_FILTER_KEYS.forEach(key => {
            payload[key] = inventoryListFilters[key];
        });
        localStorage.setItem(INVENTORY_FILTERS_STORAGE_KEY, JSON.stringify(payload));
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
    if (inventoryListFilters.acquisitionType) {
        const labels = {
            purchased: 'Purchased',
            gift_received: 'Gift Received',
            purchased_as_gift: 'Purchased as Gift',
            other_adjustment: 'Adjustment'
        };
        chips.push(`<span class="inventory-filter-chip">Acquisition: ${escapeHtml(labels[inventoryListFilters.acquisitionType] || inventoryListFilters.acquisitionType)}</span>`);
    }
    const unit = getInventoryFilterUnitLabel();
    const rangeChip = (label, min, max, suffix = '') => {
        const hasMin = min != null && min !== '';
        const hasMax = max != null && max !== '';
        if (!hasMin && !hasMax) return '';
        let range;
        if (hasMin && hasMax) range = `${min}–${max}`;
        else if (hasMin) range = `≥ ${min}`;
        else range = `≤ ${max}`;
        return `<span class="inventory-filter-chip">${escapeHtml(label)}: ${escapeHtml(range)}${suffix ? ` ${escapeHtml(suffix)}` : ''}</span>`;
    };
    const totalCostChip = rangeChip('Total Cost', inventoryListFilters.totalCostMin, inventoryListFilters.totalCostMax);
    if (totalCostChip) chips.push(totalCostChip);
    const cpuChip = rangeChip('Cost Per Unit', inventoryListFilters.costPerUnitMin, inventoryListFilters.costPerUnitMax);
    if (cpuChip) chips.push(cpuChip);
    const boughtChip = rangeChip('Quantity Bought', inventoryListFilters.qtyBoughtMin, inventoryListFilters.qtyBoughtMax, unit);
    if (boughtChip) chips.push(boughtChip);
    const remainingChip = rangeChip('Quantity Remaining', inventoryListFilters.qtyRemainingMin, inventoryListFilters.qtyRemainingMax, unit);
    if (remainingChip) chips.push(remainingChip);
    const usedChip = rangeChip('Amount used', inventoryListFilters.amountUsedMin, inventoryListFilters.amountUsedMax, unit);
    if (usedChip) chips.push(usedChip);
    const pctChip = rangeChip('Percentage used', inventoryListFilters.pctUsedMin, inventoryListFilters.pctUsedMax, '%');
    if (pctChip) chips.push(pctChip);
    const purchaseDateChip = rangeChip('Purchase Date', inventoryListFilters.purchaseDateMin, inventoryListFilters.purchaseDateMax);
    if (purchaseDateChip) chips.push(purchaseDateChip);
    container.innerHTML = chips.join('');
    container.classList.toggle('hidden', !chips.length);
}
function syncInventoryFilterUnitLabels() {
    const unit = getInventoryFilterUnitLabel();
    const text = unit ? `(${unit})` : '';
    ['inventory-filter-bought-unit', 'inventory-filter-remaining-unit', 'inventory-filter-used-unit']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });
}

function syncInventoryFilterInputsFromState() {
    const map = {
        'inventory-filter-date-start': 'dateStart',
        'inventory-filter-date-end': 'dateEnd',
        'inventory-filter-remaining': 'hasRemaining',
        'inventory-filter-cost': 'hasCost',
        'inventory-filter-acquisition': 'acquisitionType',
        'inventory-filter-total-cost-min': 'totalCostMin',
        'inventory-filter-total-cost-max': 'totalCostMax',
        'inventory-filter-cost-per-unit-min': 'costPerUnitMin',
        'inventory-filter-cost-per-unit-max': 'costPerUnitMax',
        'inventory-filter-qty-bought-min': 'qtyBoughtMin',
        'inventory-filter-qty-bought-max': 'qtyBoughtMax',
        'inventory-filter-qty-remaining-min': 'qtyRemainingMin',
        'inventory-filter-qty-remaining-max': 'qtyRemainingMax',
        'inventory-filter-amount-used-min': 'amountUsedMin',
        'inventory-filter-amount-used-max': 'amountUsedMax',
        'inventory-filter-pct-used-min': 'pctUsedMin',
        'inventory-filter-pct-used-max': 'pctUsedMax',
        'inventory-filter-purchase-min': 'purchaseDateMin',
        'inventory-filter-purchase-max': 'purchaseDateMax'
    };
    Object.entries(map).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.value = inventoryListFilters[key] ?? '';
    });
}

function updateInventoryFiltersPanelUI() {
    const panel = document.getElementById('inventory-filter-panel');
    const toggle = document.getElementById('inventory-filter-toggle');
    const countEl = document.getElementById('inventory-filter-count');
    panel?.classList.toggle('hidden', !inventoryFiltersPanelOpen);
    toggle?.classList.toggle('open', inventoryFiltersPanelOpen);
    const count = countActiveInventoryFilters();
    if (countEl) countEl.textContent = count > 0 ? `(${count})` : '';
    syncInventoryFilterUnitLabels();
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
    inventoryListFilters.acquisitionType = '';
    INVENTORY_RANGE_FILTER_KEYS.forEach(key => { inventoryListFilters[key] = ''; });
    inventoryTabFilter = 'all';
    inventoryFiltersPanelOpen = false;
    const searchEl = document.getElementById('inventory-search');
    if (searchEl) searchEl.value = '';
    syncInventoryFilterInputsFromState();
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
    inventoryListFilters.acquisitionType = document.getElementById('inventory-filter-acquisition')?.value || '';
    inventoryListFilters.totalCostMin = document.getElementById('inventory-filter-total-cost-min')?.value ?? '';
    inventoryListFilters.totalCostMax = document.getElementById('inventory-filter-total-cost-max')?.value ?? '';
    inventoryListFilters.costPerUnitMin = document.getElementById('inventory-filter-cost-per-unit-min')?.value ?? '';
    inventoryListFilters.costPerUnitMax = document.getElementById('inventory-filter-cost-per-unit-max')?.value ?? '';
    inventoryListFilters.qtyBoughtMin = document.getElementById('inventory-filter-qty-bought-min')?.value ?? '';
    inventoryListFilters.qtyBoughtMax = document.getElementById('inventory-filter-qty-bought-max')?.value ?? '';
    inventoryListFilters.qtyRemainingMin = document.getElementById('inventory-filter-qty-remaining-min')?.value ?? '';
    inventoryListFilters.qtyRemainingMax = document.getElementById('inventory-filter-qty-remaining-max')?.value ?? '';
    inventoryListFilters.amountUsedMin = document.getElementById('inventory-filter-amount-used-min')?.value ?? '';
    inventoryListFilters.amountUsedMax = document.getElementById('inventory-filter-amount-used-max')?.value ?? '';
    inventoryListFilters.pctUsedMin = document.getElementById('inventory-filter-pct-used-min')?.value ?? '';
    inventoryListFilters.pctUsedMax = document.getElementById('inventory-filter-pct-used-max')?.value ?? '';
    inventoryListFilters.purchaseDateMin = document.getElementById('inventory-filter-purchase-min')?.value ?? '';
    inventoryListFilters.purchaseDateMax = document.getElementById('inventory-filter-purchase-max')?.value ?? '';
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
