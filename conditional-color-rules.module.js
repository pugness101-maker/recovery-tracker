// ——— Conditional Color Rules ———
// Shared rule-evaluation engine for Recovery Tracker. Presentation only —
// rules never mutate logs, purchases, plans, or other stored amounts.
// No imports/exports — spliced into app.js.

function ccrStorageKey() {
    return 'conditionalColorRules';
}

const CCR_STORAGE_KEY = 'conditionalColorRules';

const CCR_OPERATORS = Object.freeze([
    { id: 'eq', label: 'Equals' },
    { id: 'neq', label: 'Not equals' },
    { id: 'gt', label: 'Greater than' },
    { id: 'gte', label: 'Greater than or equal' },
    { id: 'lt', label: 'Less than' },
    { id: 'lte', label: 'Less than or equal' },
    { id: 'between', label: 'Between' },
    { id: 'contains', label: 'Contains' },
    { id: 'empty', label: 'Empty' },
    { id: 'notEmpty', label: 'Not empty' },
    { id: 'true', label: 'True' },
    { id: 'false', label: 'False' },
    { id: 'pctAboveTarget', label: 'Percentage above target' },
    { id: 'pctBelowTarget', label: 'Percentage below target' },
    { id: 'daysSince', label: 'Days since value' }
]);

const CCR_METRICS = Object.freeze([
    { id: 'useAmount', label: 'Use amount', valueType: 'number' },
    { id: 'useVsTarget', label: 'Use vs target ratio', valueType: 'ratio' },
    { id: 'puffs', label: 'Puffs', valueType: 'number' },
    { id: 'percentLeft', label: 'Percent left', valueType: 'number' },
    { id: 'tabs', label: 'Tabs', valueType: 'number' },
    { id: 'ug', label: 'µg', valueType: 'number' },
    { id: 'pills', label: 'Pills', valueType: 'number' },
    { id: 'mg', label: 'mg', valueType: 'number' },
    { id: 'drinks', label: 'Drinks', valueType: 'number' },
    { id: 'inventoryRemaining', label: 'Inventory remaining', valueType: 'number' },
    { id: 'inventoryPercent', label: 'Inventory % remaining', valueType: 'number' },
    { id: 'daysSinceUse', label: 'Days since use', valueType: 'number' },
    { id: 'daysSincePurchase', label: 'Days since purchase', valueType: 'number' },
    { id: 'spend', label: 'Spending', valueType: 'number' },
    { id: 'purchaseCount', label: 'Purchase count', valueType: 'number' },
    { id: 'taperPlannedVsActual', label: 'Taper planned vs actual ratio', valueType: 'ratio' },
    { id: 'taperStatus', label: 'Taper status', valueType: 'string' },
    { id: 'costPerUnit', label: 'Cost per unit', valueType: 'number' },
    { id: 'transactionType', label: 'Transaction type', valueType: 'string' },
    { id: 'productType', label: 'Product type', valueType: 'string' },
    { id: 'store', label: 'Store', valueType: 'string' },
    { id: 'paymentMethod', label: 'Payment method', valueType: 'string' },
    { id: 'statusLabel', label: 'Status label', valueType: 'string' },
    { id: 'booleanFlag', label: 'Boolean flag', valueType: 'boolean' }
]);

const CCR_SECTIONS = Object.freeze([
    { id: 'dashboard', label: 'Dashboard cards' },
    { id: 'status', label: 'Status badges' },
    { id: 'useHistory', label: 'Use History' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'purchaseHistory', label: 'Purchase History' },
    { id: 'insights', label: 'Insights tables' },
    { id: 'spending', label: 'Spending summaries' },
    { id: 'taper', label: 'Taper tables' },
    { id: 'calendar', label: 'Calendar entries' },
    { id: 'all', label: 'All sections' }
]);

const CCR_PRESET_COLORS = Object.freeze({
    onTrack: { background: 'rgba(76, 175, 80, 0.22)', text: '#1b5e20', border: '#4caf50' },
    nearLimit: { background: 'rgba(255, 193, 7, 0.22)', text: '#e65100', border: '#ffb300' },
    overLimit: { background: 'rgba(244, 67, 54, 0.22)', text: '#b71c1c', border: '#f44336' },
    lowInventory: { background: 'rgba(255, 152, 0, 0.22)', text: '#e65100', border: '#ff9800' },
    depleted: { background: 'rgba(158, 158, 158, 0.28)', text: '#424242', border: '#9e9e9e' },
    highSpending: { background: 'rgba(244, 67, 54, 0.22)', text: '#b71c1c', border: '#ef5350' },
    belowTaper: { background: 'rgba(76, 175, 80, 0.22)', text: '#1b5e20', border: '#66bb6a' },
    taperExceeded: { background: 'rgba(244, 67, 54, 0.22)', text: '#b71c1c', border: '#e57373' }
});

const CCR_LIGHT_TEXT_OVERRIDES = Object.freeze({
    onTrack: { text: '#1b5e20' },
    nearLimit: { text: '#e65100' },
    overLimit: { text: '#b71c1c' },
    lowInventory: { text: '#e65100' },
    depleted: { text: '#424242' },
    highSpending: { text: '#b71c1c' },
    belowTaper: { text: '#1b5e20' },
    taperExceeded: { text: '#b71c1c' }
});

const CCR_DARK_TEXT_OVERRIDES = Object.freeze({
    onTrack: { text: '#81c784' },
    nearLimit: { text: '#ffd54f' },
    overLimit: { text: '#e57373' },
    lowInventory: { text: '#ffb74d' },
    depleted: { text: '#bdbdbd' },
    highSpending: { text: '#ef9a9a' },
    belowTaper: { text: '#a5d6a7' },
    taperExceeded: { text: '#ef9a9a' }
});

function ccrNewId(prefix = 'ccr') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getConditionalColorPresetRules(theme = 'dark') {
    const textMap = theme === 'light' ? CCR_LIGHT_TEXT_OVERRIDES : CCR_DARK_TEXT_OVERRIDES;
    const color = (key) => ({
        ...CCR_PRESET_COLORS[key],
        ...(textMap[key] || {})
    });
    return [
        {
            id: 'preset-on-track',
            name: 'On Track',
            enabled: true,
            isPreset: true,
            presetId: 'onTrack',
            substanceScope: 'all',
            sectionScope: ['status', 'insights', 'dashboard', 'taper'],
            metric: 'useVsTarget',
            operator: 'lt',
            value: 0.7,
            colors: color('onTrack'),
            priority: 100,
            stopProcessing: false,
            statusLabel: 'On track'
        },
        {
            id: 'preset-near-limit',
            name: 'Near Limit',
            enabled: true,
            isPreset: true,
            presetId: 'nearLimit',
            substanceScope: 'all',
            sectionScope: ['status', 'insights', 'dashboard', 'taper'],
            metric: 'useVsTarget',
            operator: 'between',
            value: 0.7,
            valueTo: 1,
            colors: color('nearLimit'),
            priority: 110,
            stopProcessing: false,
            statusLabel: 'Near limit'
        },
        {
            id: 'preset-over-limit',
            name: 'Over Limit',
            enabled: true,
            isPreset: true,
            presetId: 'overLimit',
            substanceScope: 'all',
            sectionScope: ['status', 'insights', 'dashboard', 'taper'],
            metric: 'useVsTarget',
            operator: 'gt',
            value: 1,
            colors: color('overLimit'),
            priority: 120,
            stopProcessing: false,
            statusLabel: 'Over limit'
        },
        {
            id: 'preset-low-inventory',
            name: 'Low Inventory',
            enabled: true,
            isPreset: true,
            presetId: 'lowInventory',
            substanceScope: 'all',
            sectionScope: ['inventory', 'purchaseHistory', 'dashboard'],
            metric: 'inventoryPercent',
            operator: 'lt',
            value: 25,
            colors: color('lowInventory'),
            priority: 90,
            stopProcessing: false,
            statusLabel: 'Low inventory'
        },
        {
            id: 'preset-depleted',
            name: 'Depleted',
            enabled: true,
            isPreset: true,
            presetId: 'depleted',
            substanceScope: 'all',
            sectionScope: ['inventory', 'purchaseHistory', 'dashboard'],
            metric: 'inventoryPercent',
            operator: 'lte',
            value: 0,
            colors: color('depleted'),
            priority: 130,
            stopProcessing: false,
            statusLabel: 'Depleted'
        },
        {
            id: 'preset-high-spending',
            name: 'High Spending',
            enabled: true,
            isPreset: true,
            presetId: 'highSpending',
            substanceScope: 'all',
            sectionScope: ['spending', 'insights', 'dashboard', 'purchaseHistory'],
            metric: 'spend',
            operator: 'gt',
            value: 100,
            colors: color('highSpending'),
            priority: 80,
            stopProcessing: false,
            statusLabel: 'High spending'
        },
        {
            id: 'preset-below-taper',
            name: 'Below Taper Plan',
            enabled: true,
            isPreset: true,
            presetId: 'belowTaper',
            substanceScope: 'all',
            sectionScope: ['taper', 'calendar', 'status'],
            metric: 'taperPlannedVsActual',
            operator: 'lt',
            value: 1,
            colors: color('belowTaper'),
            priority: 95,
            stopProcessing: false,
            statusLabel: 'Below plan'
        },
        {
            id: 'preset-taper-exceeded',
            name: 'Taper Exceeded',
            enabled: true,
            isPreset: true,
            presetId: 'taperExceeded',
            substanceScope: 'all',
            sectionScope: ['taper', 'calendar', 'status'],
            metric: 'taperPlannedVsActual',
            operator: 'gt',
            value: 1,
            colors: color('taperExceeded'),
            priority: 125,
            stopProcessing: false,
            statusLabel: 'Over plan'
        }
    ];
}

function getDefaultConditionalColorRulesState(theme = 'dark') {
    return {
        enabled: true,
        version: 1,
        rules: getConditionalColorPresetRules(theme)
    };
}

function normalizeHexColor(input, fallback = '#000000') {
    if (input == null) return fallback;
    let s = String(input).trim();
    if (!s) return fallback;
    if (s.startsWith('rgba') || s.startsWith('rgb') || s.startsWith('hsl')) return s;
    if (s[0] !== '#') s = `#${s}`;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{8}$/.test(s)) return s.toLowerCase();
    return fallback;
}

function parseCssColorToRgb(color) {
    if (!color || typeof color !== 'string') return null;
    const c = color.trim();
    const hex = c.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
    if (hex) {
        return {
            r: parseInt(hex[1].slice(0, 2), 16),
            g: parseInt(hex[1].slice(2, 4), 16),
            b: parseInt(hex[1].slice(4, 6), 16)
        };
    }
    const short = c.match(/^#([0-9a-fA-F]{3})$/);
    if (short) {
        const h = short[1];
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16)
        };
    }
    const rgb = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) {
        return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
    }
    return null;
}

function relativeLuminance(rgb) {
    if (!rgb) return null;
    const channel = (v) => {
        const s = Math.max(0, Math.min(255, Number(v))) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const r = channel(rgb.r);
    const g = channel(rgb.g);
    const b = channel(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(fg, bg) {
    const a = relativeLuminance(parseCssColorToRgb(fg));
    const b = relativeLuminance(parseCssColorToRgb(bg));
    if (a == null || b == null) return null;
    const lighter = Math.max(a, b);
    const darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
}

function getContrastWarning(fg, bg) {
    const ratio = getContrastRatio(fg, bg);
    if (ratio == null) return { ok: true, ratio: null, message: '' };
    if (ratio >= 4.5) return { ok: true, ratio, message: `Contrast ${ratio.toFixed(2)}:1 — good` };
    if (ratio >= 3) return { ok: false, ratio, message: `Contrast ${ratio.toFixed(2)}:1 — low for small text` };
    return { ok: false, ratio, message: `Contrast ${ratio.toFixed(2)}:1 — poor; adjust colors` };
}

function normalizeConditionalColorRule(raw, index = 0) {
    if (!raw || typeof raw !== 'object') return null;
    const metricIds = new Set(CCR_METRICS.map(m => m.id));
    const opIds = new Set(CCR_OPERATORS.map(o => o.id));
    const metric = metricIds.has(raw.metric) ? raw.metric : 'useAmount';
    const operator = opIds.has(raw.operator) ? raw.operator : 'gt';
    let sectionScope = raw.sectionScope;
    if (sectionScope === 'all' || sectionScope == null) sectionScope = ['all'];
    if (!Array.isArray(sectionScope)) sectionScope = [String(sectionScope)];
    sectionScope = sectionScope.map(String).filter(Boolean);
    if (!sectionScope.length) sectionScope = ['all'];

    let substanceScope = raw.substanceScope;
    if (substanceScope == null || substanceScope === '' || substanceScope === 'all') {
        substanceScope = 'all';
    } else if (Array.isArray(substanceScope)) {
        substanceScope = substanceScope.map(String).filter(Boolean);
        if (!substanceScope.length) substanceScope = 'all';
    } else {
        substanceScope = String(substanceScope);
    }

    const colors = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};
    return {
        id: String(raw.id || ccrNewId()),
        name: String(raw.name || `Rule ${index + 1}`).slice(0, 80),
        enabled: raw.enabled !== false,
        isPreset: !!raw.isPreset,
        presetId: raw.presetId ? String(raw.presetId) : null,
        substanceScope,
        sectionScope,
        metric,
        operator,
        value: raw.value === undefined ? null : raw.value,
        valueTo: raw.valueTo === undefined ? null : raw.valueTo,
        targetValue: raw.targetValue === undefined ? null : raw.targetValue,
        colors: {
            background: String(colors.background || 'rgba(76, 175, 80, 0.22)'),
            text: normalizeHexColor(colors.text, '#81c784'),
            border: normalizeHexColor(colors.border, '#4caf50')
        },
        priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : (100 - index),
        stopProcessing: !!raw.stopProcessing,
        statusLabel: raw.statusLabel != null ? String(raw.statusLabel).slice(0, 40) : ''
    };
}

function ensureConditionalColorRules(data = appData, options = {}) {
    if (!data.settings) data.settings = {};
    const theme = options.theme
        || (typeof resolvedTheme !== 'undefined' ? resolvedTheme : 'dark')
        || 'dark';
    const existing = data.settings[ccrStorageKey()];
    if (!existing || typeof existing !== 'object') {
        data.settings[ccrStorageKey()] = getDefaultConditionalColorRulesState(theme);
        return data.settings[ccrStorageKey()];
    }
    const state = data.settings[ccrStorageKey()];
    state.enabled = state.enabled !== false;
    state.version = Number(state.version) || 1;
    if (!Array.isArray(state.rules) || !state.rules.length) {
        state.rules = getConditionalColorPresetRules(theme);
    } else {
        state.rules = state.rules
            .map((r, i) => normalizeConditionalColorRule(r, i))
            .filter(Boolean);
    }
    return state;
}

function getConditionalColorRulesState(data = appData) {
    return ensureConditionalColorRules(data);
}

function getConditionalColorRules(data = appData) {
    return getConditionalColorRulesState(data).rules.slice();
}

function persistConditionalColorRulesState(patch = {}, data = appData) {
    const state = ensureConditionalColorRules(data);
    if (patch.enabled != null) state.enabled = !!patch.enabled;
    if (Array.isArray(patch.rules)) {
        state.rules = patch.rules.map((r, i) => normalizeConditionalColorRule(r, i)).filter(Boolean);
    }
    data.settings[ccrStorageKey()] = state;
    if (typeof saveData === 'function') saveData(data);
    return state;
}

function ccrCoerceNumber(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const n = parseFloat(String(value).replace(/[^0-9eE.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
}

function ccrIsEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function compareConditionalColorRule(rule, context = {}) {
    if (!rule || !rule.enabled) return false;
    const operator = rule.operator;
    const rawValue = context.value;
    const textValue = context.textValue != null ? String(context.textValue) : (rawValue == null ? '' : String(rawValue));
    const numValue = ccrCoerceNumber(rawValue);
    const compare = ccrCoerceNumber(rule.value);
    const compareTo = ccrCoerceNumber(rule.valueTo);
    const target = ccrCoerceNumber(context.target != null ? context.target : rule.targetValue);

    try {
        switch (operator) {
            case 'empty':
                return ccrIsEmpty(rawValue) && ccrIsEmpty(textValue);
            case 'notEmpty':
                return !ccrIsEmpty(rawValue) || !ccrIsEmpty(textValue);
            case 'true':
                return rawValue === true || rawValue === 1 || String(rawValue).toLowerCase() === 'true';
            case 'false':
                return rawValue === false || rawValue === 0 || String(rawValue).toLowerCase() === 'false';
            case 'contains':
                return textValue.toLowerCase().includes(String(rule.value ?? '').toLowerCase());
            case 'eq':
                if (numValue != null && compare != null) return Math.abs(numValue - compare) < 1e-9;
                return String(rawValue ?? '').toLowerCase() === String(rule.value ?? '').toLowerCase();
            case 'neq':
                if (numValue != null && compare != null) return Math.abs(numValue - compare) >= 1e-9;
                return String(rawValue ?? '').toLowerCase() !== String(rule.value ?? '').toLowerCase();
            case 'gt':
                return numValue != null && compare != null && numValue > compare;
            case 'gte':
                return numValue != null && compare != null && numValue >= compare;
            case 'lt':
                return numValue != null && compare != null && numValue < compare;
            case 'lte':
                return numValue != null && compare != null && numValue <= compare;
            case 'between': {
                if (numValue == null || compare == null || compareTo == null) return false;
                const lo = Math.min(compare, compareTo);
                const hi = Math.max(compare, compareTo);
                return numValue >= lo && numValue <= hi;
            }
            case 'pctAboveTarget': {
                if (numValue == null || target == null || target === 0 || compare == null) return false;
                const pctAbove = ((numValue - target) / Math.abs(target)) * 100;
                return pctAbove >= compare;
            }
            case 'pctBelowTarget': {
                if (numValue == null || target == null || target === 0 || compare == null) return false;
                const pctBelow = ((target - numValue) / Math.abs(target)) * 100;
                return pctBelow >= compare;
            }
            case 'daysSince': {
                // context.value should already be days since; rule.value is the threshold
                if (numValue == null || compare == null) return false;
                return numValue >= compare;
            }
            default:
                return false;
        }
    } catch (_) {
        return false;
    }
}

function ruleMatchesSubstanceScope(rule, substanceId) {
    const scope = rule.substanceScope;
    if (scope == null || scope === 'all') return true;
    if (!substanceId || substanceId === 'all' || substanceId === DASHBOARD_ALL) return true;
    if (Array.isArray(scope)) {
        return scope.some(id => String(id) === String(substanceId));
    }
    return String(scope) === String(substanceId);
}

function ruleMatchesSectionScope(rule, section) {
    const scope = rule.sectionScope || ['all'];
    if (!scope.length || scope.includes('all')) return true;
    if (!section) return true;
    return scope.includes(section);
}

function ruleMatchesMetric(rule, metric) {
    if (!metric) return true;
    return rule.metric === metric;
}

/**
 * Shared evaluation engine.
 * context: { substanceId, section, metric, value, textValue, target, dateValue }
 * Returns presentation styles only — never mutates underlying data.
 */
function evaluateConditionalColorRules(context = {}, data = appData) {
    const state = ensureConditionalColorRules(data);
    const empty = {
        matched: [],
        style: null,
        className: '',
        labels: [],
        cssText: '',
        attrs: ''
    };
    if (!state.enabled) return empty;

    const rules = (state.rules || [])
        .filter(r => r && r.enabled)
        .slice()
        .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));

    const matched = [];
    let style = null;

    for (const rule of rules) {
        if (!ruleMatchesSubstanceScope(rule, context.substanceId)) continue;
        if (!ruleMatchesSectionScope(rule, context.section)) continue;
        if (!ruleMatchesMetric(rule, context.metric)) continue;
        if (context.value === undefined && !['empty', 'notEmpty', 'true', 'false'].includes(rule.operator)) {
            // Missing metric values are ignored unless emptiness operators are used.
            continue;
        }
        if (!compareConditionalColorRule(rule, context)) continue;

        matched.push(rule);
        if (!style) {
            style = {
                background: rule.colors.background,
                text: rule.colors.text,
                border: rule.colors.border
            };
        } else {
            // Higher priority already applied; lower-priority rules may fill missing slots only.
            style.background = style.background || rule.colors.background;
            style.text = style.text || rule.colors.text;
            style.border = style.border || rule.colors.border;
        }
        if (rule.stopProcessing) break;
    }

    if (!matched.length) return empty;

    const labels = matched
        .map(r => r.statusLabel || r.name)
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

    const cssText = style
        ? [
            style.background ? `background:${style.background}` : '',
            style.text ? `color:${style.text}` : '',
            style.border ? `border-color:${style.border}` : ''
        ].filter(Boolean).join(';')
        : '';

    const attrs = cssText
        ? ` class="ccr-applied" style="${escapeAttr(cssText)}" data-ccr-labels="${escapeAttr(labels.join(', '))}"`
        : ' class="ccr-applied"';

    return {
        matched,
        style,
        className: 'ccr-applied',
        labels,
        cssText,
        attrs
    };
}

function buildConditionalColorInlineStyle(result) {
    if (!result?.style) return '';
    const s = result.style;
    return [
        s.background ? `background:${s.background}` : '',
        s.text ? `color:${s.text}` : '',
        s.border ? `border:1px solid ${s.border}` : ''
    ].filter(Boolean).join(';');
}

function renderConditionalColorLabels(result, { fallbackLabel = '' } = {}) {
    const labels = (result?.labels && result.labels.length)
        ? result.labels
        : (fallbackLabel ? [fallbackLabel] : []);
    if (!labels.length) return '';
    return labels.map(label => {
        const style = buildConditionalColorInlineStyle(result);
        return `<span class="ccr-status-label status-badge"${style ? ` style="${escapeAttr(style)}"` : ''}>${escapeHtml(label)}</span>`;
    }).join(' ');
}

function wrapWithConditionalColor(innerHtml, result, { keepLabel = true, fallbackLabel = '' } = {}) {
    if (!result?.matched?.length) return innerHtml;
    const style = buildConditionalColorInlineStyle(result);
    const labelsHtml = keepLabel ? renderConditionalColorLabels(result, { fallbackLabel }) : '';
    return `<span class="ccr-wrap"${style ? ` style="${escapeAttr(style)}"` : ''}>${innerHtml}${labelsHtml ? ` ${labelsHtml}` : ''}</span>`;
}

function applyConditionalColorToElement(el, result) {
    if (!el || !result?.matched?.length || !result.style) return;
    if (result.style.background) el.style.background = result.style.background;
    if (result.style.text) el.style.color = result.style.text;
    if (result.style.border) el.style.borderColor = result.style.border;
    el.classList.add('ccr-applied');
    if (result.labels?.length) el.setAttribute('data-ccr-labels', result.labels.join(', '));
}

function evaluateUsageVsTargetColors(used, target, options = {}, data = appData) {
    if (target == null || !(target > 0) || used == null) {
        return evaluateConditionalColorRules({
            ...options,
            metric: options.metric || 'useVsTarget',
            value: undefined
        }, data);
    }
    const ratio = used / target;
    return evaluateConditionalColorRules({
        substanceId: options.substanceId,
        section: options.section || 'status',
        metric: options.metric || 'useVsTarget',
        value: ratio,
        target
    }, data);
}

function evaluateInventoryColors(percentRemaining, options = {}, data = appData) {
    if (percentRemaining == null || Number.isNaN(Number(percentRemaining))) {
        return evaluateConditionalColorRules({
            ...options,
            metric: 'inventoryPercent',
            value: undefined
        }, data);
    }
    return evaluateConditionalColorRules({
        substanceId: options.substanceId,
        section: options.section || 'inventory',
        metric: 'inventoryPercent',
        value: Number(percentRemaining)
    }, data);
}

function evaluateTaperColors(planned, actual, status, options = {}, data = appData) {
    const results = [];
    if (planned != null && planned > 0 && actual != null) {
        results.push(evaluateConditionalColorRules({
            substanceId: options.substanceId,
            section: options.section || 'taper',
            metric: 'taperPlannedVsActual',
            value: actual / planned,
            target: planned
        }, data));
    }
    if (status != null && status !== '') {
        results.push(evaluateConditionalColorRules({
            substanceId: options.substanceId,
            section: options.section || 'taper',
            metric: 'taperStatus',
            value: status,
            textValue: status
        }, data));
    }
    const matched = results.flatMap(r => r.matched || []);
    if (!matched.length) {
        return {
            matched: [],
            style: null,
            className: '',
            labels: [],
            cssText: '',
            attrs: ''
        };
    }
    const style = results.find(r => r.style)?.style || null;
    const labels = matched.map(r => r.statusLabel || r.name).filter((v, i, a) => v && a.indexOf(v) === i);
    const cssText = style
        ? [
            style.background ? `background:${style.background}` : '',
            style.text ? `color:${style.text}` : '',
            style.border ? `border-color:${style.border}` : ''
        ].filter(Boolean).join(';')
        : '';
    return { matched, style, className: 'ccr-applied', labels, cssText, attrs: '' };
}

function evaluateSpendColors(amount, options = {}, data = appData) {
    return evaluateConditionalColorRules({
        substanceId: options.substanceId,
        section: options.section || 'spending',
        metric: 'spend',
        value: amount
    }, data);
}

function saveConditionalColorRule(rule, data = appData) {
    const state = ensureConditionalColorRules(data);
    const normalized = normalizeConditionalColorRule(rule, state.rules.length);
    if (!normalized) return null;
    const idx = state.rules.findIndex(r => r.id === normalized.id);
    if (idx >= 0) state.rules[idx] = normalized;
    else state.rules.push(normalized);
    persistConditionalColorRulesState({ rules: state.rules }, data);
    return normalized;
}

function deleteConditionalColorRule(ruleId, data = appData) {
    const state = ensureConditionalColorRules(data);
    state.rules = state.rules.filter(r => r.id !== ruleId);
    persistConditionalColorRulesState({ rules: state.rules }, data);
    return state.rules;
}

function duplicateConditionalColorRule(ruleId, data = appData) {
    const state = ensureConditionalColorRules(data);
    const src = state.rules.find(r => r.id === ruleId);
    if (!src) return null;
    const copy = normalizeConditionalColorRule({
        ...src,
        id: ccrNewId(),
        name: `${src.name} (copy)`,
        isPreset: false,
        presetId: null,
        priority: (Number(src.priority) || 0) + 1
    });
    state.rules.push(copy);
    persistConditionalColorRulesState({ rules: state.rules }, data);
    return copy;
}

function setConditionalColorRuleEnabled(ruleId, enabled, data = appData) {
    const state = ensureConditionalColorRules(data);
    const rule = state.rules.find(r => r.id === ruleId);
    if (!rule) return null;
    rule.enabled = !!enabled;
    persistConditionalColorRulesState({ rules: state.rules }, data);
    return rule;
}

function reorderConditionalColorRule(ruleId, direction, data = appData) {
    const state = ensureConditionalColorRules(data);
    const sorted = state.rules.slice().sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
    const idx = sorted.findIndex(r => r.id === ruleId);
    if (idx < 0) return state.rules;
    const swapWith = direction < 0 ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return state.rules;
    const a = sorted[idx];
    const b = sorted[swapWith];
    const tmp = a.priority;
    a.priority = b.priority;
    b.priority = tmp;
    // If priorities were equal, nudge
    if (a.priority === b.priority) {
        a.priority = (Number(a.priority) || 0) + (direction < 0 ? 1 : -1);
    }
    persistConditionalColorRulesState({ rules: sorted }, data);
    return sorted;
}

function resetConditionalColorRulesToPresets(data = appData) {
    const theme = (typeof resolvedTheme !== 'undefined' ? resolvedTheme : 'dark') || 'dark';
    const state = getDefaultConditionalColorRulesState(theme);
    data.settings[ccrStorageKey()] = state;
    if (typeof saveData === 'function') saveData(data);
    return state;
}

function exportConditionalColorRulesJson(data = appData) {
    const state = ensureConditionalColorRules(data);
    return JSON.stringify({
        app: 'recovery-tracker-conditional-color-rules',
        version: state.version || 1,
        exportedAt: new Date().toISOString(),
        enabled: state.enabled,
        rules: state.rules
    }, null, 2);
}

function importConditionalColorRulesJson(jsonText, data = appData, { replace = false } = {}) {
    let parsed;
    try {
        parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    } catch (_) {
        throw new Error('Invalid JSON for conditional color rules.');
    }
    const incoming = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.rules) ? parsed.rules : null);
    if (!incoming) throw new Error('No rules array found in import file.');
    const normalized = incoming.map((r, i) => normalizeConditionalColorRule(r, i)).filter(Boolean);
    if (!normalized.length) throw new Error('No valid rules in import file.');
    const state = ensureConditionalColorRules(data);
    if (replace) {
        state.rules = normalized;
    } else {
        const existingIds = new Set(state.rules.map(r => r.id));
        normalized.forEach(rule => {
            if (existingIds.has(rule.id)) rule.id = ccrNewId();
            state.rules.push(rule);
        });
    }
    if (parsed && typeof parsed === 'object' && parsed.enabled != null) {
        state.enabled = !!parsed.enabled;
    }
    persistConditionalColorRulesState({ rules: state.rules, enabled: state.enabled }, data);
    return state;
}

function setConditionalColorRulesEnabled(enabled, data = appData) {
    return persistConditionalColorRulesState({ enabled: !!enabled }, data);
}

// ——— Conditional Color Rules UI ———

let ccrEditingRuleId = null;

function getCcrEditorDraftFromForm() {
    const get = (id) => document.getElementById(id);
    const sections = [...(get('ccr-rule-sections')?.selectedOptions || [])].map(o => o.value);
    const substance = get('ccr-rule-substance')?.value || 'all';
    return normalizeConditionalColorRule({
        id: ccrEditingRuleId || ccrNewId(),
        name: get('ccr-rule-name')?.value || 'Untitled rule',
        enabled: get('ccr-rule-enabled')?.checked !== false,
        substanceScope: substance,
        sectionScope: sections.length ? sections : ['all'],
        metric: get('ccr-rule-metric')?.value || 'useAmount',
        operator: get('ccr-rule-operator')?.value || 'gt',
        value: get('ccr-rule-value')?.value ?? '',
        valueTo: get('ccr-rule-value-to')?.value ?? '',
        targetValue: get('ccr-rule-target')?.value ?? '',
        priority: parseFloat(get('ccr-rule-priority')?.value) || 100,
        stopProcessing: !!get('ccr-rule-stop')?.checked,
        statusLabel: get('ccr-rule-status-label')?.value || '',
        colors: {
            background: get('ccr-rule-bg')?.value || 'rgba(76, 175, 80, 0.22)',
            text: get('ccr-rule-text')?.value || '#81c784',
            border: get('ccr-rule-border')?.value || '#4caf50'
        }
    });
}

function fillCcrEditorForm(rule) {
    const r = normalizeConditionalColorRule(rule || {
        name: 'New rule',
        metric: 'useAmount',
        operator: 'gt',
        value: 0,
        priority: 100,
        colors: { background: 'rgba(76, 175, 80, 0.22)', text: '#81c784', border: '#4caf50' },
        statusLabel: ''
    });
    ccrEditingRuleId = r.id;
    const set = (id, value, prop = 'value') => {
        const el = document.getElementById(id);
        if (!el) return;
        if (prop === 'checked') el.checked = !!value;
        else el[prop] = value ?? '';
    };
    set('ccr-rule-name', r.name);
    set('ccr-rule-enabled', r.enabled, 'checked');
    set('ccr-rule-substance', Array.isArray(r.substanceScope) ? (r.substanceScope[0] || 'all') : r.substanceScope);
    set('ccr-rule-metric', r.metric);
    set('ccr-rule-operator', r.operator);
    set('ccr-rule-value', r.value);
    set('ccr-rule-value-to', r.valueTo);
    set('ccr-rule-target', r.targetValue);
    set('ccr-rule-priority', r.priority);
    set('ccr-rule-stop', r.stopProcessing, 'checked');
    set('ccr-rule-status-label', r.statusLabel);
    set('ccr-rule-bg', r.colors.background);
    set('ccr-rule-bg-hex', r.colors.background.startsWith('#') ? r.colors.background : '#4caf50');
    set('ccr-rule-text', r.colors.text);
    set('ccr-rule-text-hex', r.colors.text.startsWith('#') ? r.colors.text : '#81c784');
    set('ccr-rule-text-picker', r.colors.text.startsWith('#') ? r.colors.text : '#81c784');
    set('ccr-rule-border', r.colors.border);
    set('ccr-rule-border-hex', r.colors.border.startsWith('#') ? r.colors.border : '#4caf50');
    set('ccr-rule-border-picker', r.colors.border.startsWith('#') ? r.colors.border : '#4caf50');

    const sectionsEl = document.getElementById('ccr-rule-sections');
    if (sectionsEl) {
        const selected = new Set(r.sectionScope || ['all']);
        [...sectionsEl.options].forEach(opt => {
            opt.selected = selected.has(opt.value);
        });
    }
    updateCcrOperatorFieldsVisibility();
    updateCcrLivePreview();
}

function updateCcrOperatorFieldsVisibility() {
    const op = document.getElementById('ccr-rule-operator')?.value;
    const valueRow = document.getElementById('ccr-value-row');
    const valueToRow = document.getElementById('ccr-value-to-row');
    const targetRow = document.getElementById('ccr-target-row');
    const needsValue = !['empty', 'notEmpty', 'true', 'false'].includes(op);
    const needsTo = op === 'between';
    const needsTarget = op === 'pctAboveTarget' || op === 'pctBelowTarget';
    valueRow?.classList.toggle('hidden', !needsValue);
    valueToRow?.classList.toggle('hidden', !needsTo);
    targetRow?.classList.toggle('hidden', !needsTarget);
}

function updateCcrLivePreview() {
    const draft = getCcrEditorDraftFromForm();
    const preview = document.getElementById('ccr-live-preview');
    const warn = document.getElementById('ccr-contrast-warning');
    if (preview) {
        const style = buildConditionalColorInlineStyle({ style: draft.colors, matched: [draft] });
        const label = draft.statusLabel || draft.name || 'Preview';
        preview.innerHTML = `<span class="ccr-preview-swatch"${style ? ` style="${escapeAttr(style)}"` : ''}>${escapeHtml(label)}</span>
            <span class="ccr-preview-sample"${style ? ` style="${escapeAttr(style)}"` : ''}>Sample value 12.5</span>`;
    }
    if (warn) {
        const bg = draft.colors.background.startsWith('#')
            ? draft.colors.background
            : (parseCssColorToRgb(draft.colors.background)
                ? `rgb(${parseCssColorToRgb(draft.colors.background).r},${parseCssColorToRgb(draft.colors.background).g},${parseCssColorToRgb(draft.colors.background).b})`
                : '#1e1e1e');
        const info = getContrastWarning(draft.colors.text, bg);
        warn.textContent = info.message || '';
        warn.classList.toggle('ccr-contrast-bad', !info.ok);
        warn.classList.toggle('ccr-contrast-ok', !!info.ok);
    }
}

function populateCcrSubstanceSelect() {
    const el = document.getElementById('ccr-rule-substance');
    if (!el) return;
    const current = el.value || 'all';
    const substances = typeof getActiveSubstances === 'function' ? getActiveSubstances() : (appData.substances || []);
    el.innerHTML = `<option value="all">All substances</option>` + substances.map(s =>
        `<option value="${escapeAttr(s.id)}">${escapeHtml(s.icon || '')} ${escapeHtml(s.name)}</option>`
    ).join('');
    el.value = [...el.options].some(o => o.value === current) ? current : 'all';
}

function renderConditionalColorRulesList() {
    const root = document.getElementById('ccr-rules-list');
    if (!root) return;
    const state = ensureConditionalColorRules();
    const enabledToggle = document.getElementById('ccr-rules-enabled');
    if (enabledToggle) enabledToggle.checked = state.enabled !== false;

    const rules = state.rules.slice().sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
    if (!rules.length) {
        root.innerHTML = '<p class="empty-hint">No rules yet. Add a rule or restore presets.</p>';
        return;
    }
    root.innerHTML = rules.map(rule => {
        const swatchStyle = buildConditionalColorInlineStyle({ style: rule.colors, matched: [rule] });
        return `<article class="ccr-rule-card${!rule.enabled ? ' is-disabled' : ''}" data-rule-id="${escapeAttr(rule.id)}">
            <div class="ccr-rule-card-main">
                <span class="ccr-rule-swatch"${swatchStyle ? ` style="${escapeAttr(swatchStyle)}"` : ''}></span>
                <div>
                    <strong>${escapeHtml(rule.name)}</strong>
                    <p class="ccr-rule-meta">${escapeHtml(rule.metric)} · ${escapeHtml(rule.operator)} · priority ${escapeHtml(String(rule.priority))}${rule.statusLabel ? ` · ${escapeHtml(rule.statusLabel)}` : ''}</p>
                </div>
            </div>
            <div class="ccr-rule-card-actions">
                <label class="ccr-enable-mini"><input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="setConditionalColorRuleEnabled('${escapeAttr(rule.id)}', this.checked); renderConditionalColorRulesSettings();"> On</label>
                <button type="button" class="secondary-btn btn-sm" onclick="reorderConditionalColorRule('${escapeAttr(rule.id)}', -1); renderConditionalColorRulesSettings();">↑</button>
                <button type="button" class="secondary-btn btn-sm" onclick="reorderConditionalColorRule('${escapeAttr(rule.id)}', 1); renderConditionalColorRulesSettings();">↓</button>
                <button type="button" class="secondary-btn btn-sm" onclick="openConditionalColorRuleEditor('${escapeAttr(rule.id)}')">Edit</button>
                <button type="button" class="secondary-btn btn-sm" onclick="duplicateConditionalColorRule('${escapeAttr(rule.id)}'); renderConditionalColorRulesSettings();">Duplicate</button>
                <button type="button" class="danger-btn btn-sm" onclick="confirmDeleteConditionalColorRule('${escapeAttr(rule.id)}')">Delete</button>
            </div>
        </article>`;
    }).join('');
}

function renderConditionalColorRulesSettings() {
    populateCcrSubstanceSelect();
    const metricEl = document.getElementById('ccr-rule-metric');
    if (metricEl && !metricEl.options.length) {
        metricEl.innerHTML = CCR_METRICS.map(m => `<option value="${m.id}">${escapeHtml(m.label)}</option>`).join('');
    }
    const opEl = document.getElementById('ccr-rule-operator');
    if (opEl && !opEl.options.length) {
        opEl.innerHTML = CCR_OPERATORS.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');
    }
    const sectionsEl = document.getElementById('ccr-rule-sections');
    if (sectionsEl && !sectionsEl.options.length) {
        sectionsEl.innerHTML = CCR_SECTIONS.map(s => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('');
    }
    renderConditionalColorRulesList();
    updateCcrOperatorFieldsVisibility();
    updateCcrLivePreview();
}

function openConditionalColorRuleEditor(ruleId = null) {
    const state = ensureConditionalColorRules();
    const rule = ruleId ? state.rules.find(r => r.id === ruleId) : null;
    const editor = document.getElementById('ccr-rule-editor');
    editor?.classList.remove('hidden');
    fillCcrEditorForm(rule || {
        id: ccrNewId(),
        name: 'New rule',
        enabled: true,
        metric: 'useAmount',
        operator: 'gt',
        value: 0,
        priority: 100,
        sectionScope: ['all'],
        substanceScope: 'all',
        colors: { background: 'rgba(76, 175, 80, 0.22)', text: '#81c784', border: '#4caf50' },
        statusLabel: ''
    });
    populateCcrSubstanceSelect();
}

function closeConditionalColorRuleEditor() {
    document.getElementById('ccr-rule-editor')?.classList.add('hidden');
    ccrEditingRuleId = null;
}

function saveConditionalColorRuleFromForm() {
    const draft = getCcrEditorDraftFromForm();
    if (!draft.name.trim()) {
        if (typeof showToast === 'function') showToast('Rule name is required');
        return;
    }
    saveConditionalColorRule(draft);
    closeConditionalColorRuleEditor();
    renderConditionalColorRulesSettings();
    if (typeof showToast === 'function') showToast('Color rule saved');
    if (typeof refreshAppAfterDataChange === 'function') {
        try { refreshAppAfterDataChange({ skipSave: true }); } catch (_) { /* ignore */ }
    }
}

function confirmDeleteConditionalColorRule(ruleId) {
    if (!confirm('Delete this color rule? This does not change any tracked data.')) return;
    deleteConditionalColorRule(ruleId);
    renderConditionalColorRulesSettings();
}

function onConditionalColorRulesEnabledToggle(checked) {
    setConditionalColorRulesEnabled(!!checked);
    renderConditionalColorRulesSettings();
}

function downloadConditionalColorRulesExport() {
    const json = exportConditionalColorRulesJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-tracker-color-rules-${getLocalDateString?.() || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function onConditionalColorRulesImportFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const replace = confirm('Replace existing rules with imported rules?\n\nOK = replace\nCancel = merge');
            importConditionalColorRulesJson(String(reader.result || ''), appData, { replace });
            renderConditionalColorRulesSettings();
            if (typeof showToast === 'function') showToast('Color rules imported');
        } catch (err) {
            alert(err?.message || 'Failed to import color rules');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function syncCcrColorInputs(source) {
    const pairs = [
        ['ccr-rule-text-picker', 'ccr-rule-text', 'ccr-rule-text-hex'],
        ['ccr-rule-border-picker', 'ccr-rule-border', 'ccr-rule-border-hex']
    ];
    pairs.forEach(([pickerId, valueId, hexId]) => {
        const picker = document.getElementById(pickerId);
        const value = document.getElementById(valueId);
        const hex = document.getElementById(hexId);
        if (!picker || !value || !hex) return;
        if (source === picker) {
            value.value = picker.value;
            hex.value = picker.value;
        } else if (source === hex) {
            const normalized = normalizeHexColor(hex.value, picker.value);
            hex.value = normalized;
            if (normalized.startsWith('#') && normalized.length === 7) {
                picker.value = normalized;
                value.value = normalized;
            }
        } else if (source === value) {
            if (String(value.value).startsWith('#')) {
                const normalized = normalizeHexColor(value.value, picker.value);
                hex.value = normalized;
                if (normalized.length === 7) picker.value = normalized;
            }
        }
    });
    updateCcrLivePreview();
}

function initConditionalColorRulesUi() {
    ensureConditionalColorRules();
    renderConditionalColorRulesSettings();
}
