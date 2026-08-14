// ——— Recovery Tracker layout redesign ———
// Presentation-only reorganization. Reuses the existing calculation layer.
// Does not reset data, duplicate totals, or remove working features.

const LAYOUT_INVENTORY_VIEWS = Object.freeze(['active', 'purchases', 'history']);
const LAYOUT_TAPER_WORKSPACE_VIEWS = Object.freeze(['weekly', 'purchases', 'details']);
const LAYOUT_SETTINGS_CATEGORIES = Object.freeze(['substances', 'data', 'appearance', 'advanced', 'about']);
const LAYOUT_APP_VERSION = '2.0';

let layoutTaperWorkspaceView = 'weekly';
let layoutSettingsCategory = 'substances';
let layoutInventoryView = 'active';
let layoutHooksInstalled = false;

function escapeLayoutHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getLayoutSelectedSubstanceId() {
    if (typeof selectedSubstanceId !== 'undefined' && selectedSubstanceId) return selectedSubstanceId;
    if (typeof getSelectedDashboardSubstance === 'function') return getSelectedDashboardSubstance();
    return 'all';
}

function isLayoutAllSubstances(id = getLayoutSelectedSubstanceId()) {
    return !id || id === 'all' || (typeof DASHBOARD_ALL !== 'undefined' && id === DASHBOARD_ALL);
}

function applyLayoutPageClass() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('layout-redesign');
    document.body?.classList.add('layout-redesign');
}

function syncLayoutSidebarNav(tabId) {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.app-sidebar .nav-btn, .bottom-nav .nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
}

function populateLayoutSubstanceSelect() {
    const select = document.getElementById('sidebar-substance');
    if (!select || typeof getActiveSubstances !== 'function') return;
    const current = getLayoutSelectedSubstanceId();
    const substances = getActiveSubstances();
    const allValue = typeof DASHBOARD_ALL !== 'undefined' ? DASHBOARD_ALL : 'all';
    const options = [`<option value="${escapeLayoutHtml(allValue)}">All substances</option>`]
        .concat(substances.map(sub => {
            const name = typeof getSubstanceDisplayName === 'function'
                ? getSubstanceDisplayName(sub)
                : (sub.name || sub.id);
            return `<option value="${escapeLayoutHtml(sub.id)}">${escapeLayoutHtml(name)}</option>`;
        }));
    select.innerHTML = options.join('');
    if ([...select.options].some(o => o.value === current)) select.value = current;
}

function onSidebarSubstanceChange() {
    const id = document.getElementById('sidebar-substance')?.value;
    if (!id) return;
    if (typeof setSelectedSubstanceId === 'function') {
        setSelectedSubstanceId(id, { source: 'sidebar-substance' });
    }
    if (typeof setSelectedDashboardSubstance === 'function') {
        try { setSelectedDashboardSubstance(id); } catch (_) { /* ignore */ }
    }
    renderTodayAtAGlance();
    syncLayoutSubstanceSelectors();
}

function syncLayoutSubstanceSelectors() {
    populateLayoutSubstanceSelect();
    const current = getLayoutSelectedSubstanceId();
    ['use-log-substance', 'inventory-substance', 'taper-substance', 'stats-substance', 'dashboard-substance']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el && [...el.options].some(o => o.value === current)) el.value = current;
        });
}

function openLayoutLogUse() {
    if (typeof switchTab === 'function') switchTab('use-log-tab');
    expandLayoutSection('useLogForm');
    document.getElementById('use-log-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openLayoutAddPurchase() {
    if (typeof switchTab === 'function') switchTab('buy-tracker-tab');
    expandLayoutSection('purchaseForm');
    if (typeof openBuyTrackerModal === 'function') openBuyTrackerModal();
    document.getElementById('buy-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openLayoutAddInventory() {
    openLayoutAddPurchase();
}

function openLayoutAddAdjustment() {
    if (typeof openRecoveryQuickAction === 'function') openRecoveryQuickAction('adjustment');
    else {
        if (typeof switchTab === 'function') switchTab('use-log-tab');
        if (typeof selectUseEntryType === 'function') selectUseEntryType('gift_adjustment');
        if (typeof setUseTransactionType === 'function') setUseTransactionType('inventory_adjustment');
    }
    expandLayoutSection('useLogForm');
}

function openLayoutCalendar() {
    if (typeof switchTab === 'function') switchTab('insights-calendar-tab');
    if (typeof setInsightsCalendarView === 'function') setInsightsCalendarView('calendar');
}

function openLayoutProgress() {
    if (typeof switchTab === 'function') switchTab('insights-calendar-tab');
    if (typeof setInsightsCalendarView === 'function') setInsightsCalendarView('overview');
}

function openLayoutExport() {
    if (typeof switchTab === 'function') switchTab('settings-tab');
    setLayoutSettingsCategory('data');
    expandLayoutSection('settingsBackup');
}

function expandLayoutSection(sectionKey) {
    if (typeof document === 'undefined') return;
    const section = document.querySelector(`.collapsible-section[data-section="${sectionKey}"]`);
    if (!section) return;
    section.classList.remove('collapsed');
    const btn = section.querySelector('.section-toggle');
    const chevron = section.querySelector('.chevron');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (chevron) chevron.textContent = '⌄';
    if (typeof appData !== 'undefined' && appData?.settings?.collapsedSections) {
        appData.settings.collapsedSections[sectionKey] = false;
    }
}

function collapseLayoutSection(sectionKey) {
    const section = document.querySelector(`.collapsible-section[data-section="${sectionKey}"]`);
    if (!section) return;
    section.classList.add('collapsed');
    const btn = section.querySelector('.section-toggle');
    const chevron = section.querySelector('.chevron');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (chevron) chevron.textContent = '›';
}

function formatLayoutMoney(amount) {
    const cur = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$';
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${cur}0.00`;
    return `${cur}${n.toFixed(2)}`;
}

function getLayoutStatusSnapshot(data = appData) {
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : '';
    const monthStart = typeof getMonthStartDateStr === 'function' ? getMonthStartDateStr(today) : today.slice(0, 7) + '-01';
    const selectedId = getLayoutSelectedSubstanceId();
    const all = isLayoutAllSubstances(selectedId);
    const substances = typeof getActiveSubstances === 'function' ? getActiveSubstances(data) : (data.substances || []);
    const scoped = all ? substances : substances.filter(s => s.id === selectedId);

    let activeItems = 0;
    let spentMonth = 0;
    let lastPurchase = null;
    let lastUse = null;
    let streakDays = 0;
    let taperLabel = 'No active taper';

    (data.purchases || []).forEach(p => {
        const sid = typeof getPurchaseSubstanceId === 'function' ? getPurchaseSubstanceId(p) : p.substanceId;
        if (!all && sid !== selectedId) return;
        if (typeof getPurchaseInventoryTab === 'function' && getPurchaseInventoryTab(p) === 'active') activeItems += 1;
        const date = typeof getPurchaseDateStr === 'function' ? getPurchaseDateStr(p) : p.date;
        if (date && date >= monthStart && date <= today && (!typeof purchaseCountsTowardSpend || purchaseCountsTowardSpend(p))) {
            const amt = typeof getPurchaseSpendAmount === 'function' ? getPurchaseSpendAmount(p) : (parseFloat(p.totalCost) || 0);
            spentMonth += amt || 0;
        }
        if (!lastPurchase || (typeof getPurchaseDatetimeMs === 'function' && getPurchaseDatetimeMs(p) > getPurchaseDatetimeMs(lastPurchase))) {
            lastPurchase = p;
        }
    });

    scoped.forEach(sub => {
        const use = typeof getLastUseForSubstance === 'function' ? getLastUseForSubstance(sub.id) : null;
        if (use && (!lastUse || (typeof getLogDatetimeMs === 'function' && getLogDatetimeMs(use) > getLogDatetimeMs(lastUse)))) {
            lastUse = use;
        }
        if (typeof computeRecoveryStreakDays === 'function') {
            const streak = computeRecoveryStreakDays(sub.id);
            if ((streak?.days || 0) > streakDays) streakDays = streak.days;
        }
        if (typeof getPrimaryTaperPlan === 'function') {
            const plan = getPrimaryTaperPlan(sub.id, data);
            if (plan && (plan.status === 'active' || !plan.archived)) {
                taperLabel = plan.name || 'Active plan';
            }
        }
    });

    let timeSince = '—';
    if (lastUse && typeof getLogDatetimeMs === 'function') {
        const ms = Date.now() - getLogDatetimeMs(lastUse);
        if (Number.isFinite(ms) && ms >= 0) {
            const hours = ms / 36e5;
            if (typeof formatBreakFromHours === 'function') timeSince = formatBreakFromHours(hours);
            else if (hours < 24) timeSince = `${Math.floor(hours)}h`;
            else timeSince = `${Math.floor(hours / 24)}d`;
        }
    }

    let lastPurchaseLabel = 'No purchase';
    if (lastPurchase) {
        lastPurchaseLabel = typeof formatDate === 'function'
            ? formatDate(typeof getPurchaseDateStr === 'function' ? getPurchaseDateStr(lastPurchase) : lastPurchase.date)
            : (lastPurchase.date || '—');
    }

    return {
        activeItems,
        spentMonth,
        taperLabel,
        timeSince,
        lastPurchaseLabel,
        streakDays
    };
}

function getLayoutTodayActivityLabel(card = {}) {
    const unit = String(card.unit || card.usedLabel || '').toLowerCase();
    const name = String(card.name || '').toLowerCase();
    const id = String(card.substanceId || '').toLowerCase();
    const haystack = `${unit} ${name} ${id}`;
    if (haystack.includes('puff') || haystack.includes('nicotine')) return 'puffs today';
    if (haystack.includes('lsd') || haystack.includes('tab') || haystack.includes('µg') || haystack.includes('ug')) {
        return 'tabs / µg today';
    }
    if (haystack.includes('xanax') || haystack.includes('alprazolam') || haystack.includes('pill')) {
        return 'pills / mg today';
    }
    return 'used today';
}

function getLayoutTodayCards(data = appData) {
    const substances = typeof getActiveSubstances === 'function'
        ? getActiveSubstances(data)
        : (data?.substances || []).filter(s => s && s.active !== false);
    if (typeof buildSimpleTodayCard === 'function') {
        return substances.map(sub => buildSimpleTodayCard(sub, data));
    }
    if (typeof buildSimpleHomeDataset === 'function') {
        return buildSimpleHomeDataset(data).cards || [];
    }
    return [];
}

function renderTodayAtAGlance(data = appData) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('today-glance');
    if (!root) return;

    const cards = getLayoutTodayCards(data);
    const status = getLayoutStatusSnapshot(data);

    const todayCards = cards.length
        ? cards.map(card => `
            <article class="glance-today-card" data-substance-id="${escapeLayoutHtml(card.substanceId)}">
                <h3>${escapeLayoutHtml(card.name)}</h3>
                <p class="glance-today-amount">${escapeLayoutHtml(card.usedLabel)}</p>
                <p class="glance-today-label">${escapeLayoutHtml(getLayoutTodayActivityLabel(card))}</p>
            </article>`)
        : `<p class="empty-hint">No substances to show yet. Add one in Settings.</p>`;

    root.innerHTML = `
        <section class="layout-section" aria-labelledby="glance-today-heading">
            <h3 id="glance-today-heading" class="layout-section-title visually-hidden">Today</h3>
            <div class="glance-today-grid">${todayCards}</div>
        </section>
        <section class="layout-section" aria-labelledby="glance-status-heading">
            <h3 id="glance-status-heading" class="layout-section-title visually-hidden">Current status</h3>
            <div class="glance-status-grid">
                <article class="glance-status-card"><span>Active Inventory</span><strong>${status.activeItems}</strong></article>
                <article class="glance-status-card"><span>Spending This Month</span><strong>${escapeLayoutHtml(formatLayoutMoney(status.spentMonth))}</strong></article>
                <article class="glance-status-card"><span>Taper Status</span><strong>${escapeLayoutHtml(status.taperLabel)}</strong></article>
                <article class="glance-status-card"><span>Time Since Last Use</span><strong>${escapeLayoutHtml(status.timeSince)}</strong></article>
                <article class="glance-status-card"><span>Last Purchase</span><strong>${escapeLayoutHtml(status.lastPurchaseLabel)}</strong></article>
                <article class="glance-status-card"><span>Streak</span><strong>${status.streakDays} day${status.streakDays === 1 ? '' : 's'}</strong></article>
            </div>
        </section>
        <section class="layout-section" aria-labelledby="glance-actions-heading">
            <h3 id="glance-actions-heading" class="layout-section-title">Quick Actions</h3>
            <div class="glance-actions">
                <button type="button" class="submit-btn" onclick="openLayoutLogUse()">Log Use</button>
                <button type="button" class="secondary-btn" onclick="openLayoutAddPurchase()">Add Purchase</button>
                <button type="button" class="secondary-btn" onclick="switchTab('goals-plans-tab')">View Tapers</button>
                <button type="button" class="secondary-btn" onclick="switchTab('insights-calendar-tab')">View Insights</button>
            </div>
        </section>`;
}

function getLayoutUseRateLabel(substanceId, logs) {
    if (!substanceId || !logs?.length) return '—';
    if (typeof isNicotineSubstanceId === 'function' && isNicotineSubstanceId(substanceId)) {
        const puffs = logs.filter(l => typeof isPersonalUseLog !== 'function' || isPersonalUseLog(l))
            .reduce((s, l) => s + (parseFloat(l.puffsUsed || l.amount) || 0), 0);
        return puffs ? `${typeof formatAmount === 'function' ? formatAmount(puffs) : puffs} puffs` : '—';
    }
    const withDuration = logs.filter(l => {
        if (typeof isPersonalUseLog === 'function' && !isPersonalUseLog(l)) return false;
        const start = l.startTime || l.time;
        const end = l.endTime;
        return start && end;
    });
    if (!withDuration.length) return '—';
    let totalAmount = 0;
    let totalHours = 0;
    withDuration.forEach(l => {
        const amount = parseFloat(l.amount) || 0;
        let hours = parseFloat(l.durationHours);
        if (!Number.isFinite(hours) && typeof getLogDatetimeMs === 'function') {
            const startMs = getLogDatetimeMs({ ...l, endTime: l.startTime || l.time });
            const endMs = getLogDatetimeMs(l);
            if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
                hours = (endMs - startMs) / 36e5;
            }
        }
        if (amount > 0 && hours > 0) {
            totalAmount += amount;
            totalHours += hours;
        }
    });
    if (!(totalHours > 0)) return '—';
    const rate = totalAmount / totalHours;
    const unit = typeof getSubstanceDisplayUnit === 'function'
        ? getSubstanceDisplayUnit(substanceId)
        : 'g';
    const formatted = typeof formatAmount === 'function' ? formatAmount(rate) : String(rate.toFixed(2));
    return `${formatted} ${unit}/hr`;
}

function getLayoutLastUseLabel(logs) {
    if (!logs?.length) return '—';
    const latest = [...logs].sort((a, b) => {
        if (typeof getLogDatetimeMs === 'function') return getLogDatetimeMs(b) - getLogDatetimeMs(a);
        return String(b.date || '').localeCompare(String(a.date || ''));
    })[0];
    if (!latest) return '—';
    if (typeof formatDate === 'function') return formatDate(latest.date);
    return latest.date || '—';
}

function enhanceUseLogSummary() {
    const container = document.getElementById('use-log-totals');
    if (!container) return;
    const substanceId = typeof getUseLogViewSubstanceId === 'function' ? getUseLogViewSubstanceId() : null;
    const totals = typeof getUseLogTotalsForView === 'function' ? getUseLogTotalsForView() : null;
    if (!totals) return;
    const logs = totals.personalLogs || totals.logs || [];
    const sessions = logs.filter(l => l.endTime || l.useType === 'session' || l.type === 'session').length || totals.entryCount || 0;
    const rateLabel = getLayoutUseRateLabel(substanceId, logs);
    const lastUse = getLayoutLastUseLabel(logs);
    if (container.querySelector('.use-log-total-card[data-layout-extra]')) return;
    const extra = document.createElement('div');
    extra.className = 'use-log-totals-grid use-log-totals-extra';
    extra.innerHTML = `
        <div class="use-log-total-card" data-layout-extra="sessions"><span>Sessions</span><strong>${sessions}</strong></div>
        <div class="use-log-total-card" data-layout-extra="rate"><span>${substanceId && typeof isNicotineSubstanceId === 'function' && isNicotineSubstanceId(substanceId) ? 'Puffs' : 'Use rate'}</span><strong>${escapeLayoutHtml(rateLabel)}</strong></div>
        <div class="use-log-total-card" data-layout-extra="last"><span>Last Use</span><strong>${escapeLayoutHtml(lastUse)}</strong></div>`;
    container.appendChild(extra);
}

function applyLogLayout() {
    collapseLayoutSection('recentUse');
    const recent = document.querySelector('.collapsible-section[data-section="recentUse"]');
    if (recent) recent.classList.add('layout-legacy-hidden');
    const history = document.querySelector('.collapsible-section[data-section="useHistory"]');
    if (history) {
        history.classList.remove('collapsed');
        history.classList.add('layout-primary-section');
    }
    const bulk = document.querySelector('.collapsible-section[data-section="bulkActions"]');
    if (bulk) {
        const selected = typeof useHistorySelection !== 'undefined' ? useHistorySelection.size : 0;
        bulk.classList.toggle('layout-bulk-idle', selected === 0);
        if (selected === 0) bulk.classList.add('collapsed');
        else bulk.classList.remove('collapsed');
    }
    enhanceUseLogSummary();
}

function setLayoutInventoryView(view) {
    const next = LAYOUT_INVENTORY_VIEWS.includes(view) ? view : 'active';
    layoutInventoryView = next;
    if (typeof inventoryTabFilter !== 'undefined') {
        if (next === 'active') inventoryTabFilter = 'active';
        else if (next === 'purchases') inventoryTabFilter = 'all';
        else inventoryTabFilter = 'history';
    }
    if (typeof normalizeInventoryStatusFilter === 'function' && next !== 'purchases' && next !== 'history') {
        inventoryTabFilter = normalizeInventoryStatusFilter(next);
    }
    document.querySelectorAll('[data-inv-view]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-inv-view') === next);
    });
    const statusEl = document.getElementById('inventory-filter-status');
    if (statusEl) {
        if (next === 'active') statusEl.value = 'active';
        else if (next === 'purchases') statusEl.value = 'all';
        else statusEl.value = 'depleted';
    }
    if (typeof saveInventoryFilterState === 'function') saveInventoryFilterState();
    if (typeof renderInventorySummaryCards === 'function') renderInventorySummaryCards();
    if (typeof renderPurchaseHistory === 'function') renderPurchaseHistory(null);
    if (typeof updateInventoryFiltersPanelUI === 'function') updateInventoryFiltersPanelUI();
}

function applyInventoryHistoryFilter(list) {
    if (layoutInventoryView !== 'history' && inventoryTabFilter !== 'history') return list;
    return (list || []).filter(p => {
        const tab = typeof getPurchaseInventoryTab === 'function' ? getPurchaseInventoryTab(p) : 'active';
        return tab === 'depleted' || tab === 'gifted' || tab === 'hidden';
    });
}

function enhanceInventorySummaryCards() {
    const container = document.getElementById('inventory-summary-cards');
    if (!container) return;
    const selectedId = typeof getInventorySubstanceFilterId === 'function'
        ? getInventorySubstanceFilterId()
        : getLayoutSelectedSubstanceId();
    const summary = typeof getInventorySummary === 'function'
        ? getInventorySummary(selectedId || null, appData)
        : null;
    if (!summary) return;
    const cur = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$';
    const purchases = (appData.purchases || []).filter(p => {
        if (isLayoutAllSubstances(selectedId)) return true;
        const sid = typeof getPurchaseSubstanceId === 'function' ? getPurchaseSubstanceId(p) : p.substanceId;
        return sid === selectedId;
    });
    const totalSpent = purchases.reduce((s, p) => {
        if (typeof purchaseCountsTowardSpend === 'function' && !purchaseCountsTowardSpend(p)) return s;
        const amt = typeof getPurchaseSpendAmount === 'function'
            ? getPurchaseSpendAmount(p)
            : (parseFloat(typeof getPurchaseTotalCost === 'function' ? getPurchaseTotalCost(p) : p.totalCost) || 0);
        return s + (amt || 0);
    }, 0);
    const totalBought = purchases.reduce((s, p) => {
        const qty = typeof getPurchaseQuantityBought === 'function' ? getPurchaseQuantityBought(p) : (parseFloat(p.quantityBought) || 0);
        return s + (qty || 0);
    }, 0);
    let avgLabel = '—';
    if (selectedId && !isLayoutAllSubstances(selectedId) && totalSpent > 0 && totalBought > 0) {
        const unit = typeof getSubstanceDisplayUnit === 'function' ? getSubstanceDisplayUnit(selectedId) : 'g';
        avgLabel = `${cur}${(totalSpent / totalBought).toFixed(2)}/${unit}`;
    } else if (isLayoutAllSubstances(selectedId)) {
        avgLabel = 'Per substance';
    }
    if (container.querySelector('.inventory-layout-cards')) return;
    const wrap = document.createElement('div');
    wrap.className = 'inventory-layout-cards glance-status-grid';
    wrap.innerHTML = `
        <article class="glance-status-card"><span>Active Items</span><strong>${summary.activeCount ?? 0}</strong></article>
        <article class="glance-status-card"><span>Total Remaining</span><strong>${
            typeof formatInventoryTotalRemainingValue === 'function'
                ? formatInventoryTotalRemainingValue(summary, selectedId)
                : (summary.totalRemaining ?? '—')
        }</strong></article>
        <article class="glance-status-card"><span>Total Spent</span><strong>${
            typeof fmtSheetMoney === 'function' ? fmtSheetMoney(totalSpent, cur) : formatLayoutMoney(totalSpent)
        }</strong></article>
        <article class="glance-status-card"><span>Avg cost</span><strong>${escapeLayoutHtml(avgLabel)}</strong></article>`;
    container.insertBefore(wrap, container.firstChild);
}

function openInventoryDetail(purchaseId) {
    const panel = document.getElementById('inventory-detail-panel');
    const body = document.getElementById('inventory-detail-body');
    if (!panel || !body) return;
    const purchase = (appData.purchases || []).find(p => String(p.id) === String(purchaseId));
    if (!purchase) return;
    const sid = typeof getPurchaseSubstanceId === 'function' ? getPurchaseSubstanceId(purchase) : purchase.substanceId;
    const sub = typeof getSubstance === 'function' ? getSubstance(sid) : null;
    const remaining = typeof getPurchaseRemainingAmount === 'function' ? getPurchaseRemainingAmount(purchase) : purchase.remainingAmount;
    const bought = typeof getPurchaseQuantityBought === 'function' ? getPurchaseQuantityBought(purchase) : purchase.quantityBought;
    const unit = purchase.unit || '';
    const cost = typeof getPurchaseTotalCost === 'function' ? getPurchaseTotalCost(purchase) : purchase.totalCost;
    const metrics = typeof getPurchaseSupplyMetrics === 'function' ? getPurchaseSupplyMetrics(purchase) : {};
    const linked = typeof getLogsForPurchase === 'function' ? getLogsForPurchase(purchaseId) : [];
    body.innerHTML = `
        <h3>${escapeLayoutHtml(sub?.name || 'Inventory item')}</h3>
        <dl class="inventory-detail-list">
            <div><dt>Purchase date</dt><dd>${escapeLayoutHtml(purchase.date || '—')}</dd></div>
            <div><dt>Bought</dt><dd>${escapeLayoutHtml(String(bought ?? '—'))} ${escapeLayoutHtml(unit)}</dd></div>
            <div><dt>Remaining</dt><dd>${escapeLayoutHtml(String(remaining ?? '—'))} ${escapeLayoutHtml(unit)}</dd></div>
            <div><dt>Cost</dt><dd>${escapeLayoutHtml(formatLayoutMoney(cost))}</dd></div>
            <div><dt>Supply duration</dt><dd>${escapeLayoutHtml(metrics.supplyDurationLabel || '—')}</dd></div>
            <div><dt>Linked use</dt><dd>${linked.length} ${linked.length === 1 ? 'entry' : 'entries'}</dd></div>
            <div><dt>Store / source</dt><dd>${escapeLayoutHtml(purchase.store || purchase.location || '—')}</dd></div>
            <div><dt>Notes</dt><dd>${escapeLayoutHtml(purchase.notes || '—')}</dd></div>
        </dl>
        <div class="inventory-detail-actions">
            <button type="button" class="secondary-btn" onclick="editPurchase('${escapeLayoutHtml(String(purchaseId))}'); closeInventoryDetail()">Edit</button>
            <button type="button" class="secondary-btn" onclick="if(typeof duplicatePurchase==='function')duplicatePurchase('${escapeLayoutHtml(String(purchaseId))}')">Duplicate</button>
            <button type="button" class="secondary-btn" onclick="expandLayoutSection('purchaseForm')">Adjust inventory</button>
        </div>`;
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
}

function closeInventoryDetail() {
    const panel = document.getElementById('inventory-detail-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
}

function setLayoutTaperWorkspaceView(view) {
    layoutTaperWorkspaceView = LAYOUT_TAPER_WORKSPACE_VIEWS.includes(view) ? view : 'weekly';
    document.querySelectorAll('[data-taper-workspace]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-taper-workspace') === layoutTaperWorkspaceView);
    });
    const map = {
        weekly: ['taperCurrentWeekSummary', 'taperWeeklyTable'],
        purchases: ['taperSpendingPurchases', 'taperPurchasePacing'],
        details: ['taperPlanHeader']
    };
    const show = new Set(map[layoutTaperWorkspaceView] || map.weekly);
    ['taperCurrentWeekSummary', 'taperWeeklyTable', 'taperSpendingPurchases', 'taperPurchasePacing', 'taperPlanHeader']
        .forEach(key => {
            const section = document.querySelector(`#taper-dashboard .collapsible-section[data-section="${key}"]`);
            if (!section) return;
            const visible = show.has(key);
            section.classList.toggle('layout-workspace-hidden', !visible);
            if (visible) section.classList.remove('collapsed');
        });
    const spending = document.getElementById('taper-spending-section');
    if (spending) spending.classList.toggle('layout-workspace-hidden', layoutTaperWorkspaceView !== 'purchases');
    const pacing = document.getElementById('taper-purchase-pacing-section');
    if (pacing) pacing.classList.toggle('layout-workspace-hidden', layoutTaperWorkspaceView !== 'purchases');
}

function applyTaperLayout() {
    const workspace = document.getElementById('taper-tab');
    if (workspace) workspace.hidden = false;
    const overview = document.getElementById('gp-overview');
    if (overview && typeof ensureCombinedNavPrefs === 'function') {
        const view = ensureCombinedNavPrefs().goalsPlansView;
        if (view === 'overview' || view === 'active') {
            workspace.hidden = false;
        }
    }
    setLayoutTaperWorkspaceView(layoutTaperWorkspaceView);
}

function renderLayoutInsightsOverview(overview) {
    const warningsHidden = true;
    void warningsHidden;
    const range = overview?.rangeLabel || 'Selected range';
    return `
        <div class="combined-overview layout-insights-overview">
            <p class="settings-hint">Date range: <strong>${escapeLayoutHtml(range)}</strong></p>
            <div class="glance-status-grid">
                <article class="glance-status-card"><span>Total Used</span><strong>${escapeLayoutHtml(String(overview?.useSummary || '—'))}</strong></article>
                <article class="glance-status-card"><span>Average Per Day</span><strong>${escapeLayoutHtml(String(overview?.avgPerDay || 'See Use'))}</strong></article>
                <article class="glance-status-card"><span>Total Spent</span><strong>${escapeLayoutHtml(String(overview?.spendSummary || '—'))}</strong></article>
            </div>
            <div class="layout-section">
                <h3 class="layout-section-title">Use Over Time</h3>
                <p class="settings-hint">Charts below use the same substance and date filter as Use and Spending.</p>
            </div>
            <div class="layout-section">
                <h3 class="layout-section-title">Top Metrics</h3>
                <p class="settings-hint">Open Use or Spending for detailed tables. Taper progress lives on Tapers.</p>
            </div>
            <div class="combined-overview-actions">
                <button type="button" class="secondary-btn" onclick="setInsightsCalendarView('use')">Use</button>
                <button type="button" class="secondary-btn" onclick="setInsightsCalendarView('money')">Spending</button>
                <button type="button" class="secondary-btn" onclick="setInsightsCalendarView('calendar')">Calendar</button>
            </div>
        </div>`;
}

function setLayoutSettingsCategory(category) {
    layoutSettingsCategory = LAYOUT_SETTINGS_CATEGORIES.includes(category) ? category : 'substances';
    document.querySelectorAll('[data-settings-cat-btn]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-settings-cat-btn') === layoutSettingsCategory);
    });
    document.querySelectorAll('#settings-tab .collapsible-section[data-settings-cat], #settings-tab .settings-cat-pane').forEach(el => {
        const cats = String(el.getAttribute('data-settings-cat') || '').split(/\s+/);
        el.classList.toggle('layout-settings-hidden', !cats.includes(layoutSettingsCategory));
    });
}

function applySettingsLayout() {
    setLayoutSettingsCategory(layoutSettingsCategory);
}

function applyLayoutRedesign(data = appData) {
    applyLayoutPageClass();
    syncLayoutSubstanceSelectors();
    renderTodayAtAGlance(data);
    applyLogLayout();
    enhanceInventorySummaryCards();
    applyTaperLayout();
    applySettingsLayout();
    const activeTab = document.querySelector('.tab.active')?.id;
    if (activeTab) syncLayoutSidebarNav(activeTab);
}

function installLayoutHooks() {
    if (layoutHooksInstalled || typeof document === 'undefined') return;
    layoutHooksInstalled = true;

    if (typeof getNavButtons === 'function') {
        const original = getNavButtons;
        getNavButtons = function patchedGetNavButtons() {
            const buttons = original().slice();
            const extra = [...document.querySelectorAll('.app-sidebar .nav-btn')];
            const seen = new Set(buttons);
            extra.forEach(btn => {
                if (!seen.has(btn)) buttons.push(btn);
            });
            return buttons;
        };
    }

    if (typeof setActiveNavTab === 'function') {
        const original = setActiveNavTab;
        setActiveNavTab = function patchedSetActiveNavTab(tabId) {
            original(tabId);
            syncLayoutSidebarNav(tabId);
        };
    }

    if (typeof setSelectedSubstanceId === 'function') {
        const original = setSelectedSubstanceId;
        setSelectedSubstanceId = function patchedSetSelectedSubstanceId(id, options) {
            const result = original(id, options);
            syncLayoutSubstanceSelectors();
            renderTodayAtAGlance();
            return result;
        };
    }

    if (typeof renderRecoveryDashboard === 'function') {
        const original = renderRecoveryDashboard;
        renderRecoveryDashboard = function patchedRenderRecoveryDashboard() {
            original.apply(this, arguments);
            renderTodayAtAGlance();
        };
    }

    if (typeof renderSimpleHome === 'function') {
        const original = renderSimpleHome;
        renderSimpleHome = function patchedRenderSimpleHome() {
            original.apply(this, arguments);
            renderTodayAtAGlance();
        };
    }

    if (typeof renderUseLogTotals === 'function') {
        const original = renderUseLogTotals;
        renderUseLogTotals = function patchedRenderUseLogTotals() {
            original.apply(this, arguments);
            enhanceUseLogSummary();
            applyLogLayout();
        };
    }

    if (typeof renderUseLogTab === 'function') {
        const original = renderUseLogTab;
        renderUseLogTab = function patchedRenderUseLogTab() {
            original.apply(this, arguments);
            applyLogLayout();
        };
    }

    if (typeof renderInventorySummaryCards === 'function') {
        const original = renderInventorySummaryCards;
        renderInventorySummaryCards = function patchedRenderInventorySummaryCards() {
            original.apply(this, arguments);
            enhanceInventorySummaryCards();
        };
    }

    function patchInventoryListFilter(original) {
        return function patchedInventoryList(substanceId, data) {
            const prev = inventoryTabFilter;
            if (layoutInventoryView === 'purchases' || inventoryTabFilter === 'purchases') {
                inventoryTabFilter = 'all';
            }
            let list = original(substanceId, data);
            inventoryTabFilter = prev;
            if (layoutInventoryView === 'history' || prev === 'history') {
                list = applyInventoryHistoryFilter(list);
            }
            return list;
        };
    }
    if (typeof getInventoryFilteredPurchases === 'function') {
        getInventoryFilteredPurchases = patchInventoryListFilter(getInventoryFilteredPurchases);
    }
    if (typeof getInventoryPurchasesForStatusView === 'function') {
        getInventoryPurchasesForStatusView = patchInventoryListFilter(getInventoryPurchasesForStatusView);
    }

    if (typeof renderInsightsCalendarOverviewHtml === 'function') {
        const original = renderInsightsCalendarOverviewHtml;
        renderInsightsCalendarOverviewHtml = function patchedRenderInsightsOverview(overview) {
            try {
                return renderLayoutInsightsOverview(overview);
            } catch (_) {
                return original(overview);
            }
        };
    }

    if (typeof renderGoalsPlansCombinedView === 'function') {
        const original = renderGoalsPlansCombinedView;
        renderGoalsPlansCombinedView = function patchedRenderGoalsPlansCombinedView() {
            original.apply(this, arguments);
            applyTaperLayout();
        };
    }

    if (typeof refreshTaperDashboard === 'function') {
        const original = refreshTaperDashboard;
        refreshTaperDashboard = function patchedRefreshTaperDashboard() {
            original.apply(this, arguments);
            applyTaperLayout();
        };
    }

    document.addEventListener('click', event => {
        const viewBtn = event.target.closest('[data-inv-row-id]');
        if (viewBtn) {
            event.preventDefault();
            openInventoryDetail(viewBtn.getAttribute('data-inv-row-id'));
        }
    });
}

function initLayoutRedesign() {
    applyLayoutPageClass();
    installLayoutHooks();
    if (typeof inventoryTabFilter !== 'undefined' && inventoryTabFilter === 'all') {
        layoutInventoryView = 'active';
        inventoryTabFilter = 'active';
    }
    applyLayoutRedesign(typeof appData !== 'undefined' ? appData : {});
    setLayoutTaperWorkspaceView(layoutTaperWorkspaceView);
    setLayoutSettingsCategory(layoutSettingsCategory);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try { initLayoutRedesign(); } catch (err) { console.error('[layout-redesign] init failed', err); }
        });
    } else {
        try { initLayoutRedesign(); } catch (_) { /* ignore early */ }
    }
}
