#!/usr/bin/env node
/**
 * Splice conditional-color-rules.module.js into app.js and patch integration points.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = join(root, 'app.js');
const modulePath = join(root, 'conditional-color-rules.module.js');

let app = readFileSync(appPath, 'utf8');
const mod = readFileSync(modulePath, 'utf8');

const BEGIN = '// ——— Conditional Color Rules ———';
const END_MARKER = '// ——— Spreadsheet-style status badges ———';

if (app.includes(BEGIN)) {
    const start = app.indexOf(BEGIN);
    const end = app.indexOf(END_MARKER, start);
    if (end < 0) throw new Error('Could not find status badges marker after existing CCR block');
    app = app.slice(0, start) + mod.trim() + '\n\n' + app.slice(end);
    console.log('Replaced existing Conditional Color Rules block in app.js');
} else {
    if (!app.includes(END_MARKER)) throw new Error('Status badges marker not found');
    app = app.replace(END_MARKER, `${mod.trim()}\n\n${END_MARKER}`);
    console.log('Inserted Conditional Color Rules block into app.js');
}

function replaceOnce(label, from, to) {
    if (!app.includes(from)) {
        console.warn(`Skip patch (${label}): target not found`);
        return;
    }
    if (app.includes(to) && to.length > 40) {
        // already patched roughly
    }
    const next = app.replace(from, to);
    if (next === app) console.warn(`Patch unchanged (${label})`);
    else {
        app = next;
        console.log(`Patched: ${label}`);
    }
}

// ensureAppDataSettings
replaceOnce(
    'ensureAppDataSettings',
    '    ensureInsightPrefs(data);\n    ensureComparePeriodsPrefs(data);',
    '    ensureConditionalColorRules(data);\n    ensureInsightPrefs(data);\n    ensureComparePeriodsPrefs(data);'
);

// defaultData settings
replaceOnce(
    'defaultData settings',
    `        appearanceSpacing: 'default'
    },`,
    `        appearanceSpacing: 'default',
        conditionalColorRules: null
    },`
);

// initializeApp hooks
replaceOnce(
    'initAppearanceZoom call',
    '    initAppearanceZoom();\n',
    '    initAppearanceZoom();\n    if (typeof initConditionalColorRulesUi === \'function\') initConditionalColorRulesUi();\n'
);

// Wrap getUsageVsTargetBadge to merge CCR labels/styles via side channel is hard;
// instead enhance renderStatusBadge and add helper used by callers.

replaceOnce(
    'renderStatusBadge',
    `function renderStatusBadge(level, label) {
    if (!level || level === 'none') return \`<span class="status-badge status-none">\${label || '—'}</span>\`;
    return \`<span class="status-badge status-\${level}">\${label}</span>\`;
}`,
    `function renderStatusBadge(level, label, options = {}) {
    const text = label || '—';
    if (!level || level === 'none') {
        const base = \`<span class="status-badge status-none">\${escapeHtml(String(text))}</span>\`;
        return options.ccrResult ? wrapWithConditionalColor(base, options.ccrResult, { keepLabel: true, fallbackLabel: text }) : base;
    }
    const base = \`<span class="status-badge status-\${escapeAttr(level)}">\${escapeHtml(String(text))}</span>\`;
    if (options.ccrResult) {
        return wrapWithConditionalColor(base, options.ccrResult, { keepLabel: true, fallbackLabel: text });
    }
    if (options.used != null && options.target != null) {
        const ccr = evaluateUsageVsTargetColors(options.used, options.target, {
            substanceId: options.substanceId,
            section: options.section || 'status'
        });
        if (ccr.matched.length) {
            const preferred = ccr.labels[0] || text;
            const styled = \`<span class="status-badge status-\${escapeAttr(level)}" style="\${escapeAttr(buildConditionalColorInlineStyle(ccr))}">\${escapeHtml(String(preferred))}</span>\`;
            return wrapWithConditionalColor(styled, ccr, { keepLabel: false });
        }
    }
    return base;
}`
);

replaceOnce(
    'renderSheetMetricCard',
    `function renderSheetMetricCard(label, value, badge) {
    const badgeHtml = badge ? renderStatusBadge(badge.level, badge.label) : '';
    return \`<div class="sheet-metric-card"><span class="sheet-metric-label">\${label}</span><strong class="sheet-metric-value">\${value}</strong>\${badgeHtml}</div>\`;
}`,
    `function renderSheetMetricCard(label, value, badge, options = {}) {
    const ccr = options.ccrResult
        || (options.used != null && options.target != null
            ? evaluateUsageVsTargetColors(options.used, options.target, {
                substanceId: options.substanceId,
                section: options.section || 'insights'
            })
            : null);
    const badgeHtml = badge
        ? renderStatusBadge(badge.level, (ccr?.labels?.[0] || badge.label), {
            ccrResult: ccr,
            used: options.used,
            target: options.target,
            substanceId: options.substanceId,
            section: options.section || 'insights'
        })
        : '';
    const style = ccr?.matched?.length ? buildConditionalColorInlineStyle(ccr) : '';
    return \`<div class="sheet-metric-card\${ccr?.matched?.length ? ' ccr-applied' : ''}"\${style ? \` style="\${escapeAttr(style)}"\` : ''}><span class="sheet-metric-label">\${label}</span><strong class="sheet-metric-value">\${value}</strong>\${badgeHtml}</div>\`;
}`
);

replaceOnce(
    'getCalendarDayStatusClass',
    `function getCalendarDayStatusClass(day) {
    const classes = ['stats-cal-day'];
    if (day.inRange === false) {
        classes.push('cal-outside-range');
        classes.push('cal-no-use');
        return classes.join(' ');
    }
    if (day.isToday) classes.push('cal-today');
    if (day.isFuture) classes.push('cal-future');
    if (day.inMonth === false) classes.push('cal-outside-month');
    if (!day.hasUse) {
        classes.push('cal-no-use');
        return classes.join(' ');
    }
    const status = day.taperStatus || 'none';
    if (status === 'over') classes.push('cal-over');
    else if (status === 'close') classes.push('cal-close');
    else if (status === 'under') classes.push('cal-under');
    else classes.push('cal-has-use');
    return classes.join(' ');
}`,
    `function getCalendarDayStatusClass(day) {
    const classes = ['stats-cal-day'];
    if (day.inRange === false) {
        classes.push('cal-outside-range');
        classes.push('cal-no-use');
        return classes.join(' ');
    }
    if (day.isToday) classes.push('cal-today');
    if (day.isFuture) classes.push('cal-future');
    if (day.inMonth === false) classes.push('cal-outside-month');
    if (!day.hasUse) {
        classes.push('cal-no-use');
        return classes.join(' ');
    }
    const status = day.taperStatus || 'none';
    if (status === 'over') classes.push('cal-over');
    else if (status === 'close') classes.push('cal-close');
    else if (status === 'under') classes.push('cal-under');
    else classes.push('cal-has-use');
    if (typeof evaluateTaperColors === 'function') {
        const planned = day.planned ?? day.target ?? null;
        const actual = day.used ?? day.amount ?? null;
        const ccr = evaluateTaperColors(planned, actual, status, {
            substanceId: day.substanceId || currentSubstanceId,
            section: 'calendar'
        });
        if (ccr.matched.length) classes.push('ccr-applied');
    }
    return classes.join(' ');
}`
);

replaceOnce(
    'formatPurchaseStatusBadge',
    `function formatPurchaseStatusBadge(status, label) {
    if (!status || status === 'none') return '—';
    return \`<span class="taper-by-week-status taper-by-week-status-\${status}">\${escapeHtml(label || getRecoveryTaperStatusLabel(status))}</span>\`;
}`,
    `function formatPurchaseStatusBadge(status, label, options = {}) {
    if (!status || status === 'none') return '—';
    const text = label || getRecoveryTaperStatusLabel(status);
    const base = \`<span class="taper-by-week-status taper-by-week-status-\${escapeAttr(status)}">\${escapeHtml(text)}</span>\`;
    if (typeof evaluateTaperColors !== 'function') return base;
    const ccr = evaluateTaperColors(options.planned, options.actual, status, {
        substanceId: options.substanceId,
        section: options.section || 'taper'
    });
    if (!ccr.matched.length) return base;
    const preferred = ccr.labels[0] || text;
    const styled = \`<span class="taper-by-week-status taper-by-week-status-\${escapeAttr(status)} ccr-applied" style="\${escapeAttr(buildConditionalColorInlineStyle(ccr))}">\${escapeHtml(preferred)}</span>\`;
    return wrapWithConditionalColor(styled, ccr, { keepLabel: true, fallbackLabel: preferred });
}`
);

replaceOnce(
    'getPurchaseSupplyStatus',
    `function getPurchaseSupplyStatus(purchase) {
    if (purchaseIsPurchasedAsGift(purchase) || purchase?.inventoryStatus === 'gifted') {
        return { key: 'gifted', label: '🎁 Gifted', className: 'supply-gifted' };
    }
    if (isVapePuffPurchase(purchase)) {
        const starting = getVapeStartingPuffsLeft(purchase);
        const remaining = getPurchaseRemainingAmount(purchase);
        if (purchase.isDepleted || remaining <= 0) {
            return { key: 'depleted', label: '❌ Depleted', className: 'supply-depleted' };
        }
        if (starting > 0 && remaining / starting <= SUPPLY_LOW_REMAINING_PCT) {
            return { key: 'low', label: '⚠️ Low supply', className: 'supply-low' };
        }
        return { key: 'ok', label: '✅ In supply', className: 'supply-ok' };
    }
    const bought = getPurchaseQuantityBought(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    if (purchase.isDepleted || remaining <= 0) {
        return { key: 'depleted', label: '❌ Depleted', className: 'supply-depleted' };
    }
    if (bought > 0 && remaining / bought <= SUPPLY_LOW_REMAINING_PCT) {
        return { key: 'low', label: '⚠️ Low supply', className: 'supply-low' };
    }
    return { key: 'ok', label: '✅ In supply', className: 'supply-ok' };
}`,
    `function getPurchaseSupplyStatus(purchase) {
    let result;
    if (purchaseIsPurchasedAsGift(purchase) || purchase?.inventoryStatus === 'gifted') {
        result = { key: 'gifted', label: '🎁 Gifted', className: 'supply-gifted' };
    } else if (isVapePuffPurchase(purchase)) {
        const starting = getVapeStartingPuffsLeft(purchase);
        const remaining = getPurchaseRemainingAmount(purchase);
        if (purchase.isDepleted || remaining <= 0) {
            result = { key: 'depleted', label: '❌ Depleted', className: 'supply-depleted' };
        } else if (starting > 0 && remaining / starting <= SUPPLY_LOW_REMAINING_PCT) {
            result = { key: 'low', label: '⚠️ Low supply', className: 'supply-low' };
        } else {
            result = { key: 'ok', label: '✅ In supply', className: 'supply-ok' };
        }
    } else {
        const bought = getPurchaseQuantityBought(purchase);
        const remaining = getPurchaseRemainingAmount(purchase);
        if (purchase.isDepleted || remaining <= 0) {
            result = { key: 'depleted', label: '❌ Depleted', className: 'supply-depleted' };
        } else if (bought > 0 && remaining / bought <= SUPPLY_LOW_REMAINING_PCT) {
            result = { key: 'low', label: '⚠️ Low supply', className: 'supply-low' };
        } else {
            result = { key: 'ok', label: '✅ In supply', className: 'supply-ok' };
        }
    }
    if (typeof evaluateInventoryColors === 'function' && typeof getPurchasePercentRemaining === 'function') {
        const pct = getPurchasePercentRemaining(purchase);
        const ccr = evaluateInventoryColors(pct, {
            substanceId: getPurchaseSubstanceId(purchase),
            section: 'inventory'
        });
        if (ccr.matched.length) {
            result.ccrResult = ccr;
            result.className = \`\${result.className} ccr-applied\`.trim();
            if (ccr.labels[0]) result.label = ccr.labels[0];
            result.style = buildConditionalColorInlineStyle(ccr);
        }
    }
    return result;
}`
);

// Test exports — add near appearance exports
replaceOnce(
    'test exports',
    '        resetAppearanceSettings,\n        updateAppearanceZoomLayoutMetrics,',
    `        resetAppearanceSettings,
        ensureConditionalColorRules,
        getConditionalColorRulesState,
        getConditionalColorRules,
        getConditionalColorPresetRules,
        normalizeConditionalColorRule,
        compareConditionalColorRule,
        evaluateConditionalColorRules,
        evaluateUsageVsTargetColors,
        evaluateInventoryColors,
        evaluateTaperColors,
        evaluateSpendColors,
        saveConditionalColorRule,
        deleteConditionalColorRule,
        duplicateConditionalColorRule,
        setConditionalColorRuleEnabled,
        reorderConditionalColorRule,
        resetConditionalColorRulesToPresets,
        exportConditionalColorRulesJson,
        importConditionalColorRulesJson,
        setConditionalColorRulesEnabled,
        getContrastRatio,
        getContrastWarning,
        normalizeHexColor,
        CCR_OPERATORS,
        CCR_METRICS,
        CCR_SECTIONS,
        updateAppearanceZoomLayoutMetrics,`
);

writeFileSync(appPath, app);
console.log('Wrote', appPath);
