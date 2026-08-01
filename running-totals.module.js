// ——— Running Totals (Insights → Use Analytics) ———
// Cumulative personal-use sessions with product-specific units.
// Spliced into app.js ahead of `const defaultData`. Never mutates source records.

const RUNNING_TOTALS_RESET_MODES = Object.freeze([
    'daily', 'weekly', 'monthly', 'yearly', 'selected-range', 'inventory', 'lifetime'
]);

const RUNNING_TOTALS_GROUP_BY = Object.freeze([
    'session', 'day', 'week', 'month', 'inventory'
]);

function rtNum(value, fallback = 0) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function rtRound(value, digits = 4) {
    const n = rtNum(value, null);
    if (n == null) return null;
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function rtTrim(value) {
    return String(value ?? '').trim();
}

function rtEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
}

function rtToday() {
    return typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().slice(0, 10);
}

function rtIsAll(substanceId) {
    const id = rtTrim(substanceId);
    return !id || id === 'all' || (typeof DASHBOARD_ALL !== 'undefined' && id === DASHBOARD_ALL);
}

function getDefaultRunningTotalsPrefs() {
    return {
        filters: {
            substanceId: 'all',
            productType: '',
            dateRangePreset: 'last-30',
            customStart: '',
            customEnd: '',
            transactionType: '',
            personalUseOnly: true,
            includeSharedPersonal: true,
            groupBy: 'session',
            resetMode: 'daily',
            newestFirst: true,
            showTargetLine: true,
            showCbdRunning: true
        }
    };
}

function ensureRunningTotalsPrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultRunningTotalsPrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultRunningTotalsPrefs();
    if (!data.settings.runningTotals || typeof data.settings.runningTotals !== 'object') {
        data.settings.runningTotals = {
            filters: { ...defaults.filters }
        };
    }
    const prefs = data.settings.runningTotals;
    prefs.filters = { ...defaults.filters, ...(prefs.filters || {}) };
    if (!RUNNING_TOTALS_RESET_MODES.includes(prefs.filters.resetMode)) prefs.filters.resetMode = 'daily';
    if (!RUNNING_TOTALS_GROUP_BY.includes(prefs.filters.groupBy)) prefs.filters.groupBy = 'session';
    return prefs;
}

function getRunningTotalsPrefs(data = appData) {
    return ensureRunningTotalsPrefs(data);
}

function persistRunningTotalsPrefs(patch = {}, data = appData) {
    const prefs = ensureRunningTotalsPrefs(data);
    if (patch.filters) prefs.filters = { ...prefs.filters, ...patch.filters };
    if (typeof saveData === 'function') saveData(data);
    return prefs;
}

function resolveRunningTotalsBounds(filters, data = appData) {
    const f = { ...getDefaultRunningTotalsPrefs().filters, ...(filters || {}) };
    if (typeof resolveFinancialBounds === 'function') {
        return resolveFinancialBounds({
            dateRangePreset: f.dateRangePreset,
            customStart: f.customStart,
            customEnd: f.customEnd
        }, data);
    }
    return {
        startDate: f.customStart || '',
        endDate: f.customEnd || rtToday(),
        label: f.dateRangePreset,
        incomplete: false
    };
}

function runningTotalsWeekStartPref(data = appData) {
    try {
        if (typeof getCalendarViewPrefs === 'function') {
            const ws = getCalendarViewPrefs(data)?.weekStarts;
            if (ws === 'monday' || ws === 'sunday') return ws;
        }
    } catch (_) { /* optional */ }
    return data?.settings?.calendarView?.weekStarts === 'monday' ? 'monday' : 'sunday';
}

function runningTotalsWeekKey(dateStr, data = appData) {
    const weekStarts = runningTotalsWeekStartPref(data);
    if (typeof resolveCalendarPeriodBounds === 'function') {
        const bounds = resolveCalendarPeriodBounds('week', dateStr, weekStarts);
        if (bounds?.startDate) return bounds.startDate;
    }
    if (typeof parseLocalDate === 'function' && typeof getLocalDateString === 'function') {
        const d = parseLocalDate(dateStr);
        if (d) {
            const dow = d.getDay();
            const offset = weekStarts === 'monday' ? ((dow + 6) % 7) : dow;
            d.setDate(d.getDate() - offset);
            return getLocalDateString(d);
        }
    }
    if (typeof getWeekStartDateStr === 'function') return getWeekStartDateStr(dateStr);
    return String(dateStr || '').slice(0, 10);
}

function runningTotalsMonthKey(dateStr) {
    return String(dateStr || '').slice(0, 7);
}

function runningTotalsYearKey(dateStr) {
    return String(dateStr || '').slice(0, 4);
}

function isRunningTotalsEligibleLog(log, filters = {}, data = appData) {
    if (!log) return false;
    if (log.isDistributedChild) return false;
    if (typeof isAlcoholMultiDayChildLog === 'function' && isAlcoholMultiDayChildLog(log)) return false;
    if (log.parentPercentLogId != null && log.isEstimatedDailyUse) return false;

    const tx = typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : (log.transactionType || 'use');
    if (tx === 'gift_given' || tx === 'gift_received' || tx === 'inventory_adjustment') return false;
    if (filters.transactionType && tx !== filters.transactionType) return false;

    if (filters.personalUseOnly !== false) {
        if (tx === 'use') return true;
        if (tx === 'shared_use') return filters.includeSharedPersonal !== false;
        return false;
    }
    return tx === 'use' || tx === 'shared_use';
}

function getRunningTotalsProductType(log, data = appData) {
    if (typeof normalizeWeedProductType === 'function' && typeof isWeedTrackingMode === 'function') {
        const sid = typeof getUseSubstanceId === 'function' ? getUseSubstanceId(log, data) : log.substanceId;
        if (isWeedTrackingMode(sid, data)) {
            return normalizeWeedProductType(log.weedProductType || '', { allowEmpty: true }) || '';
        }
    }
    if (typeof getNicotineProductType === 'function' && typeof isNicotineTrackingMode === 'function') {
        const sid = typeof getUseSubstanceId === 'function' ? getUseSubstanceId(log, data) : log.substanceId;
        if (isNicotineTrackingMode(sid, data)) return getNicotineProductType(log, data) || '';
    }
    return rtTrim(log.weedProductType || log.productType || log.nicotineProductType || '');
}

/**
 * Returns session display measure + accumulate measure for running totals.
 * accumulateAmount is what increments running totals (may differ from session, e.g. THC mg).
 */
function getRunningTotalsSessionMeasure(log, data = appData) {
    const sid = typeof getUseSubstanceId === 'function' ? getUseSubstanceId(log, data) : log.substanceId;
    const personal = typeof getLogStatsAmount === 'function' ? rtNum(getLogStatsAmount(log), 0) : rtNum(log.amount, 0);
    const productType = getRunningTotalsProductType(log, data);

    if (typeof isWeedTrackingMode === 'function' && isWeedTrackingMode(sid, data)) {
        if (productType === 'cart' || (typeof isWeedCartPercentLog === 'function' && isWeedCartPercentLog(log, data))) {
            const pct = rtNum(log.estimatedPercentUsed ?? personal, 0);
            return {
                sessionAmount: pct,
                sessionUnit: '%',
                accumulateAmount: pct,
                accumulateUnit: '%',
                productType: 'cart',
                unitFamily: 'percent'
            };
        }
        if (productType === 'edibles' || (typeof isWeedEdiblesLog === 'function' && isWeedEdiblesLog(log, data))) {
            const thc = typeof getWeedEdibleLogThcUsed === 'function' ? getWeedEdibleLogThcUsed(log) : null;
            const cbd = typeof getWeedEdibleLogCbdUsed === 'function' ? getWeedEdibleLogCbdUsed(log) : null;
            return {
                sessionAmount: personal,
                sessionUnit: 'edible',
                accumulateAmount: thc != null ? thc : personal,
                accumulateUnit: thc != null ? 'mg THC' : 'edible',
                secondaryAccumulate: cbd != null ? cbd : null,
                secondaryUnit: 'mg CBD',
                productType: 'edibles',
                unitFamily: thc != null ? 'thc_mg' : 'count'
            };
        }
        if (productType === 'pre-rolls') {
            const grams = rtNum(log.normalizedGrams, null);
            return {
                sessionAmount: personal,
                sessionUnit: 'pre-roll',
                accumulateAmount: personal,
                accumulateUnit: 'pre-roll',
                secondaryAccumulate: grams,
                secondaryUnit: 'g',
                productType: 'pre-rolls',
                unitFamily: 'count'
            };
        }
        // Bud / default weed
        const grams = rtNum(log.normalizedGrams ?? (log.unit === 'grams' || log.unit === 'g' ? log.amount : personal), personal);
        return {
            sessionAmount: grams,
            sessionUnit: 'g',
            accumulateAmount: grams,
            accumulateUnit: 'g',
            productType: productType || 'bud',
            unitFamily: 'mass_g'
        };
    }

    if (typeof isNicotineTrackingMode === 'function' && isNicotineTrackingMode(sid, data)) {
        return {
            sessionAmount: personal,
            sessionUnit: 'puffs',
            accumulateAmount: personal,
            accumulateUnit: 'puffs',
            productType: productType || 'vape',
            unitFamily: 'puffs'
        };
    }

    const trackingMode = (() => {
        const sub = (data?.substances || []).find(s => String(s.id) === String(sid));
        return String(sub?.trackingMode || '').toLowerCase();
    })();

    if ((typeof isLsdSubstanceId === 'function' && isLsdSubstanceId(sid, data)) || trackingMode === 'lsd') {
        const ug = rtNum(log.ugUsed ?? log.amount, personal);
        const tabs = rtNum(log.tabsUsed, null);
        return {
            sessionAmount: tabs != null ? tabs : ug,
            sessionUnit: tabs != null ? 'tabs' : 'µg',
            accumulateAmount: ug,
            accumulateUnit: 'µg',
            productType: '',
            unitFamily: 'ug'
        };
    }

    if ((typeof isXanaxSubstanceId === 'function' && isXanaxSubstanceId(sid, data)) || trackingMode === 'xanax') {
        const mg = rtNum(log.mgUsed, null);
        const pills = rtNum(log.pillsUsed ?? log.amount, personal);
        return {
            sessionAmount: pills,
            sessionUnit: 'pills',
            accumulateAmount: mg != null ? mg : pills,
            accumulateUnit: mg != null ? 'mg' : 'pills',
            productType: '',
            unitFamily: 'mg'
        };
    }

    const unit = log.unit || (typeof getSubstancePrimaryUnit === 'function' ? getSubstancePrimaryUnit(sid, data) : 'g') || 'g';
    return {
        sessionAmount: personal,
        sessionUnit: unit,
        accumulateAmount: personal,
        accumulateUnit: unit,
        productType: productType || '',
        unitFamily: 'auto'
    };
}

function getRunningTotalsResetKey(dateStr, resetMode, inventoryId, data = appData) {
    if (resetMode === 'lifetime' || resetMode === 'selected-range') return 'all';
    if (resetMode === 'inventory') return inventoryId ? String(inventoryId) : 'unlinked';
    if (resetMode === 'yearly') return runningTotalsYearKey(dateStr);
    if (resetMode === 'monthly') return runningTotalsMonthKey(dateStr);
    if (resetMode === 'weekly') return runningTotalsWeekKey(dateStr, data);
    return dateStr; // daily — local calendar date, resets at midnight
}

function getRunningTotalsTarget(substanceId, data = appData) {
    try {
        if (typeof getActiveTaperPlan === 'function') {
            const plan = getActiveTaperPlan(substanceId, data);
            const today = rtToday();
            const week = plan?.weeklyTargets?.find(w => (w.weekStart || '') <= today && (w.weekEnd || '9999') >= today);
            if (week?.targetAmount != null) return { value: rtNum(week.targetAmount, null), label: 'Weekly taper target' };
            if (plan?.currentWeeklyTarget != null) return { value: rtNum(plan.currentWeeklyTarget, null), label: 'Plan target' };
        }
    } catch (_) { /* optional */ }
    return null;
}

function collectRunningTotalsLogs(filters, data = appData) {
    const bounds = resolveRunningTotalsBounds(filters, data);
    const f = { ...getDefaultRunningTotalsPrefs().filters, ...filters };
    const logs = (data.logs || []).filter(log => {
        if (!isRunningTotalsEligibleLog(log, f, data)) return false;
        if (!log.date) return false;
        if (bounds.startDate && log.date < bounds.startDate) return false;
        if (bounds.endDate && log.date > bounds.endDate) return false;
        if (!rtIsAll(f.substanceId)) {
            if (typeof logMatchesSubstance === 'function') {
                if (!logMatchesSubstance(log, f.substanceId, data)) return false;
            } else {
                const sid = typeof getUseSubstanceId === 'function' ? getUseSubstanceId(log, data) : log.substanceId;
                if (String(sid) !== String(f.substanceId)) return false;
            }
        }
        if (f.productType) {
            if (getRunningTotalsProductType(log, data) !== f.productType) return false;
        }
        return true;
    });

    // Chronological for calculation
    logs.sort((a, b) => {
        const da = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(a) : 0;
        const db = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(b) : 0;
        if (da !== db) return da - db;
        return String(a.id).localeCompare(String(b.id));
    });
    return { logs, bounds };
}

function buildRunningTotalsRows(filters, data = appData) {
    const f = { ...getDefaultRunningTotalsPrefs().filters, ...filters };
    const { logs, bounds } = collectRunningTotalsLogs(f, data);
    const dayRun = new Map();
    const weekRun = new Map();
    const monthRun = new Map();
    const rangeRun = new Map(); // key: substanceId::unitFamily
    const invRun = new Map();
    const resetRun = new Map(); // for chart primary running series per reset mode

    const rows = [];
    logs.forEach(log => {
        const sid = typeof getUseSubstanceId === 'function' ? getUseSubstanceId(log, data) : log.substanceId;
        const measure = getRunningTotalsSessionMeasure(log, data);
        const seriesKey = `${sid}::${measure.unitFamily}::${measure.accumulateUnit}`;
        const invId = typeof getLogPurchaseId === 'function'
            ? getLogPurchaseId(log)
            : (log.purchaseId || log.linkedPurchaseId || log.inventoryId || '');
        const dateStr = log.date;
        const dayKey = `${seriesKey}::${dateStr}`;
        const weekKey = `${seriesKey}::${runningTotalsWeekKey(dateStr, data)}`;
        const monthKey = `${seriesKey}::${runningTotalsMonthKey(dateStr)}`;
        const amt = rtNum(measure.accumulateAmount, 0);
        const secondary = measure.secondaryAccumulate != null ? rtNum(measure.secondaryAccumulate, 0) : null;

        dayRun.set(dayKey, (dayRun.get(dayKey) || 0) + amt);
        weekRun.set(weekKey, (weekRun.get(weekKey) || 0) + amt);
        monthRun.set(monthKey, (monthRun.get(monthKey) || 0) + amt);
        rangeRun.set(seriesKey, (rangeRun.get(seriesKey) || 0) + amt);
        if (invId) {
            const ik = `${seriesKey}::${invId}`;
            invRun.set(ik, (invRun.get(ik) || 0) + amt);
        }

        const resetKey = `${seriesKey}::${getRunningTotalsResetKey(dateStr, f.resetMode, invId, data)}`;
        resetRun.set(resetKey, (resetRun.get(resetKey) || 0) + amt);

        let secondaryDay = null;
        let secondaryWeek = null;
        let secondaryMonth = null;
        let secondaryRange = null;
        if (secondary != null && measure.secondaryUnit) {
            const sKey = `${seriesKey}::sec`;
            const sd = `${sKey}::${dateStr}`;
            const sw = `${sKey}::${runningTotalsWeekKey(dateStr, data)}`;
            const sm = `${sKey}::${runningTotalsMonthKey(dateStr)}`;
            dayRun.set(sd, (dayRun.get(sd) || 0) + secondary);
            weekRun.set(sw, (weekRun.get(sw) || 0) + secondary);
            monthRun.set(sm, (monthRun.get(sm) || 0) + secondary);
            rangeRun.set(sKey, (rangeRun.get(sKey) || 0) + secondary);
            secondaryDay = dayRun.get(sd);
            secondaryWeek = weekRun.get(sw);
            secondaryMonth = monthRun.get(sm);
            secondaryRange = rangeRun.get(sKey);
        }

        const purchase = invId && typeof findPurchase === 'function' ? findPurchase(invId, data) : null;
        const invLabel = purchase
            ? (typeof formatWeedPurchaseDisplayLine === 'function' && typeof isWeedPurchase === 'function' && isWeedPurchase(purchase, data)
                ? formatWeedPurchaseDisplayLine(purchase)
                : `${purchase.date || ''} · ${rtNum(purchase.remainingAmount, 0)} left`)
            : (invId ? String(invId) : '—');

        rows.push({
            id: log.id,
            substanceId: sid,
            substanceName: typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(sid, data) : sid,
            date: dateStr,
            time: log.startTime || log.time || '',
            datetimeMs: typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(log) : 0,
            sessionAmount: rtRound(measure.sessionAmount, 4),
            sessionUnit: measure.sessionUnit,
            productType: measure.productType,
            productTypeLabel: measure.productType
                ? (typeof getWeedProductTypeLabel === 'function' ? getWeedProductTypeLabel(measure.productType) : measure.productType)
                : '—',
            accumulateAmount: rtRound(amt, 4),
            accumulateUnit: measure.accumulateUnit,
            unitFamily: measure.unitFamily,
            runningDaily: rtRound(dayRun.get(dayKey), 4),
            runningWeekly: rtRound(weekRun.get(weekKey), 4),
            runningMonthly: rtRound(monthRun.get(monthKey), 4),
            runningRange: rtRound(rangeRun.get(seriesKey), 4),
            runningInventory: invId ? rtRound(invRun.get(`${seriesKey}::${invId}`), 4) : null,
            runningReset: rtRound(resetRun.get(resetKey), 4),
            secondaryUnit: measure.secondaryUnit || '',
            secondarySession: secondary != null ? rtRound(secondary, 4) : null,
            secondaryDaily: secondaryDay != null ? rtRound(secondaryDay, 4) : null,
            secondaryWeekly: secondaryWeek != null ? rtRound(secondaryWeek, 4) : null,
            secondaryMonthly: secondaryMonth != null ? rtRound(secondaryMonth, 4) : null,
            secondaryRange: secondaryRange != null ? rtRound(secondaryRange, 4) : null,
            inventoryId: invId || '',
            inventoryLabel: invLabel,
            notes: log.notes || '',
            transactionType: typeof getLogTransactionType === 'function' ? getLogTransactionType(log) : log.transactionType,
            seriesKey
        });
    });

    return { rows, bounds, filters: f };
}

function groupRunningTotalsRows(rows, groupBy) {
    if (!groupBy || groupBy === 'session') return rows;
    const map = new Map();
    rows.forEach(row => {
        let key;
        if (groupBy === 'day') key = `${row.seriesKey}::${row.date}`;
        else if (groupBy === 'week') key = `${row.seriesKey}::${runningTotalsWeekKey(row.date)}`; // week key uses default appData week-start
        else if (groupBy === 'month') key = `${row.seriesKey}::${runningTotalsMonthKey(row.date)}`;
        else if (groupBy === 'inventory') key = `${row.seriesKey}::${row.inventoryId || 'unlinked'}`;
        else key = row.id;
        if (!map.has(key)) {
            map.set(key, {
                ...row,
                id: key,
                time: groupBy === 'session' ? row.time : '',
                sessionAmount: 0,
                accumulateAmount: 0,
                secondarySession: row.secondarySession != null ? 0 : null,
                notes: '',
                grouped: true,
                groupCount: 0
            });
        }
        const g = map.get(key);
        g.sessionAmount = rtRound((g.sessionAmount || 0) + (row.sessionAmount || 0), 4);
        g.accumulateAmount = rtRound((g.accumulateAmount || 0) + (row.accumulateAmount || 0), 4);
        if (g.secondarySession != null && row.secondarySession != null) {
            g.secondarySession = rtRound(g.secondarySession + row.secondarySession, 4);
        }
        g.runningDaily = row.runningDaily;
        g.runningWeekly = row.runningWeekly;
        g.runningMonthly = row.runningMonthly;
        g.runningRange = row.runningRange;
        g.runningInventory = row.runningInventory;
        g.runningReset = row.runningReset;
        g.secondaryDaily = row.secondaryDaily;
        g.secondaryWeekly = row.secondaryWeekly;
        g.secondaryMonthly = row.secondaryMonthly;
        g.secondaryRange = row.secondaryRange;
        g.groupCount += 1;
        g.datetimeMs = Math.max(g.datetimeMs || 0, row.datetimeMs || 0);
        if (row.date > g.date) g.date = row.date;
    });
    return [...map.values()].sort((a, b) => (a.datetimeMs || 0) - (b.datetimeMs || 0));
}

function buildRunningTotalsDataset(data = appData, options = {}) {
    const prefs = ensureRunningTotalsPrefs(data);
    const filters = { ...prefs.filters, ...(options.filters || {}) };
    const built = buildRunningTotalsRows(filters, data);
    let rows = groupRunningTotalsRows(built.rows, filters.groupBy);
    const bySubstance = new Map();
    rows.forEach(row => {
        if (!bySubstance.has(row.substanceId)) bySubstance.set(row.substanceId, []);
        bySubstance.get(row.substanceId).push(row);
    });

    // Display order
    const displayRows = filters.newestFirst === false
        ? rows
        : [...rows].sort((a, b) => (b.datetimeMs || 0) - (a.datetimeMs || 0));

    const series = [...bySubstance.entries()].map(([sid, substanceRows]) => {
        const chrono = [...substanceRows].sort((a, b) => (a.datetimeMs || 0) - (b.datetimeMs || 0));
        const target = getRunningTotalsTarget(sid, data);
        return {
            substanceId: sid,
            label: substanceRows[0]?.substanceName || sid,
            unit: substanceRows[0]?.accumulateUnit || '',
            unitFamily: substanceRows[0]?.unitFamily || 'auto',
            points: chrono.map(r => ({
                key: r.date + (r.time ? ` ${r.time}` : ''),
                date: r.date,
                session: r.sessionAmount,
                running: r.runningReset,
                unit: r.accumulateUnit
            })),
            target
        };
    });

    const incompatible = series.length > 1 && new Set(series.map(s => s.unitFamily)).size > 1;

    return {
        generatedAt: new Date().toISOString(),
        filters,
        bounds: built.bounds,
        rows: displayRows,
        calcRows: rows,
        series,
        incompatible,
        partial: !!built.bounds?.incomplete,
        empty: displayRows.length === 0,
        state: displayRows.length ? 'ok' : 'empty'
    };
}

function formatRunningTotalsAmount(value, unit) {
    if (value == null || !Number.isFinite(value)) return '—';
    const formatted = typeof formatAmount === 'function' ? formatAmount(value) : String(value);
    return unit ? `${formatted} ${unit}` : formatted;
}

function renderRunningTotalsChartSvg(seriesList, options = {}) {
    const series = seriesList?.[0];
    if (!series?.points?.length) return '<p class="rt-empty">No chart data.</p>';
    const width = options.width || 640;
    const height = options.height || 220;
    const pad = { t: 16, r: 12, b: 36, l: 44 };
    const points = series.points;
    const yMax = Math.max(
        ...points.map(p => p.session || 0),
        ...points.map(p => p.running || 0),
        series.target?.value || 0,
        1
    );
    const xScale = i => pad.l + (points.length <= 1 ? (width - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (width - pad.l - pad.r));
    const yScale = v => height - pad.b - (v / yMax) * (height - pad.t - pad.b);
    const barW = Math.max(4, Math.min(18, (width - pad.l - pad.r) / Math.max(points.length, 1) * 0.55));
    const bars = points.map((p, i) => {
        const x = xScale(i) - barW / 2;
        const y = yScale(p.session || 0);
        const h = Math.max(0, height - pad.b - y);
        return `<rect class="rt-bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="2"><title>${rtEsc(p.key)}: ${rtEsc(p.session)} ${rtEsc(series.unit)}</title></rect>`;
    }).join('');
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.running || 0)}`).join(' ');
    const targetLine = options.showTarget && series.target?.value != null
        ? `<line class="rt-target" x1="${pad.l}" y1="${yScale(series.target.value)}" x2="${width - pad.r}" y2="${yScale(series.target.value)}" />
           <text class="rt-axis-label" x="${width - pad.r}" y="${yScale(series.target.value) - 4}" text-anchor="end">${rtEsc(series.target.label || 'Target')}</text>`
        : '';
    return `<svg class="rt-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Running totals chart">
        <line class="rt-axis" x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" />
        <line class="rt-axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" />
        ${bars}
        <path class="rt-line" d="${line}" fill="none" />
        ${targetLine}
        <text class="rt-axis-label" x="${pad.l}" y="${pad.t + 4}">${rtEsc(yMax)} ${rtEsc(series.unit)}</text>
    </svg>
    <p class="settings-hint">Bars = session amount · Line = running total (${rtEsc(options.resetMode || 'daily')} reset)${series.target ? ' · Dashed = target' : ''}</p>`;
}

function renderRunningTotalsTableHtml(dataset) {
    if (dataset.empty) {
        return '<div class="rt-empty" role="status">No personal-use sessions in this range.</div>';
    }
    const showCbd = dataset.filters.showCbdRunning !== false;
    const rows = dataset.rows.map(row => {
        const cbdCell = showCbd && row.secondaryUnit === 'mg CBD' && row.secondaryRange != null
            ? `<td>${formatRunningTotalsAmount(row.secondaryRange, 'mg CBD')}</td>`
            : (showCbd ? '<td>—</td>' : '');
        const gramsCell = row.secondaryUnit === 'g' && row.secondarySession != null
            ? `<td>${formatRunningTotalsAmount(row.secondarySession, 'g')}</td>`
            : '<td>—</td>';
        return `<tr>
            <td>${rtEsc(typeof formatDate === 'function' ? formatDate(row.date) : row.date)}</td>
            <td>${rtEsc(row.time || '—')}</td>
            <td>${formatRunningTotalsAmount(row.sessionAmount, row.sessionUnit)}</td>
            <td>${rtEsc(row.productTypeLabel || '—')}</td>
            <td>${formatRunningTotalsAmount(row.runningDaily, row.accumulateUnit)}</td>
            <td>${formatRunningTotalsAmount(row.runningWeekly, row.accumulateUnit)}</td>
            <td>${formatRunningTotalsAmount(row.runningMonthly, row.accumulateUnit)}</td>
            <td>${formatRunningTotalsAmount(row.runningRange, row.accumulateUnit)}</td>
            <td>${row.runningInventory != null ? formatRunningTotalsAmount(row.runningInventory, row.accumulateUnit) : '—'}</td>
            <td>${rtEsc(row.inventoryLabel || '—')}</td>
            <td>${rtEsc(row.notes || '')}</td>
            ${showCbd ? cbdCell : ''}
            ${gramsCell}
        </tr>`;
    }).join('');

    return `<div class="table-scroll rt-table-wrap"><table class="sheet-table rt-table">
        <thead><tr>
            <th>Date</th><th>Time</th><th>Session amount</th><th>Product type</th>
            <th>Running daily</th><th>Running weekly</th><th>Running monthly</th>
            <th>Running selected range</th><th>Running inventory</th>
            <th>Linked inventory</th><th>Notes</th>
            ${showCbd ? '<th>Running CBD</th>' : ''}
            <th>Session grams</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table></div>`;
}

function renderRunningTotalsView() {
    const root = typeof document !== 'undefined' ? document.getElementById('running-totals-root') : null;
    if (!root) return;
    root.innerHTML = '<div class="rt-loading" role="status">Loading running totals…</div>';
    try {
        const prefs = ensureRunningTotalsPrefs(appData);
        const dataset = buildRunningTotalsDataset(appData);
        const f = dataset.filters;
        const substanceOptions = (typeof getActiveSubstances === 'function' ? getActiveSubstances() : (appData.substances || []))
            .map(s => `<option value="${rtEsc(s.id)}"${String(f.substanceId) === String(s.id) ? ' selected' : ''}>${rtEsc(s.name)}</option>`)
            .join('');
        const resetOptions = RUNNING_TOTALS_RESET_MODES.map(m =>
            `<option value="${m}"${f.resetMode === m ? ' selected' : ''}>${m.replace(/-/g, ' ')}</option>`
        ).join('');
        const groupOptions = RUNNING_TOTALS_GROUP_BY.map(m =>
            `<option value="${m}"${f.groupBy === m ? ' selected' : ''}>${m}</option>`
        ).join('');

        const charts = dataset.incompatible
            ? dataset.series.map(s => `<section class="rt-chart-block"><h4>${rtEsc(s.label)} (${rtEsc(s.unit)})</h4>${renderRunningTotalsChartSvg([s], { showTarget: f.showTargetLine, resetMode: f.resetMode })}</section>`).join('')
            : renderRunningTotalsChartSvg(dataset.series, { showTarget: f.showTargetLine, resetMode: f.resetMode });

        const tables = dataset.incompatible
            ? dataset.series.map(s => {
                const subset = { ...dataset, rows: dataset.rows.filter(r => r.substanceId === s.substanceId), empty: false };
                return `<section class="rt-table-block"><h4>${rtEsc(s.label)}</h4>${renderRunningTotalsTableHtml(subset)}</section>`;
            }).join('')
            : renderRunningTotalsTableHtml(dataset);

        root.innerHTML = `
            <div class="rt-dashboard">
                <div class="rt-filters">
                    <label>Substance
                        <select id="rt-filter-substance" onchange="onRunningTotalsFilterChange()">
                            <option value="all"${rtIsAll(f.substanceId) ? ' selected' : ''}>All Substances</option>
                            ${substanceOptions}
                        </select>
                    </label>
                    <label>Product type
                        <select id="rt-filter-product" onchange="onRunningTotalsFilterChange()">
                            <option value="">All</option>
                            <option value="bud"${f.productType === 'bud' ? ' selected' : ''}>Bud</option>
                            <option value="cart"${f.productType === 'cart' ? ' selected' : ''}>Cart</option>
                            <option value="edibles"${f.productType === 'edibles' ? ' selected' : ''}>Edibles</option>
                            <option value="pre-rolls"${f.productType === 'pre-rolls' ? ' selected' : ''}>Pre-rolls</option>
                        </select>
                    </label>
                    <label>Date range
                        <select id="rt-filter-range" onchange="onRunningTotalsFilterChange()">
                            <option value="last-7"${f.dateRangePreset === 'last-7' ? ' selected' : ''}>Last 7 days</option>
                            <option value="last-30"${f.dateRangePreset === 'last-30' ? ' selected' : ''}>Last 30 days</option>
                            <option value="this-week"${f.dateRangePreset === 'this-week' ? ' selected' : ''}>This week</option>
                            <option value="this-month"${f.dateRangePreset === 'this-month' ? ' selected' : ''}>This month</option>
                            <option value="past-3-months"${f.dateRangePreset === 'past-3-months' ? ' selected' : ''}>Past 3 months</option>
                            <option value="this-year"${f.dateRangePreset === 'this-year' ? ' selected' : ''}>This year</option>
                            <option value="all-time"${f.dateRangePreset === 'all-time' ? ' selected' : ''}>All time</option>
                            <option value="custom"${f.dateRangePreset === 'custom' ? ' selected' : ''}>Custom</option>
                        </select>
                    </label>
                    <label class="${f.dateRangePreset === 'custom' ? '' : 'hidden'}">From
                        <input type="date" id="rt-filter-start" value="${rtEsc(f.customStart || '')}" onchange="onRunningTotalsFilterChange()">
                    </label>
                    <label class="${f.dateRangePreset === 'custom' ? '' : 'hidden'}">To
                        <input type="date" id="rt-filter-end" value="${rtEsc(f.customEnd || '')}" onchange="onRunningTotalsFilterChange()">
                    </label>
                    <label>Transaction type
                        <select id="rt-filter-tx" onchange="onRunningTotalsFilterChange()">
                            <option value="">Use + Shared Use</option>
                            <option value="use"${f.transactionType === 'use' ? ' selected' : ''}>Personal Use</option>
                            <option value="shared_use"${f.transactionType === 'shared_use' ? ' selected' : ''}>Shared Use</option>
                        </select>
                    </label>
                    <label>Reset mode
                        <select id="rt-filter-reset" onchange="onRunningTotalsFilterChange()">${resetOptions}</select>
                    </label>
                    <label>Group by
                        <select id="rt-filter-group" onchange="onRunningTotalsFilterChange()">${groupOptions}</select>
                    </label>
                    <label class="rt-check"><input type="checkbox" id="rt-filter-personal" ${f.personalUseOnly ? 'checked' : ''} onchange="onRunningTotalsFilterChange()"> Personal use only</label>
                    <label class="rt-check"><input type="checkbox" id="rt-filter-shared" ${f.includeSharedPersonal ? 'checked' : ''} onchange="onRunningTotalsFilterChange()"> Include Shared Use personal portion</label>
                    <label class="rt-check"><input type="checkbox" id="rt-filter-newest" ${f.newestFirst !== false ? 'checked' : ''} onchange="onRunningTotalsFilterChange()"> Newest first</label>
                    <label class="rt-check"><input type="checkbox" id="rt-filter-target" ${f.showTargetLine ? 'checked' : ''} onchange="onRunningTotalsFilterChange()"> Show target / taper line</label>
                </div>
                <p class="settings-hint">
                    ${dataset.bounds?.startDate || '…'} → ${dataset.bounds?.endDate || '…'}
                    ${dataset.partial ? ' · Partial period' : ''}
                    ${dataset.incompatible ? ' · All Substances: separate series (units not combined)' : ''}
                    · Calculated chronologically · Daily resets at local midnight · Weekly uses app week-start
                </p>
                <div class="rt-actions">
                    <button type="button" class="secondary-btn btn-sm" onclick="exportRunningTotalsCsv()">Export CSV</button>
                </div>
                <div class="rt-chart">${charts}</div>
                ${tables}
            </div>`;
    } catch (err) {
        console.error('[running-totals] render failed', err);
        root.innerHTML = `<div class="rt-error" role="alert"><p>Could not load running totals.</p><p class="settings-hint">${rtEsc(err?.message || String(err))}</p><button type="button" class="secondary-btn btn-sm" onclick="renderRunningTotalsView()">Retry</button></div>`;
    }
}

function onRunningTotalsFilterChange() {
    const g = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
    persistRunningTotalsPrefs({
        filters: {
            substanceId: g('rt-filter-substance')?.value || 'all',
            productType: g('rt-filter-product')?.value || '',
            dateRangePreset: g('rt-filter-range')?.value || 'last-30',
            customStart: g('rt-filter-start')?.value || '',
            customEnd: g('rt-filter-end')?.value || '',
            transactionType: g('rt-filter-tx')?.value || '',
            resetMode: g('rt-filter-reset')?.value || 'daily',
            groupBy: g('rt-filter-group')?.value || 'session',
            personalUseOnly: !!g('rt-filter-personal')?.checked,
            includeSharedPersonal: !!g('rt-filter-shared')?.checked,
            newestFirst: !!g('rt-filter-newest')?.checked,
            showTargetLine: !!g('rt-filter-target')?.checked
        }
    });
    renderRunningTotalsView();
}

function exportRunningTotalsCsv() {
    const dataset = buildRunningTotalsDataset(appData);
    const headers = [
        'date', 'time', 'substance', 'productType', 'sessionAmount', 'sessionUnit',
        'runningDaily', 'runningWeekly', 'runningMonthly', 'runningRange', 'runningInventory',
        'accumulateUnit', 'inventory', 'notes', 'secondarySession', 'secondaryUnit'
    ];
    const lines = [headers.join(',')];
    dataset.rows.forEach(row => {
        const vals = [
            row.date, row.time, row.substanceName, row.productType,
            row.sessionAmount, row.sessionUnit,
            row.runningDaily, row.runningWeekly, row.runningMonthly, row.runningRange,
            row.runningInventory ?? '',
            row.accumulateUnit, row.inventoryLabel, row.notes,
            row.secondarySession ?? '', row.secondaryUnit || ''
        ].map(v => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        });
        lines.push(vals.join(','));
    });
    const csv = lines.join('\n');
    if (typeof downloadTextFile === 'function') {
        downloadTextFile(`running-totals-${rtToday()}.csv`, csv, 'text/csv');
    }
    return csv;
}
