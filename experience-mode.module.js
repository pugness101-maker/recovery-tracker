// ——— App-wide Experience Mode (Simple / Advanced) ———
// Presentation layer only — reuses canonical calc engine, logs, inventory, tapers.
// Does not remove Advanced features or rewrite existing records.

const EXPERIENCE_MODE_SIMPLE = 'simple';
const EXPERIENCE_MODE_ADVANCED = 'advanced';
const EXPERIENCE_PROGRESS_RANGES = Object.freeze(['7', '30', '90', 'all']);

const SIMPLE_TAPER_STATUS = Object.freeze({
    within: { key: 'within', label: 'Within target', homeLabel: 'Within taper target' },
    near: { key: 'near', label: 'Near target', homeLabel: 'Near taper target' },
    above: { key: 'above', label: 'Above target', homeLabel: 'Above taper target' },
    none: { key: 'none', label: 'No active taper', homeLabel: 'No active taper' }
});

const SIMPLE_PLAN_INTENTS = Object.freeze([
    { id: 'use-less', label: 'Use less', reductionType: 'reduce-amount', hint: 'Lower daily use over time.' },
    { id: 'spend-less', label: 'Spend less', reductionType: 'reduce-buying', hint: 'Reduce how much you spend.' },
    { id: 'buy-less', label: 'Buy less often', reductionType: 'reduce-buying', hint: 'Increase days between purchases.' },
    { id: 'quit-by-date', label: 'Quit by a date', reductionType: 'reduce-amount', hint: 'Reach zero by a chosen end date.' },
    { id: 'track-only', label: 'Track only', reductionType: null, hint: 'No taper — just monitor use.' },
    { id: 'custom', label: 'Custom', reductionType: null, hint: 'Open full plan settings.' }
]);

function getDefaultSimpleModePrefs() {
    return {
        quickLogBySubstance: {},
        recentAmountsBySubstance: {},
        progressRange: '7',
        progressSubstanceId: null,
        progressCalendarMonth: null,
        lastQuickSubstanceId: null,
        planIntent: null
    };
}

function normalizeExperienceMode(value) {
    return value === EXPERIENCE_MODE_ADVANCED ? EXPERIENCE_MODE_ADVANCED : EXPERIENCE_MODE_SIMPLE;
}

function migrateExperienceModeV1(data = appData) {
    if (!data || typeof data !== 'object') return;
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    if (data.migrations.experienceModeV1) return;
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};

    const hasExistingWork =
        (Array.isArray(data.logs) && data.logs.length > 0)
        || (Array.isArray(data.purchases) && data.purchases.length > 0)
        || (Array.isArray(data.taperPlansV2) && data.taperPlansV2.length > 0)
        || (data.taperPlans && typeof data.taperPlans === 'object' && Object.keys(data.taperPlans).length > 0);

    if (data.settings.experienceMode == null) {
        // Existing users keep the full UI by default; new installs use Simple.
        data.settings.experienceMode = hasExistingWork
            ? EXPERIENCE_MODE_ADVANCED
            : EXPERIENCE_MODE_SIMPLE;
    } else {
        data.settings.experienceMode = normalizeExperienceMode(data.settings.experienceMode);
    }
    data.migrations.experienceModeV1 = true;
}

function ensureSimpleModePrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultSimpleModePrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultSimpleModePrefs();
    if (!data.settings.simpleModePrefs || typeof data.settings.simpleModePrefs !== 'object') {
        data.settings.simpleModePrefs = { ...defaults };
    }
    const prefs = data.settings.simpleModePrefs;
    if (!prefs.quickLogBySubstance || typeof prefs.quickLogBySubstance !== 'object') {
        prefs.quickLogBySubstance = {};
    }
    if (!prefs.recentAmountsBySubstance || typeof prefs.recentAmountsBySubstance !== 'object') {
        prefs.recentAmountsBySubstance = {};
    }
    if (!EXPERIENCE_PROGRESS_RANGES.includes(String(prefs.progressRange))) {
        prefs.progressRange = '7';
    }
    return prefs;
}

function ensureExperienceMode(data = appData) {
    if (!data || typeof data !== 'object') return EXPERIENCE_MODE_SIMPLE;
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    migrateExperienceModeV1(data);
    data.settings.experienceMode = normalizeExperienceMode(data.settings.experienceMode);
    ensureSimpleModePrefs(data);
    return data.settings.experienceMode;
}

function getExperienceMode(data = appData) {
    return ensureExperienceMode(data);
}

function isSimpleExperienceMode(data = appData) {
    return getExperienceMode(data) === EXPERIENCE_MODE_SIMPLE;
}

function isAdvancedExperienceMode(data = appData) {
    return getExperienceMode(data) === EXPERIENCE_MODE_ADVANCED;
}

function persistExperienceMode(mode, data = appData) {
    ensureExperienceMode(data);
    data.settings.experienceMode = normalizeExperienceMode(mode);
    if (typeof saveData === 'function') saveData(data);
    applyExperienceMode(data);
    return data.settings.experienceMode;
}

function getSimpleModePrefs(data = appData) {
    return ensureSimpleModePrefs(data);
}

function persistSimpleModePrefs(patch = {}, data = appData) {
    const prefs = ensureSimpleModePrefs(data);
    Object.assign(prefs, patch || {});
    if (typeof saveData === 'function') saveData(data);
    return prefs;
}

function getTrackedSubstancesForSimpleHome(data = appData) {
    const active = typeof getActiveSubstances === 'function'
        ? getActiveSubstances(data)
        : (data.substances || []).filter(s => s && s.active !== false);
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : '';
    return active.filter(sub => {
        if (!sub?.id) return false;
        if (sub.isMain) return true;
        if (!today) return true;
        const used = typeof getCanonicalUsageOnDate === 'function'
            ? getCanonicalUsageOnDate(sub.id, today, data)
            : 0;
        return used > 0;
    });
}

function resolveSimpleTaperStatus(used, target) {
    if (typeof getTaperLimitStatus === 'function') {
        const engine = getTaperLimitStatus(used, target);
        if (engine.status === 'over') return SIMPLE_TAPER_STATUS.above;
        if (engine.status === 'close') return SIMPLE_TAPER_STATUS.near;
        if (engine.status === 'under') return SIMPLE_TAPER_STATUS.within;
        return SIMPLE_TAPER_STATUS.none;
    }
    if (target == null || !(target > 0)) return SIMPLE_TAPER_STATUS.none;
    if (used > target) return SIMPLE_TAPER_STATUS.above;
    if (used >= target * 0.8) return SIMPLE_TAPER_STATUS.near;
    return SIMPLE_TAPER_STATUS.within;
}

function getSimpleTaperDailyTarget(substanceId, dateStr, data = appData) {
    if (!substanceId || typeof getDailyLimitForDate !== 'function') return null;
    const target = getDailyLimitForDate(substanceId, dateStr, null);
    return target != null && Number(target) > 0 ? Number(target) : null;
}

function formatSimpleUsage(substanceId, amount, data = appData) {
    if (typeof formatRecoveryUsageAmount === 'function') {
        return formatRecoveryUsageAmount(substanceId, amount, data);
    }
    const unit = typeof getSubstanceDisplayUnit === 'function'
        ? getSubstanceDisplayUnit(substanceId, data)
        : '';
    const n = Number(amount) || 0;
    if (typeof formatAmountWithUnit === 'function') return formatAmountWithUnit(n, unit);
    return `${n}${unit ? ` ${unit}` : ''}`;
}

function getSimpleSubstanceDisplayName(subOrId, data = appData) {
    if (typeof getSubstanceDisplayName === 'function') {
        return getSubstanceDisplayName(subOrId, data);
    }
    if (subOrId && typeof subOrId === 'object') return subOrId.name || subOrId.id || '';
    return String(subOrId || '');
}

function formatSimpleLastSaved(raw) {
    const text = String(raw || 'Last Saved: —').trim();
    if (/^Last Saved:/i.test(text)) return text.replace(/^Last Saved:\s*/i, 'Last Saved: ');
    return `Last Saved: ${text}`;
}

function formatSimpleSpendPeriodLabel(bounds) {
    if (!bounds) return 'Estimated spending';
    if (bounds.key === 'all') return 'Estimated spending · All time';
    const days = Number(bounds.days) || Number(bounds.key);
    if (Number.isFinite(days) && days > 0) return `Estimated spending · ${days} days`;
    return 'Estimated spending';
}

function formatSimpleAxisDate(dateStr) {
    if (typeof formatShortMonthDay === 'function') return formatShortMonthDay(dateStr);
    return dateStr || '';
}

function getRecentAverageUsage(substanceId, days = 7, data = appData) {
    if (!substanceId || typeof getCanonicalUsageInRange !== 'function') return 0;
    const today = getLocalDateString();
    const endPrev = addDaysYYYYMMDD(today, -1);
    const startPrev = addDaysYYYYMMDD(endPrev, -(Math.max(1, days) - 1));
    const total = getCanonicalUsageInRange(substanceId, startPrev, endPrev, data);
    return total / Math.max(1, days);
}

function buildSimpleTodayCard(substance, data = appData) {
    const today = getLocalDateString();
    const substanceId = substance.id;
    const used = typeof getCanonicalUsageOnDate === 'function'
        ? getCanonicalUsageOnDate(substanceId, today, data)
        : 0;
    const target = getSimpleTaperDailyTarget(substanceId, today, data);
    const remaining = target != null ? Math.max(0, target - used) : null;
    const recentAvg = getRecentAverageUsage(substanceId, 7, data);
    let vsRecent = null;
    if (recentAvg > 0) {
        vsRecent = ((used - recentAvg) / recentAvg) * 100;
    }
    const status = resolveSimpleTaperStatus(used, target);
    const unit = typeof getSubstanceDisplayUnit === 'function'
        ? getSubstanceDisplayUnit(substanceId, data)
        : (substance.defaultUnit || '');
    return {
        substanceId,
        name: getSimpleSubstanceDisplayName(substance, data) || substance.name || substanceId,
        unit,
        used,
        usedLabel: formatSimpleUsage(substanceId, used, data),
        target,
        targetLabel: target != null ? formatSimpleUsage(substanceId, target, data) : null,
        remaining,
        remainingLabel: remaining != null ? formatSimpleUsage(substanceId, remaining, data) : null,
        vsRecent,
        status
    };
}

function buildSimpleHomeDataset(data = appData) {
    const substances = getTrackedSubstancesForSimpleHome(data);
    const cards = substances.map(s => buildSimpleTodayCard(s, data));
    // Also include any substance with use today that wasn't in the filtered list
    const today = getLocalDateString();
    const seen = new Set(cards.map(c => c.substanceId));
    (data.substances || []).forEach(sub => {
        if (!sub?.id || seen.has(sub.id) || sub.active === false) return;
        const used = getCanonicalUsageOnDate(sub.id, today, data);
        if (used > 0) {
            cards.push(buildSimpleTodayCard(sub, data));
            seen.add(sub.id);
        }
    });
    cards.sort((a, b) => {
        if (b.used !== a.used) return b.used - a.used;
        return String(a.name).localeCompare(String(b.name));
    });
    return { today, cards };
}

function renderSimpleHome(data = appData) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('simple-home');
    if (!root) return;
    const dataset = buildSimpleHomeDataset(data);
    const cardsHtml = dataset.cards.length
        ? dataset.cards.map(card => {
            const vsRow = card.vsRecent == null
                ? ''
                : `<div class="sm-today-row">
                    <dt>vs recent</dt>
                    <dd class="${card.vsRecent <= 0 ? 'sm-vs-down' : 'sm-vs-up'}">${card.vsRecent <= 0 ? '↓' : '↑'} ${Math.abs(Math.round(card.vsRecent))}%</dd>
                   </div>`;
            const meta = card.target != null
                ? `<dl class="sm-today-meta">
                    <div class="sm-today-row"><dt>Taper target</dt><dd>≤ ${escapeHtml(card.targetLabel)}</dd></div>
                    <div class="sm-today-row"><dt>Remaining</dt><dd>${escapeHtml(card.remainingLabel)}</dd></div>
                    ${vsRow}
                   </dl>`
                : `<dl class="sm-today-meta">
                    <div class="sm-today-row"><dt>Taper</dt><dd>${escapeHtml(card.status.homeLabel || card.status.label)}</dd></div>
                    ${vsRow}
                   </dl>`;
            return `
                <article class="sm-today-card status-${escapeHtml(card.status.key)}" data-substance-id="${escapeHtml(card.substanceId)}">
                    <header class="sm-today-card-head">
                        <h3>${escapeHtml(card.name)}</h3>
                        <span class="sm-status-pill">${escapeHtml(card.status.homeLabel || card.status.label)}</span>
                    </header>
                    <p class="sm-today-amount">${escapeHtml(card.usedLabel)} <span class="sm-today-amount-label">today</span></p>
                    ${meta}
                    <button type="button" class="sm-card-quick-btn" onclick="openSimpleQuickLog('${escapeHtml(card.substanceId)}')">Quick Log</button>
                </article>`;
        }).join('')
        : `<div class="sm-empty">
            <p>Nothing logged today yet.</p>
            <p class="settings-hint">Tap Quick Log to record use in a few taps.</p>
           </div>`;

    const lastSaved = formatSimpleLastSaved(
        document.getElementById('dashboard-last-saved')?.textContent
        || document.getElementById('settings-last-saved')?.textContent
        || 'Last Saved: —'
    );

    root.innerHTML = `
        <div class="sm-home-header">
            <div>
                <h2 class="sm-home-title">Today</h2>
                <p class="sm-home-sub">How am I doing today?</p>
            </div>
            <p class="last-saved-status sm-last-saved">${escapeHtml(lastSaved)}</p>
        </div>
        <div class="sm-primary-actions" role="group" aria-label="Primary actions">
            <button type="button" class="sm-action-btn sm-action-primary" onclick="openSimpleQuickLog()">Quick Log</button>
            <button type="button" class="sm-action-btn sm-action-secondary" onclick="openSimpleLogDetails()">Log Details</button>
            <button type="button" class="sm-action-btn sm-action-secondary" onclick="openSimpleProgress()">View Progress</button>
        </div>
        <div class="sm-today-grid" id="sm-today-grid">${cardsHtml}</div>
        <div class="sm-home-footer">
            <button type="button" class="sm-text-btn" onclick="showAdvancedHomeDashboard()">Show full dashboard</button>
        </div>`;
}

function showAdvancedHomeDashboard() {
    if (typeof document === 'undefined') return;
    document.getElementById('dashboard-tab')?.classList.add('sm-show-advanced-home');
    if (typeof updateDashboard === 'function') updateDashboard();
}

function hideAdvancedHomeDashboard() {
    if (typeof document === 'undefined') return;
    document.getElementById('dashboard-tab')?.classList.remove('sm-show-advanced-home');
}

function openSimpleLogDetails() {
    hideAdvancedHomeDashboard();
    if (typeof switchTab === 'function') switchTab('use-log-tab');
}

function openSimpleProgress() {
    hideAdvancedHomeDashboard();
    if (typeof switchTab === 'function') switchTab('insights-calendar-tab');
    renderSimpleProgress();
}

function rememberQuickLogFromForm(data = appData) {
    const substanceId = document.getElementById('use-substance')?.value
        || document.getElementById('use-log-substance')?.value;
    if (!substanceId) return;
    const prefs = ensureSimpleModePrefs(data);
    const amountRaw = document.getElementById('use-amount')?.value
        || document.getElementById('use-vape-puffs-used')?.value
        || document.getElementById('use-cigarettes-smoked')?.value
        || document.getElementById('use-lsd-tabs-used')?.value
        || document.getElementById('use-xanax-pills-used')?.value;
    const amount = parseFloat(amountRaw);
    const unit = document.getElementById('use-unit')?.value || '';
    const productType = document.getElementById('use-nicotine-product-type')?.value
        || document.getElementById('use-weed-product-type')?.value
        || null;
    const purchaseId = document.getElementById('use-purchase-select')?.value
        || document.getElementById('use-vape-purchase-select')?.value
        || null;
    const transactionType = document.getElementById('use-transaction-type')?.value || 'use';
    const vapeMode = document.getElementById('use-vape-log-mode')?.value || null;

    prefs.quickLogBySubstance[substanceId] = {
        substanceId,
        productType,
        amount: Number.isFinite(amount) ? amount : null,
        unit,
        purchaseId: purchaseId || null,
        transactionType,
        vapeMode,
        updatedAt: new Date().toISOString()
    };
    prefs.lastQuickSubstanceId = substanceId;

    if (Number.isFinite(amount) && amount > 0) {
        rememberRecentAmount(substanceId, amount, data);
    } else if (typeof saveData === 'function') {
        saveData(data);
    }
}

function rememberRecentAmount(substanceId, amount, data = appData) {
    if (!substanceId || !(amount > 0)) return;
    const prefs = ensureSimpleModePrefs(data);
    const key = String(substanceId);
    const list = Array.isArray(prefs.recentAmountsBySubstance[key])
        ? prefs.recentAmountsBySubstance[key].slice()
        : [];
    const rounded = Math.round(amount * 1000) / 1000;
    const next = [rounded, ...list.filter(v => Math.abs(v - rounded) > 1e-9)].slice(0, 6);
    prefs.recentAmountsBySubstance[key] = next;
    if (typeof saveData === 'function') saveData(data);
}

function getRecentAmountsForSubstance(substanceId, data = appData) {
    const prefs = ensureSimpleModePrefs(data);
    const remembered = prefs.recentAmountsBySubstance?.[substanceId];
    if (Array.isArray(remembered) && remembered.length) {
        return remembered.filter(n => Number.isFinite(n) && n > 0).slice(0, 5);
    }
    // Derive from recent logs when prefs are empty
    const logs = (data.logs || [])
        .filter(l => l && String(l.substanceId) === String(substanceId) && Number(l.amount) > 0)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 40);
    const seen = [];
    logs.forEach(log => {
        const amt = Math.round(Number(log.amount) * 1000) / 1000;
        if (!(amt > 0)) return;
        if (!seen.some(v => Math.abs(v - amt) < 1e-9)) seen.push(amt);
    });
    if (seen.length) return seen.slice(0, 5);

    // Light sensible fallbacks by tracking mode
    if (typeof isNicotineTrackingMode === 'function' && isNicotineTrackingMode(substanceId, data)) {
        return [100, 250, 500];
    }
    if (typeof isPowderTrackingMode === 'function' && isPowderTrackingMode(substanceId, data)) {
        return [0.1, 0.25, 0.5];
    }
    return [1, 2, 5];
}

function applyQuickLogMemoryToForm(substanceId, data = appData) {
    if (!substanceId || typeof document === 'undefined') return;
    const prefs = ensureSimpleModePrefs(data);
    const mem = prefs.quickLogBySubstance?.[substanceId];
    const substanceEl = document.getElementById('use-substance');
    const pageSubstanceEl = document.getElementById('use-log-substance');
    if (substanceEl) substanceEl.value = substanceId;
    if (pageSubstanceEl) pageSubstanceEl.value = substanceId;
    if (typeof onUseLogSubstanceChange === 'function') {
        try { onUseLogSubstanceChange(); } catch (_) { /* ignore */ }
    } else if (typeof syncUseLogFormFromSelectedSubstance === 'function') {
        try { syncUseLogFormFromSelectedSubstance(); } catch (_) { /* ignore */ }
    }

    if (mem?.productType) {
        const nic = document.getElementById('use-nicotine-product-type');
        const weed = document.getElementById('use-weed-product-type');
        if (nic && [...nic.options].some(o => o.value === mem.productType)) {
            nic.value = mem.productType;
            if (typeof onNicotineUseProductTypeChange === 'function') onNicotineUseProductTypeChange();
        }
        if (weed && [...weed.options].some(o => o.value === mem.productType)) {
            weed.value = mem.productType;
            if (typeof onWeedUseProductTypeChange === 'function') onWeedUseProductTypeChange();
        }
    }

    if (mem?.unit) {
        const unitEl = document.getElementById('use-unit');
        if (unitEl && [...unitEl.options].some(o => o.value === mem.unit)) {
            unitEl.value = mem.unit;
        }
    }

    if (mem?.amount != null && Number.isFinite(mem.amount)) {
        const amountEl = document.getElementById('use-amount');
        if (amountEl) amountEl.value = String(mem.amount);
        const puffsEl = document.getElementById('use-vape-puffs-used');
        if (puffsEl && (mem.productType === 'vape' || mem.vapeMode === 'puffs')) {
            puffsEl.value = String(mem.amount);
            if (typeof setVapeLogInputMode === 'function') setVapeLogInputMode('puffs');
        }
    }

    if (mem?.transactionType && typeof setUseTransactionType === 'function') {
        try { setUseTransactionType(mem.transactionType); } catch (_) { /* ignore */ }
    }

    // Inventory is optional in Simple Mode — default none unless memory has a link
    if (typeof setUsePurchaseLinkMode === 'function') {
        if (mem?.purchaseId) {
            setUsePurchaseLinkMode('manual');
            const sel = document.getElementById('use-purchase-select');
            if (sel) sel.value = String(mem.purchaseId);
            const vapeSel = document.getElementById('use-vape-purchase-select');
            if (vapeSel) vapeSel.value = String(mem.purchaseId);
            if (typeof updateUsePurchaseLinkUI === 'function') updateUsePurchaseLinkUI();
        } else if (isSimpleExperienceMode(data)) {
            setUsePurchaseLinkMode('none');
        }
    }

    renderSimpleRecentAmountChips(substanceId, data);
}

function renderSimpleRecentAmountChips(substanceId, data = appData) {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('sm-recent-amounts');
    if (!host) return;
    if (!substanceId) {
        host.innerHTML = '';
        host.classList.add('hidden');
        return;
    }
    const amounts = getRecentAmountsForSubstance(substanceId, data);
    const unit = typeof getSubstanceDisplayUnit === 'function'
        ? getSubstanceDisplayUnit(substanceId, data)
        : '';
    host.classList.remove('hidden');
    host.innerHTML = `
        <span class="sm-recent-label">Recent amounts</span>
        <div class="sm-recent-chips" role="group" aria-label="Recent amounts">
            ${amounts.map(amt => {
                const label = unit ? `${amt} ${unit}` : String(amt);
                return `<button type="button" class="sm-amount-chip" onclick="applySimpleQuickAmount(${amt})">${escapeHtml(label)}</button>`;
            }).join('')}
        </div>`;
}

function applySimpleQuickAmount(amount) {
    const n = Number(amount);
    if (!(n > 0)) return;
    const amountEl = document.getElementById('use-amount');
    if (amountEl) amountEl.value = String(n);
    const puffsEl = document.getElementById('use-vape-puffs-used');
    if (puffsEl && !puffsEl.closest('.hidden')) {
        puffsEl.value = String(n);
        if (typeof setVapeLogInputMode === 'function') setVapeLogInputMode('puffs');
        if (typeof updateVapeUsePreview === 'function') {
            try { updateVapeUsePreview(); } catch (_) { /* ignore */ }
        }
    }
    const cigEl = document.getElementById('use-cigarettes-smoked');
    if (cigEl && !cigEl.closest('.hidden')) cigEl.value = String(n);
}

function openSimpleQuickLog(substanceId) {
    const prefs = ensureSimpleModePrefs(appData);
    const sid = substanceId
        || prefs.lastQuickSubstanceId
        || prefs.progressSubstanceId
        || (typeof resolveDefaultSelectedSubstanceId === 'function' ? resolveDefaultSelectedSubstanceId() : null)
        || getActiveSubstances?.(appData)?.[0]?.id;

    if (typeof switchTab === 'function') switchTab('use-log-tab');
    if (typeof selectUseEntryType === 'function') selectUseEntryType('quick');
    if (typeof setUseTransactionType === 'function') setUseTransactionType('use');
    if (typeof setDefaultUseLogDateTime === 'function') setDefaultUseLogDateTime();

    if (sid) applyQuickLogMemoryToForm(sid, appData);

    // Focus amount for fastest path
    setTimeout(() => {
        const amount = document.getElementById('use-amount');
        const puffs = document.getElementById('use-vape-puffs-used');
        const target = (puffs && !puffs.closest?.('.hidden')) ? puffs : amount;
        target?.focus?.();
        target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 60);

    // Expand form section if collapsed
    const formSection = document.querySelector('#use-log-tab [data-section="useLogForm"]');
    if (formSection?.classList.contains('collapsed') && typeof toggleSection === 'function') {
        try { toggleSection('useLogForm'); } catch (_) { /* ignore */ }
    }
}

function applySimpleLogFormLayout(data = appData) {
    if (typeof document === 'undefined') return;
    const page = document.getElementById('use-log-tab');
    if (!page) return;
    const simple = isSimpleExperienceMode(data);
    page.classList.toggle('sm-log-simple', simple);

    const summary = document.querySelector('#use-advanced-section .use-log-advanced-summary');
    if (summary) summary.textContent = simple ? 'More Options' : 'Advanced options';

    const slot = document.getElementById('sm-more-options-slot');
    const form = document.getElementById('use-log-form');
    if (slot && form) {
        const moreFields = [...form.querySelectorAll('.sm-log-more-field')];
        if (simple) {
            moreFields.forEach(el => {
                if (el.parentElement !== slot) slot.appendChild(el);
            });
        } else {
            // Restore near top of form (before core card) when leaving Simple
            const core = form.querySelector('.use-log-core-card');
            moreFields.forEach(el => {
                if (el.parentElement === slot && core) {
                    form.insertBefore(el, core);
                }
            });
        }
    }

    // Default inventory optional in Simple for new entries (not while editing)
    if (simple && typeof editingUseId !== 'undefined' && !editingUseId && typeof setUsePurchaseLinkMode === 'function') {
        const mode = getUsePurchaseLinkMode();
        if (mode === 'auto') setUsePurchaseLinkMode('none');
    }

    const substanceId = document.getElementById('use-substance')?.value
        || document.getElementById('use-log-substance')?.value;
    if (simple && substanceId) renderSimpleRecentAmountChips(substanceId, data);
    else {
        const host = document.getElementById('sm-recent-amounts');
        if (host) {
            host.innerHTML = '';
            host.classList.add('hidden');
        }
    }
}

function getProgressRangeBounds(rangeKey, data = appData) {
    const today = getLocalDateString();
    const key = EXPERIENCE_PROGRESS_RANGES.includes(String(rangeKey)) ? String(rangeKey) : '7';
    if (key === 'all') {
        const dates = (data.logs || []).map(l => l?.date).filter(Boolean).sort();
        return {
            key,
            label: 'All Time',
            startDate: dates[0] || today,
            endDate: today,
            days: Math.max(1, dates.length ? ((parseLocalDate(today) - parseLocalDate(dates[0])) / 86400000) + 1 : 1)
        };
    }
    const days = Number(key);
    const startDate = addDaysYYYYMMDD(today, -(days - 1));
    return { key, label: `Last ${days} Days`, startDate, endDate: today, days };
}

function buildSimpleProgressDataset(substanceId, rangeKey, data = appData) {
    const bounds = getProgressRangeBounds(rangeKey, data);
    const usedToday = getCanonicalUsageOnDate(substanceId, bounds.endDate, data);
    const rangeTotal = getCanonicalUsageInRange(substanceId, bounds.startDate, bounds.endDate, data);
    const dailyAvg = rangeTotal / Math.max(1, bounds.days);

    const prevEnd = addDaysYYYYMMDD(bounds.startDate, -1);
    const prevStart = addDaysYYYYMMDD(prevEnd, -(bounds.days - 1));
    const prevTotal = getCanonicalUsageInRange(substanceId, prevStart, prevEnd, data);
    const prevAvg = prevTotal / Math.max(1, bounds.days);
    const pctChange = prevAvg > 0 ? ((dailyAvg - prevAvg) / prevAvg) * 100 : null;

    const target = getSimpleTaperDailyTarget(substanceId, bounds.endDate, data);
    const status = resolveSimpleTaperStatus(usedToday, target);
    const streak = typeof computeRecoveryStreakDays === 'function'
        ? computeRecoveryStreakDays(substanceId)
        : { days: 0 };
    // Estimated spending: reuse the canonical use-cost engine for the selected range.
    const spend = typeof getCanonicalCostInRange === 'function'
        ? getCanonicalCostInRange(substanceId, bounds.startDate, bounds.endDate, data)
        : 0;

    const series = [];
    let cursor = bounds.startDate;
    let guard = 0;
    while (cursor <= bounds.endDate && guard < 400) {
        const amt = getCanonicalUsageOnDate(substanceId, cursor, data);
        const dayTarget = getSimpleTaperDailyTarget(substanceId, cursor, data);
        series.push({
            date: cursor,
            amount: amt,
            target: dayTarget,
            status: resolveSimpleTaperStatus(amt, dayTarget)
        });
        cursor = addDaysYYYYMMDD(cursor, 1);
        guard += 1;
    }

    return {
        substanceId,
        bounds,
        usedToday,
        dailyAvg,
        prevAvg,
        pctChange,
        target,
        status,
        streakDays: streak?.days ?? 0,
        spend,
        spendPeriodLabel: formatSimpleSpendPeriodLabel(bounds),
        displayName: getSimpleSubstanceDisplayName(substanceId, data),
        series,
        unit: typeof getSubstanceDisplayUnit === 'function'
            ? getSubstanceDisplayUnit(substanceId, data)
            : ''
    };
}

function renderSimpleProgressChart(series) {
    if (!series?.length) return '<p class="settings-hint">No use in this range.</p>';
    const max = Math.max(...series.map(s => s.amount), 0.0001);
    const bars = series.map(s => {
        const h = Math.max(4, Math.round((s.amount / max) * 100));
        return `<div class="sm-chart-bar-wrap" title="${escapeHtml(s.date)}: ${escapeHtml(String(s.amount))}">
            <div class="sm-chart-bar status-${escapeHtml(s.status.key)}" style="height:${h}%"></div>
        </div>`;
    }).join('');
    const startLabel = formatSimpleAxisDate(series[0].date);
    const endLabel = formatSimpleAxisDate(series[series.length - 1].date);
    return `<div class="sm-trend-card">
        <div class="sm-trend-chart" role="img" aria-label="Use trend">
            ${bars}
        </div>
        <div class="sm-trend-axis">
            <span>${escapeHtml(startLabel)}</span>
            <span>${escapeHtml(endLabel)}</span>
        </div>
    </div>`;
}

function renderSimpleProgressCalendar(dataset, monthStr) {
    const today = getLocalDateString();
    const base = monthStr && /^\d{4}-\d{2}/.test(monthStr)
        ? `${monthStr.slice(0, 7)}-01`
        : `${today.slice(0, 7)}-01`;
    const monthStart = parseLocalDate(base);
    if (!monthStart) return '';
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDate = new Map((dataset.series || []).map(s => [s.date, s]));
    const maxInMonth = Math.max(0.0001, ...[...byDate.values()].map(s => s.amount));

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push('<div class="sm-cal-cell empty"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatYYYYMMDD(new Date(year, month, d));
        const point = byDate.get(dateStr);
        const amount = point?.amount ?? (dateStr >= dataset.bounds.startDate && dateStr <= dataset.bounds.endDate
            ? getCanonicalUsageOnDate(dataset.substanceId, dateStr)
            : 0);
        const status = point?.status || resolveSimpleTaperStatus(amount, point?.target ?? dataset.target);
        const intensity = amount > 0 ? Math.min(1, amount / maxInMonth) : 0;
        cells.push(`
            <button type="button" class="sm-cal-cell status-${escapeHtml(status.key)}"
                style="--sm-intensity:${intensity.toFixed(3)}"
                data-date="${escapeHtml(dateStr)}"
                onclick="openSimpleProgressDay('${escapeHtml(dateStr)}')"
                aria-label="${escapeHtml(dateStr)}">
                <span class="sm-cal-day">${d}</span>
            </button>`);
    }

    const label = monthStart.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const prevMonth = formatYYYYMMDD(new Date(year, month - 1, 1)).slice(0, 7);
    const nextMonth = formatYYYYMMDD(new Date(year, month + 1, 1)).slice(0, 7);
    return `
        <div class="sm-cal-card">
            <div class="sm-cal-header">
                <button type="button" class="sm-cal-nav" onclick="setSimpleProgressCalendarMonth('${prevMonth}')" aria-label="Previous month">‹</button>
                <h4>${escapeHtml(label)}</h4>
                <button type="button" class="sm-cal-nav" onclick="setSimpleProgressCalendarMonth('${nextMonth}')" aria-label="Next month">›</button>
            </div>
            <div class="sm-cal-dow">${['S','M','T','W','T','F','S'].map(d => `<span>${d}</span>`).join('')}</div>
            <div class="sm-cal-grid">${cells.join('')}</div>
        </div>`;
}

function setSimpleProgressCalendarMonth(monthStr) {
    persistSimpleModePrefs({ progressCalendarMonth: monthStr });
    renderSimpleProgress();
}

function openSimpleProgressDay(dateStr) {
    if (!dateStr) return;
    if (typeof setUseLogFilter === 'function') setUseLogFilter('all');
    if (typeof switchTab === 'function') switchTab('use-log-tab');
    // Prefer today filter when applicable
    const today = getLocalDateString();
    if (dateStr === today && typeof setUseLogFilter === 'function') setUseLogFilter('today');
    const list = document.getElementById('use-history-table-wrap') || document.getElementById('recent-use-list');
    list?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function renderSimpleProgress(data = appData) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('simple-progress');
    if (!root) return;

    const prefs = ensureSimpleModePrefs(data);
    const substances = typeof getActiveSubstances === 'function'
        ? getActiveSubstances(data)
        : (data.substances || []).filter(s => s?.active !== false);
    let substanceId = prefs.progressSubstanceId
        || substances.find(s => s.isMain)?.id
        || substances[0]?.id;
    if (substanceId && !substances.some(s => s.id === substanceId)) {
        substanceId = substances[0]?.id || null;
    }
    if (!substanceId) {
        root.innerHTML = '<p class="settings-hint">Add a substance in Settings to see progress.</p>';
        return;
    }

    const dataset = buildSimpleProgressDataset(substanceId, prefs.progressRange, data);
    const month = prefs.progressCalendarMonth || dataset.bounds.endDate.slice(0, 7);
    const pctLabel = dataset.pctChange == null
        ? '—'
        : `${dataset.pctChange <= 0 ? '' : '+'}${Math.round(dataset.pctChange)}%`;
    const spendLabel = dataset.spend > 0
        ? (typeof formatMoneyOrDash === 'function'
            ? formatMoneyOrDash(dataset.spend)
            : `$${Number(dataset.spend).toFixed(2)}`)
        : '—';
    const spendPeriodLabel = dataset.spendPeriodLabel || formatSimpleSpendPeriodLabel(dataset.bounds);

    root.innerHTML = `
        <div class="sm-progress-header">
            <h2>Progress</h2>
            <p class="sm-progress-sub">A simple look at how things are going.</p>
        </div>
        <div class="sm-progress-controls">
            <label class="sm-field">
                <span>Substance</span>
                <select id="sm-progress-substance" onchange="onSimpleProgressSubstanceChange(this.value)">
                    ${substances.map(s => `<option value="${escapeHtml(s.id)}"${s.id === substanceId ? ' selected' : ''}>${escapeHtml(getSimpleSubstanceDisplayName(s, data))}</option>`).join('')}
                </select>
            </label>
            <div class="sm-range-pills" role="group" aria-label="Progress range">
                ${EXPERIENCE_PROGRESS_RANGES.map(r => {
                    const label = r === 'all' ? 'All Time' : `${r} Days`;
                    return `<button type="button" class="sm-range-btn${prefs.progressRange === r ? ' active' : ''}" onclick="setSimpleProgressRange('${r}')">${label}</button>`;
                }).join('')}
            </div>
        </div>
        <div class="sm-progress-metrics">
            <div class="sm-metric"><span class="sm-metric-label">Today</span><strong>${escapeHtml(formatSimpleUsage(substanceId, dataset.usedToday, data))}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Daily average</span><strong>${escapeHtml(formatSimpleUsage(substanceId, dataset.dailyAvg, data))}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Previous period</span><strong>${escapeHtml(formatSimpleUsage(substanceId, dataset.prevAvg, data))}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Change</span><strong>${escapeHtml(pctLabel)}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Break / streak</span><strong>${dataset.streakDays} day${dataset.streakDays === 1 ? '' : 's'}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Taper</span><strong>${escapeHtml(dataset.status.label)}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">${escapeHtml(spendPeriodLabel)}</span><strong>${escapeHtml(spendLabel)}</strong></div>
        </div>
        <section class="sm-progress-section sm-trend-section">
            <div class="sm-section-head">
                <h3>Trend</h3>
                <p class="sm-section-sub">${escapeHtml(dataset.bounds.label)}</p>
            </div>
            ${renderSimpleProgressChart(dataset.series)}
        </section>
        <section class="sm-progress-section sm-cal-section">
            <div class="sm-section-head">
                <h3>Calendar</h3>
            </div>
            <div id="sm-progress-calendar">${renderSimpleProgressCalendar(dataset, month)}</div>
        </section>
        <div class="sm-progress-footer">
            <button type="button" class="sm-text-btn" onclick="openDetailedAnalyticsFromSimple()">View Detailed Analytics</button>
        </div>`;
}

function onSimpleProgressSubstanceChange(substanceId) {
    persistSimpleModePrefs({ progressSubstanceId: substanceId });
    renderSimpleProgress();
}

function setSimpleProgressRange(rangeKey) {
    persistSimpleModePrefs({ progressRange: String(rangeKey) });
    renderSimpleProgress();
}

function openDetailedAnalyticsFromSimple() {
    // Temporarily reveal advanced insights UI without forcing global Advanced mode
    const tab = document.getElementById('insights-calendar-tab');
    tab?.classList.add('sm-show-detailed-analytics');
    if (typeof setInsightsCalendarView === 'function') setInsightsCalendarView('overview');
    if (typeof updateStats === 'function') updateStats();
    document.getElementById('stats-summary-dashboard')?.scrollIntoView?.({ behavior: 'smooth' });
}

function applySimplePlanIntent(intentId) {
    const intent = SIMPLE_PLAN_INTENTS.find(i => i.id === intentId) || SIMPLE_PLAN_INTENTS[0];
    persistSimpleModePrefs({ planIntent: intent.id });

    if (intent.id === 'track-only') {
        const wizardOnly = document.getElementById('simple-plan-wizard');
        if (wizardOnly) wizardOnly.classList.add('hidden');
        alert('Track only keeps logging without a taper plan. You can create a plan later anytime.');
        return;
    }

    const wizard = document.getElementById('simple-plan-wizard');
    if (wizard) wizard.classList.add('hidden');
    if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = true;
    try {
        if (typeof showNewTaperPlan === 'function') showNewTaperPlan();
    } finally {
        if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = false;
    }

    // Prefill relevant fields based on intent
    if (intent.reductionType && typeof populateTaperReductionTypeSelect === 'function') {
        const substanceId = typeof getTaperSubstanceId === 'function' ? getTaperSubstanceId() : null;
        try {
            populateTaperReductionTypeSelect(substanceId, intent.reductionType);
            const typeEl = document.getElementById('taper-reduction-type');
            if (typeEl) typeEl.value = intent.reductionType;
            if (typeof toggleTaperPlanTypeFields === 'function') {
                toggleTaperPlanTypeFields({ selectedType: intent.reductionType, skipPrefill: false });
            }
        } catch (_) { /* ignore */ }
    }

    if (intent.id === 'quit-by-date') {
        const goalEl = document.getElementById('taper-goal-daily')
            || document.getElementById('goal-daily-average')
            || document.getElementById('taper-goal-avg');
        if (goalEl) goalEl.value = '0';
    }

    if (intent.id === 'custom' || intent.id === 'use-less' || intent.id === 'quit-by-date') {
        // Show advanced block for custom; keep simpler fields visible otherwise
    }

    applySimplePlanFormLayout();
    document.getElementById('taper-setup')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function openSimplePlanWizard() {
    const wizard = typeof document !== 'undefined'
        ? document.getElementById('simple-plan-wizard')
        : null;
    if (!wizard) {
        // Tests / missing DOM — open the real taper form without looping.
        if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = true;
        try {
            if (typeof showNewTaperPlan === 'function') showNewTaperPlan();
        } finally {
            if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = false;
        }
        return;
    }
    wizard.classList.remove('hidden');
    wizard.innerHTML = `
        <div class="sm-plan-wizard-card">
            <h3>What are you trying to do?</h3>
            <p class="settings-hint">We’ll only show the settings that match what you’re trying to do.</p>
            <div class="sm-plan-intent-grid">
                ${SIMPLE_PLAN_INTENTS.map(intent => `
                    <button type="button" class="sm-plan-intent-btn" onclick="applySimplePlanIntent('${intent.id}')">
                        <strong>${escapeHtml(intent.label)}</strong>
                        <span>${escapeHtml(intent.hint)}</span>
                    </button>`).join('')}
            </div>
            <button type="button" class="secondary-btn btn-sm" onclick="closeSimplePlanWizard()">Cancel</button>
        </div>`;
    wizard.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeSimplePlanWizard() {
    document.getElementById('simple-plan-wizard')?.classList.add('hidden');
}

function applySimplePlanFormLayout(data = appData) {
    if (typeof document === 'undefined') return;
    const page = document.getElementById('goals-plans-tab');
    if (!page) return;
    const simple = isSimpleExperienceMode(data);
    page.classList.toggle('sm-plan-simple', simple);
    const prefs = ensureSimpleModePrefs(data);
    const intent = prefs.planIntent;
    page.dataset.planIntent = intent || '';

    // Hide purchase-heavy / advanced blocks unless Custom or Advanced Mode
    const advancedBlocks = page.querySelectorAll('[data-sm-plan-advanced="true"]');
    advancedBlocks.forEach(el => {
        el.classList.toggle('sm-hidden-in-simple', simple && intent !== 'custom');
    });
}

function syncExperienceModeSettingsUI(data = appData) {
    if (typeof document === 'undefined') return;
    const mode = getExperienceMode(data);
    const select = document.getElementById('experience-mode');
    if (select) select.value = mode;
    document.querySelectorAll('[data-experience-mode]').forEach(btn => {
        const active = btn.getAttribute('data-experience-mode') === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function onExperienceModeChange(value) {
    const next = normalizeExperienceMode(value);
    const prev = getExperienceMode(appData);
    persistExperienceMode(next);
    syncExperienceModeSettingsUI();
    // Leaving Advanced → Simple while on Inventory: return Home (Inventory stays reachable via Settings → Advanced/More)
    if (prev === EXPERIENCE_MODE_ADVANCED && next === EXPERIENCE_MODE_SIMPLE
        && appData.settings?.activeTab === 'buy-tracker-tab'
        && typeof switchTab === 'function') {
        switchTab('dashboard-tab');
    }
}

function updateBottomNavForExperienceMode(data = appData) {
    if (typeof document === 'undefined' || !document.body?.classList) return;
    const simple = isSimpleExperienceMode(data);
    document.body.classList.toggle('experience-simple', simple);
    document.body.classList.toggle('experience-advanced', !simple);

    const inventoryBtn = document.querySelector('.bottom-nav .nav-btn[data-tab="buy-tracker-tab"]');
    if (inventoryBtn) {
        inventoryBtn.classList.toggle('sm-nav-hidden', simple);
        inventoryBtn.setAttribute('aria-hidden', simple ? 'true' : 'false');
    }

    const insightsBtn = document.querySelector('.bottom-nav .nav-btn[data-tab="insights-calendar-tab"]');
    if (insightsBtn) {
        const full = insightsBtn.querySelector('.nav-btn-label-full');
        const short = insightsBtn.querySelector('.nav-btn-label-short');
        if (full) full.textContent = simple ? 'Progress' : 'Insights & Calendar';
        if (short) short.textContent = simple ? 'Progress' : 'Insights';
    }

    const plansBtn = document.querySelector('.bottom-nav .nav-btn[data-tab="goals-plans-tab"]');
    if (plansBtn) {
        const full = plansBtn.querySelector('.nav-btn-label-full');
        const short = plansBtn.querySelector('.nav-btn-label-short');
        if (full) full.textContent = simple ? 'Plan' : 'Tapers';
        if (short) short.textContent = simple ? 'Plan' : 'Tapers';
    }
}

function applyExperienceMode(data = appData) {
    ensureExperienceMode(data);
    const simple = isSimpleExperienceMode(data);
    if (typeof document === 'undefined' || !document.body?.classList) return;

    document.body.classList.toggle('experience-simple', simple);
    document.body.classList.toggle('experience-advanced', !simple);

    updateBottomNavForExperienceMode(data);
    syncExperienceModeSettingsUI(data);
    applySimpleLogFormLayout(data);
    applySimplePlanFormLayout(data);

    const dash = document.getElementById('dashboard-tab');
    if (dash) {
        dash.classList.toggle('sm-home-active', simple);
        if (!simple) dash.classList.remove('sm-show-advanced-home');
    }

    const insights = document.getElementById('insights-calendar-tab');
    if (insights) {
        insights.classList.toggle('sm-progress-active', simple);
        if (!simple) insights.classList.remove('sm-show-detailed-analytics');
    }

    const gp = document.getElementById('goals-plans-tab');
    if (gp) {
        const title = gp.querySelector('.combined-page-header h2');
        if (title) title.textContent = simple ? 'Plan' : 'Tapers';
        const hint = gp.querySelector('.combined-page-header .settings-hint');
        if (hint) {
            hint.textContent = simple
                ? 'Set a simple plan for how you want use to change.'
                : 'Tapers define a gradual reduction path.';
        }
    }

    if (simple) {
        renderSimpleHome(data);
        renderSimpleProgress(data);
    }
}

function initExperienceMode() {
    ensureExperienceMode(appData);
    applyExperienceMode(appData);

    // Hook new-plan buttons in simple mode toward wizard
    if (typeof document !== 'undefined') {
        document.getElementById('sm-new-plan-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            openSimplePlanWizard();
        });
    }
}

function onExperienceModeAfterUseLogSave() {
    try {
        rememberQuickLogFromForm(appData);
    } catch (err) {
        console.warn('[experience-mode] quick log memory failed', err);
    }
    if (isSimpleExperienceMode()) {
        renderSimpleHome(appData);
        renderSimpleProgress(appData);
    }
}

function onExperienceModeTabChange(tabId) {
    if (!isSimpleExperienceMode()) return;
    if (tabId === 'dashboard-tab') {
        hideAdvancedHomeDashboard();
        renderSimpleHome(appData);
    } else if (tabId === 'insights-calendar-tab') {
        document.getElementById('insights-calendar-tab')?.classList.remove('sm-show-detailed-analytics');
        renderSimpleProgress(appData);
    } else if (tabId === 'use-log-tab') {
        applySimpleLogFormLayout(appData);
    } else if (tabId === 'goals-plans-tab') {
        applySimplePlanFormLayout(appData);
    } else if (tabId === 'settings-tab') {
        syncExperienceModeSettingsUI(appData);
    }
}
