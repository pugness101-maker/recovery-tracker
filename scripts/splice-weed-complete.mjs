#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'weed-complete.module.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing: ${label}\n${find.slice(0, 180)}`);
    return src.replace(find, repl);
}

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn(`Skip: ${label}`);
        return src;
    }
    return src.replace(find, repl);
}

if (!app.includes('// ——— Complete Weed Support ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced weed-complete module');
} else {
    console.log('Weed-complete already in app.js');
}

// Hook migration
app = tryReplace(app,
    `function migrateInventorySubstanceFields(data) {
    migrateWeedProductTypeValues(data);
    migrateWeedCartPercentInventory(data);
    migrateWeedEdibleStrengthFields(data);`,
    `function migrateInventorySubstanceFields(data) {
    migrateWeedProductTypeValues(data);
    migrateWeedCartPercentInventory(data);
    migrateWeedEdibleStrengthFields(data);
    if (typeof ensureWeedCompleteMigrated === 'function') ensureWeedCompleteMigrated(data);`,
    'migrate weed complete');

// Fix pre-roll usage bucket typo
app = tryReplace(app,
    `const buckets = { bud: 0, cart: 0, edibles: 0, 'pre-roll': 0 };`,
    `const buckets = { bud: 0, cart: 0, edibles: 0, 'pre-rolls': 0 };`,
    'pre-rolls bucket key');

// Prefer allowEmpty when reading purchase product type for Needs Review
app = tryReplace(app,
    `function purchaseMatchesWeedProductType(purchase, productType) {
    if (!purchase) return false;
    const wanted = normalizeWeedProductType(productType);
    const actual = normalizeWeedProductType(purchase.weedProductType || 'bud');
    return actual === wanted;
}`,
    `function purchaseMatchesWeedProductType(purchase, productType) {
    if (!purchase) return false;
    const wanted = normalizeWeedProductType(productType);
    const actual = normalizeWeedProductType(purchase.weedProductType, { allowEmpty: true });
    if (!actual) return false;
    return actual === wanted;
}`,
    'purchase match no silent bud');

// Expand cannabis history columns
app = tryReplace(app,
    `    cannabis: [
        'select', 'date', 'start', 'end', 'duration', 'productType', 'transactionType',
        'amount', 'unit', 'thcUsed', 'strength', 'cost', 'inventory', 'notes', 'actions'
    ],`,
    `    cannabis: [
        'select', 'date', 'productType', 'transactionType', 'amount', 'unit',
        'thcUsed', 'cbdUsed', 'strength', 'cost', 'sharedAmount', 'inventory', 'notes', 'actions'
    ],`,
    'cannabis history columns');

// Add column catalog entries for cbdUsed / entered / normalized in useHistory order
app = tryReplace(app,
    `'transactionType', 'amount', 'unit', 'tabs', 'ug', 'pills', 'mg', 'thcUsed', 'strength',
            'cost', 'gPerHour', 'sharedAmount', 'multiDayRange', 'dailyBreakdown',`,
    `'transactionType', 'amount', 'unit', 'tabs', 'ug', 'pills', 'mg', 'thcUsed', 'cbdUsed', 'strength',
            'enteredAmount', 'normalizedAmount', 'percentBefore', 'percentAfter', 'percentUsed',
            'cost', 'gPerHour', 'sharedAmount', 'multiDayRange', 'dailyBreakdown',`,
    'useHistory order weed cols');

app = tryReplace(app,
    `            thcUsed: 100,
            strength: 120,`,
    `            thcUsed: 100,
            cbdUsed: 100,
            enteredAmount: 110,
            normalizedAmount: 120,
            percentBefore: 100,
            percentAfter: 100,
            percentUsed: 100,
            strength: 120,`,
    'useHistory widths weed');

app = tryReplace(app,
    `        thcUsed: 'THC Used',
        strength: 'Strength',`,
    `        thcUsed: 'THC Used',
        cbdUsed: 'CBD Used',
        enteredAmount: 'Entered Amount',
        normalizedAmount: 'Normalized Amount',
        percentBefore: 'Percent Before',
        percentAfter: 'Percent After',
        percentUsed: 'Percent Used',
        strength: 'Strength',`,
    'useHistory labels weed');

// Cell rendering for new columns (after thcUsed case)
if (!app.includes("case 'cbdUsed':")) {
    app = tryReplace(app,
        `        case 'thcUsed': {
            const thc = getWeedEdibleLogThcUsed(entry);
            return \`<td data-col="\${colId}"\${dataLabel}>\${thc != null ? \`\${formatAmount(thc)} mg\` : '—'}</td>\`;
        }
        case 'strength': {`,
        `        case 'thcUsed': {
            const thc = getWeedEdibleLogThcUsed(entry);
            return \`<td data-col="\${colId}"\${dataLabel}>\${thc != null ? \`\${formatAmount(thc)} mg\` : '—'}</td>\`;
        }
        case 'cbdUsed': {
            const cbd = typeof getWeedEdibleLogCbdUsed === 'function' ? getWeedEdibleLogCbdUsed(entry) : null;
            return \`<td data-col="\${colId}"\${dataLabel}>\${cbd != null ? \`\${formatAmount(cbd)} mg\` : '—'}</td>\`;
        }
        case 'enteredAmount': {
            const entered = entry.enteredAmount ?? entry.originalEnteredAmount;
            const unit = entry.enteredUnit || entry.unit || '';
            return \`<td data-col="\${colId}"\${dataLabel}>\${entered != null ? \`\${formatAmount(entered)}\${unit ? \` \${escapeHtml(unit)}\` : ''}\` : '—'}</td>\`;
        }
        case 'normalizedAmount': {
            const grams = entry.normalizedGrams;
            if (grams != null) return \`<td data-col="\${colId}"\${dataLabel}>\${formatAmount(grams)} g</td>\`;
            return \`<td data-col="\${colId}"\${dataLabel}>—</td>\`;
        }
        case 'percentBefore': {
            const v = entry.percentBefore;
            return \`<td data-col="\${colId}"\${dataLabel}>\${v != null ? \`\${formatAmount(v)}%\` : '—'}</td>\`;
        }
        case 'percentAfter': {
            const v = entry.percentLeftAfter ?? entry.percentAfter ?? entry.percentRemaining;
            return \`<td data-col="\${colId}"\${dataLabel}>\${v != null ? \`\${formatAmount(v)}%\` : '—'}</td>\`;
        }
        case 'percentUsed': {
            const v = entry.estimatedPercentUsed ?? (isWeedCartPercentLog(entry) ? entry.amount : null);
            return \`<td data-col="\${colId}"\${dataLabel}>\${v != null ? \`\${formatAmount(v)}%\` : '—'}</td>\`;
        }
        case 'strength': {`,
        'history cell weed extras');
}

// Enhance formatUseHistoryWeedAmountHtml
app = tryReplace(app,
    `function formatUseHistoryWeedAmountHtml(entry) {
    if (isWeedCartPercentLog(entry) || normalizeWeedProductType(entry.weedProductType, { allowEmpty: true }) === 'cart') {
        return \`<span class="use-history-amount-compact">\${escapeHtml(formatWeedCartUseSummary(entry))}</span>\`;
    }
    if (isWeedEdiblesLog(entry) || normalizeWeedProductType(entry.weedProductType, { allowEmpty: true }) === 'edibles') {
        return \`<span class="use-history-amount-compact">\${escapeHtml(formatWeedEdibleAmountLabel(entry.amount))}</span>\`;
    }
    const unit = entry.unit || '';
    const amount = formatAmount(entry.amount);
    if (normalizeWeedProductType(entry.weedProductType) === 'bud') {
        return \`<span class="use-history-amount-compact">\${amount}\${unit ? \` \${escapeHtml(unit)}\` : ''}</span>\`;
    }
    return \`<span class="use-history-amount-compact">\${amount}\${unit && unit !== 'units' ? \` \${escapeHtml(unit)}\` : ''}</span>\`;
}`,
    `function formatUseHistoryWeedAmountHtml(entry) {
    if (typeof formatWeedNormalizedUseSummary === 'function') {
        return \`<span class="use-history-amount-compact">\${escapeHtml(formatWeedNormalizedUseSummary(entry))}</span>\`;
    }
    if (isWeedCartPercentLog(entry) || normalizeWeedProductType(entry.weedProductType, { allowEmpty: true }) === 'cart') {
        return \`<span class="use-history-amount-compact">\${escapeHtml(formatWeedCartUseSummary(entry))}</span>\`;
    }
    if (isWeedEdiblesLog(entry) || normalizeWeedProductType(entry.weedProductType, { allowEmpty: true }) === 'edibles') {
        return \`<span class="use-history-amount-compact">\${escapeHtml(formatWeedEdibleUseSummary(entry))}</span>\`;
    }
    const unit = entry.unit || '';
    const amount = formatAmount(entry.amount);
    if (normalizeWeedProductType(entry.weedProductType, { allowEmpty: true }) === 'bud') {
        return \`<span class="use-history-amount-compact">\${amount}\${unit ? \` \${escapeHtml(unit)}\` : ''} Bud</span>\`;
    }
    return \`<span class="use-history-amount-compact">\${amount}\${unit && unit !== 'units' ? \` \${escapeHtml(unit)}\` : ''}</span>\`;
}`,
    'format weed history amount');

// Recent use amount via normalized summary
app = tryReplace(app,
    `                        : (isWeedSimple
                            ? (isWeedCartPercentLog(log)
                                ? formatWeedCartUseSummary(log)
                                : (isWeedEdiblesLog(log)
                                    ? formatWeedEdibleUseSummary(log)
                                    : \`\${log.amount != null ? formatAmount(log.amount) : '—'} \${log.unit || ''}\`.trim()))
                            : \`\${log.amount != null ? formatAmount(log.amount) : '—'} \${log.unit || ''}\`))));`,
    `                        : (isWeedSimple
                            ? (typeof formatWeedNormalizedUseSummary === 'function'
                                ? formatWeedNormalizedUseSummary(log)
                                : (isWeedCartPercentLog(log)
                                    ? formatWeedCartUseSummary(log)
                                    : (isWeedEdiblesLog(log)
                                        ? formatWeedEdibleUseSummary(log)
                                        : \`\${log.amount != null ? formatAmount(log.amount) : '—'} \${log.unit || ''}\`.trim())))
                            : \`\${log.amount != null ? formatAmount(log.amount) : '—'} \${log.unit || ''}\`))));`,
    'recent use weed summary');

// sync edible CBD after THC sync
app = tryReplace(app,
    `    syncWeedEdiblePurchaseRemaining(purchase);
    return purchase;
}

function syncWeedEdiblePurchaseRemaining(purchase) {`,
    `    syncWeedEdiblePurchaseRemaining(purchase);
    if (typeof syncWeedEdibleCbdFields === 'function') syncWeedEdibleCbdFields(purchase);
    return purchase;
}

function syncWeedEdiblePurchaseRemaining(purchase) {`,
    'sync edible cbd');

// parseWeedFieldsFromForm — CBD + cart/bud extras
app = tryReplace(app,
    `    const mgPerEdibleRaw = parseFloat(document.getElementById('buy-edibles-mg')?.value);
    const edibleCountRaw = parseFloat(document.getElementById('buy-quantity')?.value);`,
    `    const mgPerEdibleRaw = parseFloat(document.getElementById('buy-edibles-mg')?.value);
    const cbdMgPerEdibleRaw = parseFloat(document.getElementById('buy-edibles-cbd-mg')?.value);
    const edibleCountRaw = parseFloat(document.getElementById('buy-quantity')?.value);
    const thcPctRaw = parseFloat(document.getElementById('buy-weed-thc-pct')?.value);
    const cbdPctRaw = parseFloat(document.getElementById('buy-weed-cbd-pct')?.value);
    const strain = (document.getElementById('buy-weed-strain')?.value || '').trim();
    const brand = (document.getElementById('buy-weed-brand')?.value || '').trim();
    const jointEstRaw = parseFloat(document.getElementById('buy-bud-joint-estimate')?.value);
    const bowlEstRaw = parseFloat(document.getElementById('buy-bud-bowl-estimate')?.value);
    const cartCountExtra = parseFloat(document.getElementById('buy-quantity')?.value);
    const startingPercentRaw = parseFloat(document.getElementById('buy-cart-starting-percent')?.value);`,
    'parse weed extra fields');

app = tryReplace(app,
    `    const mgPerEdible = weedProductType === 'edibles' && Number.isFinite(mgPerEdibleRaw) && mgPerEdibleRaw > 0
        ? mgPerEdibleRaw
        : null;
    const totalThcMg = weedProductType === 'edibles'
        ? computeWeedEdibleTotalThcMg(edibleCount, mgPerEdible)
        : null;`,
    `    const mgPerEdible = weedProductType === 'edibles' && Number.isFinite(mgPerEdibleRaw) && mgPerEdibleRaw > 0
        ? mgPerEdibleRaw
        : null;
    const cbdMgPerEdible = weedProductType === 'edibles' && Number.isFinite(cbdMgPerEdibleRaw) && cbdMgPerEdibleRaw >= 0
        ? cbdMgPerEdibleRaw
        : null;
    const totalThcMg = weedProductType === 'edibles'
        ? computeWeedEdibleTotalThcMg(edibleCount, mgPerEdible)
        : null;
    const totalCbdMg = weedProductType === 'edibles' && typeof computeWeedEdibleTotalCbdMg === 'function'
        ? computeWeedEdibleTotalCbdMg(edibleCount, cbdMgPerEdible)
        : null;`,
    'parse weed cbd totals');

app = tryReplace(app,
    `    return {
        weedProductType,
        budGrams,
        cartGrams,
        edibleCount,
        mgPerEdible,
        totalThcMg,
        ediblesMg: totalThcMg,
        preRollCount,
        gramsPerPreRoll,
        totalPreRollGrams
    };
}`,
    `    return {
        weedProductType,
        budGrams,
        cartGrams,
        edibleCount,
        mgPerEdible,
        cbdMgPerEdible,
        totalThcMg,
        totalCbdMg,
        ediblesMg: totalThcMg,
        preRollCount,
        gramsPerPreRoll,
        totalPreRollGrams,
        thcPercent: Number.isFinite(thcPctRaw) && thcPctRaw >= 0 ? thcPctRaw : null,
        cbdPercent: Number.isFinite(cbdPctRaw) && cbdPctRaw >= 0 ? cbdPctRaw : null,
        strain: strain || null,
        brand: brand || null,
        jointEstimate: Number.isFinite(jointEstRaw) && jointEstRaw > 0 ? jointEstRaw : null,
        bowlEstimate: Number.isFinite(bowlEstRaw) && bowlEstRaw > 0 ? bowlEstRaw : null,
        cartCount: weedProductType === 'cart' && Number.isFinite(cartCountExtra) && cartCountExtra > 0 ? cartCountExtra : null,
        startingPercent: weedProductType === 'cart' && Number.isFinite(startingPercentRaw) ? startingPercentRaw : null
    };
}`,
    'parse weed return extras');

app = tryReplace(app,
    `    ['budGrams', 'cartGrams', 'ediblesMg', 'mgPerEdible', 'totalThcMg', 'remainingThcMg',
        'preRollCount', 'gramsPerPreRoll', 'totalPreRollGrams', 'needsStrengthInfo'].forEach(key => {
        delete payload[key];
    });
    if (payload.weedProductType === 'bud' && fields.budGrams != null) payload.budGrams = fields.budGrams;
    if (payload.weedProductType === 'cart' && fields.cartGrams != null) payload.cartGrams = fields.cartGrams;
    if (payload.weedProductType === 'edibles') {
        if (fields.mgPerEdible != null) {
            payload.mgPerEdible = fields.mgPerEdible;
            payload.totalThcMg = fields.totalThcMg;
            payload.ediblesMg = fields.totalThcMg;
            payload.needsStrengthInfo = false;
        } else {
            payload.needsStrengthInfo = true;
        }
    }
    if (payload.weedProductType === 'pre-rolls') {
        if (fields.preRollCount != null) payload.preRollCount = fields.preRollCount;
        if (fields.gramsPerPreRoll != null) payload.gramsPerPreRoll = fields.gramsPerPreRoll;
        if (fields.totalPreRollGrams != null) payload.totalPreRollGrams = fields.totalPreRollGrams;
    }
}`,
    `    ['budGrams', 'cartGrams', 'ediblesMg', 'mgPerEdible', 'cbdMgPerEdible', 'totalThcMg', 'totalCbdMg',
        'remainingThcMg', 'remainingCbdMg', 'preRollCount', 'gramsPerPreRoll', 'totalPreRollGrams',
        'needsStrengthInfo', 'thcPercent', 'cbdPercent', 'strain', 'brand', 'jointEstimate', 'bowlEstimate',
        'startingPercent', 'remainingPreRollCount', 'remainingGrams'].forEach(key => {
        delete payload[key];
    });
    if (payload.weedProductType === 'bud' && fields.budGrams != null) payload.budGrams = fields.budGrams;
    if (payload.weedProductType === 'cart' && fields.cartGrams != null) payload.cartGrams = fields.cartGrams;
    if (fields.thcPercent != null) payload.thcPercent = fields.thcPercent;
    if (fields.cbdPercent != null) payload.cbdPercent = fields.cbdPercent;
    if (fields.strain) payload.strain = fields.strain;
    if (fields.brand) payload.brand = fields.brand;
    if (payload.weedProductType === 'bud') {
        if (fields.jointEstimate != null) payload.jointEstimate = fields.jointEstimate;
        if (fields.bowlEstimate != null) payload.bowlEstimate = fields.bowlEstimate;
    }
    if (payload.weedProductType === 'cart') {
        if (fields.startingPercent != null) payload.startingPercent = fields.startingPercent;
        else payload.startingPercent = 100;
    }
    if (payload.weedProductType === 'edibles') {
        if (fields.mgPerEdible != null) {
            payload.mgPerEdible = fields.mgPerEdible;
            payload.totalThcMg = fields.totalThcMg;
            payload.ediblesMg = fields.totalThcMg;
            payload.needsStrengthInfo = false;
        } else {
            payload.needsStrengthInfo = true;
        }
        if (fields.cbdMgPerEdible != null) {
            payload.cbdMgPerEdible = fields.cbdMgPerEdible;
            payload.totalCbdMg = fields.totalCbdMg;
            payload.remainingCbdMg = fields.totalCbdMg;
        }
    }
    if (payload.weedProductType === 'pre-rolls') {
        if (fields.preRollCount != null) {
            payload.preRollCount = fields.preRollCount;
            payload.remainingPreRollCount = fields.preRollCount;
        }
        if (fields.gramsPerPreRoll != null) payload.gramsPerPreRoll = fields.gramsPerPreRoll;
        if (fields.totalPreRollGrams != null) {
            payload.totalPreRollGrams = fields.totalPreRollGrams;
            payload.remainingGrams = fields.totalPreRollGrams;
        }
    }
}`,
    'apply weed fields payload');

// updateWeedUseUnitOptions — pre-roll + hits
app = tryReplace(app,
    `    if (type === 'bud') {
        ['grams', 'bowls', 'joints'].forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        });
        unitSelect.value = 'grams';
    } else if (type === 'cart') {
        const option = document.createElement('option');
        option.value = 'percent';
        option.textContent = '%';
        unitSelect.appendChild(option);
        unitSelect.value = 'percent';
    } else if (type === 'edibles') {
        const option = document.createElement('option');
        option.value = 'edible';
        option.textContent = 'edible';
        unitSelect.appendChild(option);
        unitSelect.value = 'edible';
    } else {
        const option = document.createElement('option');
        option.value = 'units';
        option.textContent = 'count';
        unitSelect.appendChild(option);
        unitSelect.value = 'units';
    }`,
    `    if (type === 'bud') {
        const budUnits = ['grams', 'bowls', 'joints'];
        if (typeof getWeedCompletePrefs === 'function' && getWeedCompletePrefs().enableBudHitsLogging) budUnits.push('hits');
        budUnits.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        });
        unitSelect.value = 'grams';
    } else if (type === 'cart') {
        const option = document.createElement('option');
        option.value = 'percent';
        option.textContent = '%';
        unitSelect.appendChild(option);
        unitSelect.value = 'percent';
    } else if (type === 'edibles') {
        const option = document.createElement('option');
        option.value = 'edible';
        option.textContent = 'edible';
        unitSelect.appendChild(option);
        unitSelect.value = 'edible';
    } else if (type === 'pre-rolls') {
        const option = document.createElement('option');
        option.value = 'pre-roll';
        option.textContent = 'pre-roll';
        unitSelect.appendChild(option);
        unitSelect.value = 'pre-roll';
    } else {
        const option = document.createElement('option');
        option.value = 'units';
        option.textContent = 'count';
        unitSelect.appendChild(option);
        unitSelect.value = 'units';
    }`,
    'weed use unit options');

app = tryReplace(app,
    `    if (type === 'bud') {
        amountLabel.textContent = 'Amount';
    } else if (type === 'cart') {
        amountLabel.textContent = 'Estimated percent used';
    } else if (type === 'edibles') {
        amountLabel.textContent = 'Edible amount used';
    } else {
        amountLabel.textContent = 'Quantity (count)';
    }
}`,
    `    if (type === 'bud') {
        amountLabel.textContent = 'Amount';
    } else if (type === 'cart') {
        amountLabel.textContent = 'Estimated percent used';
    } else if (type === 'edibles') {
        amountLabel.textContent = 'Edible amount used';
    } else if (type === 'pre-rolls') {
        amountLabel.textContent = 'Pre-roll amount (count or fraction)';
    } else {
        amountLabel.textContent = 'Quantity (count)';
    }
}`,
    'weed use amount labels');

// updateWeedUseFormUI toggles for bud/preroll groups
app = tryReplace(app,
    `    const isCart = productType === 'cart';
    const isEdibles = productType === 'edibles';
    document.getElementById('use-weed-product-type-group')?.classList.remove('hidden');
    document.getElementById('use-weed-cart-fields-group')?.classList.toggle('hidden', !isCart);
    document.getElementById('use-weed-edibles-fields-group')?.classList.toggle('hidden', !isEdibles);
    document.getElementById('use-amount-mode-group')?.classList.toggle('hidden', isCart);`,
    `    const isCart = productType === 'cart';
    const isEdibles = productType === 'edibles';
    const isBud = productType === 'bud';
    const isPreRolls = productType === 'pre-rolls';
    document.getElementById('use-weed-product-type-group')?.classList.remove('hidden');
    document.getElementById('use-weed-cart-fields-group')?.classList.toggle('hidden', !isCart);
    document.getElementById('use-weed-edibles-fields-group')?.classList.toggle('hidden', !isEdibles);
    document.getElementById('use-weed-bud-fields-group')?.classList.toggle('hidden', !isBud);
    document.getElementById('use-weed-preroll-fields-group')?.classList.toggle('hidden', !isPreRolls);
    document.getElementById('use-amount-mode-group')?.classList.toggle('hidden', isCart);
    if (typeof updateWeedBudEstimateVisibility === 'function') updateWeedBudEstimateVisibility();`,
    'weed use form groups');

// After edibles block in buildUseEntryFromForm, add bud/preroll/cbd handling
if (!app.includes('computeWeedBudNormalizedGrams(')) {
    app = tryReplace(app,
        `    if (isWeedSimple && weedProductType === 'edibles') {
        base.weedProductType = 'edibles';
        base.unit = 'edible';
        base.logMode = 'weed_edible';
        let mgPer = parseFloat(document.getElementById('use-weed-edible-mg-per')?.value);
        if (!(Number.isFinite(mgPer) && mgPer > 0) && linkedPurchaseId) {
            const linked = findPurchase(linkedPurchaseId);
            mgPer = getWeedEdibleMgPerEdible(linked);
        }
        if (Number.isFinite(mgPer) && mgPer > 0) {
            base.mgPerEdibleAtTimeOfUse = mgPer;
            const thcUsed = (Number.isFinite(amount) ? amount : 0) * mgPer;
            base.thcMgUsed = thcUsed;
            base.mgUsed = thcUsed;
        } else {
            delete base.mgPerEdibleAtTimeOfUse;
            delete base.thcMgUsed;
            delete base.mgUsed;
        }
        base.needsReview = false;
    }

    if (isNicotine) {`,
        `    if (isWeedSimple && weedProductType === 'edibles') {
        base.weedProductType = 'edibles';
        base.unit = 'edible';
        base.logMode = 'weed_edible';
        let mgPer = parseFloat(document.getElementById('use-weed-edible-mg-per')?.value);
        if (!(Number.isFinite(mgPer) && mgPer > 0) && linkedPurchaseId) {
            const linked = findPurchase(linkedPurchaseId);
            mgPer = getWeedEdibleMgPerEdible(linked);
        }
        if (Number.isFinite(mgPer) && mgPer > 0) {
            base.mgPerEdibleAtTimeOfUse = mgPer;
            const thcUsed = (Number.isFinite(amount) ? amount : 0) * mgPer;
            base.thcMgUsed = thcUsed;
            base.mgUsed = thcUsed;
        } else {
            delete base.mgPerEdibleAtTimeOfUse;
            delete base.thcMgUsed;
            delete base.mgUsed;
        }
        let cbdPer = parseFloat(document.getElementById('use-weed-edible-cbd-mg-per')?.value);
        if (!(Number.isFinite(cbdPer) && cbdPer >= 0) && linkedPurchaseId) {
            const linked = findPurchase(linkedPurchaseId);
            cbdPer = typeof getWeedCbdMgPerEdible === 'function' ? getWeedCbdMgPerEdible(linked) : null;
        }
        if (Number.isFinite(cbdPer) && cbdPer >= 0) {
            base.cbdMgPerEdibleAtTimeOfUse = cbdPer;
            base.cbdMgUsed = (Number.isFinite(amount) ? amount : 0) * cbdPer;
        } else {
            delete base.cbdMgPerEdibleAtTimeOfUse;
            delete base.cbdMgUsed;
        }
        base.enteredAmount = Number.isFinite(amount) ? amount : 0;
        base.enteredUnit = 'edible';
        base.needsReview = false;
    }

    if (isWeedSimple && weedProductType === 'bud' && typeof computeWeedBudNormalizedGrams === 'function') {
        const estimate = parseFloat(document.getElementById('use-weed-bud-grams-per-unit')?.value);
        const calc = computeWeedBudNormalizedGrams({
            enteredAmount: amount,
            unit,
            gramsPerUnit: estimate,
            data: appData
        });
        if (!calc.error) {
            base.weedProductType = 'bud';
            base.logMode = 'weed_bud';
            base.enteredAmount = calc.enteredAmount;
            base.originalEnteredAmount = calc.enteredAmount;
            base.enteredUnit = calc.enteredUnit;
            if (calc.gramsPerUnitEstimate != null) base.gramsPerUnitEstimate = calc.gramsPerUnitEstimate;
            if (calc.normalizedGrams != null) base.normalizedGrams = calc.normalizedGrams;
            base.amount = calc.amount;
            base.unit = calc.unit;
            if (calc.estimate) base.estimatedFromMeasure = true;
            if (calc.needsReview) base.needsReview = true;
        }
    }

    if (isWeedSimple && weedProductType === 'pre-rolls' && typeof computeWeedPreRollNormalized === 'function') {
        let gPer = parseFloat(document.getElementById('use-weed-preroll-grams-per')?.value);
        if (!(Number.isFinite(gPer) && gPer > 0) && linkedPurchaseId) {
            const linked = findPurchase(linkedPurchaseId);
            gPer = typeof getWeedPreRollGramsPer === 'function' ? getWeedPreRollGramsPer(linked) : null;
        }
        const calc = computeWeedPreRollNormalized({ fractionOrCount: amount, gramsPerPreRoll: gPer });
        if (!calc.error) {
            base.weedProductType = 'pre-rolls';
            base.logMode = 'weed_preroll';
            base.enteredAmount = calc.enteredAmount;
            base.originalEnteredAmount = calc.enteredAmount;
            base.enteredUnit = 'pre-roll';
            base.amount = calc.amount;
            base.unit = 'pre-roll';
            if (calc.gramsPerPreRollAtTimeOfUse != null) base.gramsPerPreRollAtTimeOfUse = calc.gramsPerPreRollAtTimeOfUse;
            if (calc.normalizedGrams != null) base.normalizedGrams = calc.normalizedGrams;
            base.needsReview = false;
        }
    }

    if (isNicotine) {`,
        'build use entry weed bud/preroll/cbd');
}

// Helper UI functions for bud estimate visibility
if (!app.includes('function updateWeedBudEstimateVisibility')) {
    app = tryReplace(app,
        `function updateWeedUseAmountLabel(productType) {`,
        `function updateWeedBudEstimateVisibility() {
    const group = document.getElementById('use-weed-bud-estimate-group');
    if (!group) return;
    const unit = (document.getElementById('use-unit')?.value || '').toLowerCase();
    const show = ['joints', 'joint', 'bowls', 'bowl', 'hits', 'hit'].includes(unit);
    group.classList.toggle('hidden', !show);
    if (show && typeof getWeedCompletePrefs === 'function') {
        const prefs = getWeedCompletePrefs();
        const input = document.getElementById('use-weed-bud-grams-per-unit');
        if (input && (input.value === '' || input.dataset.fromDefault === '1')) {
            const est = (unit === 'bowls' || unit === 'bowl') ? prefs.gramsPerBowl : prefs.gramsPerJoint;
            input.value = String(est);
            input.dataset.fromDefault = '1';
        }
    }
    if (typeof updateWeedBudUsePreview === 'function') updateWeedBudUsePreview();
}

function updateWeedBudUsePreview() {
    const preview = document.getElementById('use-weed-bud-estimate-preview');
    if (!preview) return;
    if (typeof getWeedUseProductType === 'function' && getWeedUseProductType({ allowEmpty: true }) !== 'bud') {
        preview.textContent = '—';
        return;
    }
    const amount = parseFloat(document.getElementById('use-amount')?.value);
    const unit = document.getElementById('use-unit')?.value;
    const estimate = parseFloat(document.getElementById('use-weed-bud-grams-per-unit')?.value);
    if (typeof computeWeedBudNormalizedGrams !== 'function') {
        preview.textContent = '—';
        return;
    }
    const calc = computeWeedBudNormalizedGrams({ enteredAmount: amount, unit, gramsPerUnit: estimate, data: appData });
    if (calc.error || calc.normalizedGrams == null) {
        preview.textContent = calc.error || 'Normalized grams: —';
        return;
    }
    preview.textContent = \`Normalized: \${formatAmount(calc.normalizedGrams)} g (\${formatAmount(calc.enteredAmount)} \${calc.enteredUnit} × \${formatAmount(calc.gramsPerUnitEstimate)} g)\`;
}

function updateWeedUseAmountLabel(productType) {`,
        'bud estimate helpers');
}

// ensure prefs on load
app = tryReplace(app,
    `    ensureChartSystemPrefs(data);
    ensureTableColumnSettings(data);`,
    `    ensureChartSystemPrefs(data);
    ensureWeedCompletePrefs(data);
    ensureTableColumnSettings(data);`,
    'ensure weed complete prefs');

// stripIrrelevantPurchaseFields keep new weed keys when weed
app = tryReplace(app,
    `    if (mode !== 'weed') {
        ['weedProductType', 'budGrams', 'cartGrams', 'ediblesMg', 'mgPerEdible', 'thcMgPerEdible',
            'totalThcMg', 'remainingThcMg', 'preRollCount', 'gramsPerPreRoll',
            'totalPreRollGrams', 'cartCount', 'cartTracksPercent']
            .forEach(key => delete purchase[key]);
    } else if (isWeedEdiblesPurchase(purchase)) {
        syncWeedEdiblePurchaseFields(purchase);
    } else {
        ['mgPerEdible', 'thcMgPerEdible', 'totalThcMg', 'remainingThcMg', 'ediblesMg']
            .forEach(key => delete purchase[key]);
    }`,
    `    if (mode !== 'weed') {
        ['weedProductType', 'budGrams', 'cartGrams', 'ediblesMg', 'mgPerEdible', 'thcMgPerEdible',
            'cbdMgPerEdible', 'totalThcMg', 'totalCbdMg', 'remainingThcMg', 'remainingCbdMg',
            'preRollCount', 'gramsPerPreRoll', 'totalPreRollGrams', 'remainingPreRollCount', 'remainingGrams',
            'cartCount', 'cartTracksPercent', 'startingPercent', 'thcPercent', 'cbdPercent',
            'strain', 'brand', 'jointEstimate', 'bowlEstimate', 'needsReview']
            .forEach(key => delete purchase[key]);
    } else if (isWeedEdiblesPurchase(purchase)) {
        syncWeedEdiblePurchaseFields(purchase);
        if (typeof syncWeedEdibleCbdFields === 'function') syncWeedEdibleCbdFields(purchase);
    } else {
        ['mgPerEdible', 'thcMgPerEdible', 'cbdMgPerEdible', 'totalThcMg', 'totalCbdMg',
            'remainingThcMg', 'remainingCbdMg', 'ediblesMg']
            .forEach(key => delete purchase[key]);
        if (typeof isWeedPreRollsPurchase === 'function' && isWeedPreRollsPurchase(purchase)) {
            syncWeedPreRollPurchaseFields(purchase);
        }
    }`,
    'strip weed fields complete');

// Test exports
app = tryReplace(app,
    `        ensureChartSystemPrefs,
        getChartSystemPrefs,`,
    `        ensureChartSystemPrefs,
        ensureWeedCompletePrefs,
        ensureWeedCompleteMigrated,
        migrateCompleteWeedSupport,
        computeWeedBudNormalizedGrams,
        computeWeedPreRollNormalized,
        computeWeedEdibleTotalCbdMg,
        getWeedCbdMgPerEdible,
        getWeedEdibleLogCbdUsed,
        syncWeedEdibleCbdFields,
        getWeedCartEstimatedGramsRemaining,
        getWeedCartCostPerPercent,
        estimateWeedCartLifespanDays,
        buildWeedProductAnalytics,
        buildWeedDataHealthReport,
        previewWeedDataHealthRepairs,
        applyWeedDataHealthRepairs,
        validateWeedSharedSplit,
        formatWeedNormalizedUseSummary,
        formatWeedBudUseSummary,
        formatWeedPreRollUseSummary,
        getWeedInventoryDeductionAmount,
        getWeedNormalizedStatsAmount,
        weedPurchaseNeedsProductTypeReview,
        WEED_PRODUCT_TYPES,
        getChartSystemPrefs,`,
    'weed complete test exports');

// ——— HTML ———
if (!html.includes('id="buy-edibles-cbd-mg"')) {
    html = replaceOnce(html,
        `                        <div class="form-group hidden" id="buy-weed-edibles-group">
                            <label for="buy-edibles-mg">THC mg per edible</label>
                            <input type="number" id="buy-edibles-mg" min="0" step="0.1" placeholder="e.g. 20" oninput="updateBuyWeedEdiblesPreview()">
                            <p id="buy-edibles-preview" class="buy-preview">—</p>
                        </div>`,
        `                        <div class="form-group hidden" id="buy-weed-edibles-group">
                            <label for="buy-edibles-mg">THC mg per edible</label>
                            <input type="number" id="buy-edibles-mg" min="0" step="0.1" placeholder="e.g. 20" oninput="updateBuyWeedEdiblesPreview()">
                            <label for="buy-edibles-cbd-mg">CBD mg per edible</label>
                            <input type="number" id="buy-edibles-cbd-mg" min="0" step="0.1" placeholder="optional" oninput="updateBuyWeedEdiblesPreview()">
                            <p id="buy-edibles-preview" class="buy-preview">—</p>
                        </div>
                        <div class="form-row" id="buy-weed-strength-row">
                            <div class="form-group">
                                <label for="buy-weed-thc-pct">THC %</label>
                                <input type="number" id="buy-weed-thc-pct" min="0" max="100" step="0.1" placeholder="optional">
                            </div>
                            <div class="form-group">
                                <label for="buy-weed-cbd-pct">CBD %</label>
                                <input type="number" id="buy-weed-cbd-pct" min="0" max="100" step="0.1" placeholder="optional">
                            </div>
                        </div>
                        <div class="form-row" id="buy-weed-meta-row">
                            <div class="form-group">
                                <label for="buy-weed-strain">Strain / flavor</label>
                                <input type="text" id="buy-weed-strain" placeholder="optional">
                            </div>
                            <div class="form-group">
                                <label for="buy-weed-brand">Brand</label>
                                <input type="text" id="buy-weed-brand" placeholder="optional">
                            </div>
                        </div>
                        <div class="form-row hidden" id="buy-weed-bud-estimates-row">
                            <div class="form-group">
                                <label for="buy-bud-joint-estimate">Joint estimate (g)</label>
                                <input type="number" id="buy-bud-joint-estimate" min="0" step="0.01" placeholder="e.g. 0.35">
                            </div>
                            <div class="form-group">
                                <label for="buy-bud-bowl-estimate">Bowl estimate (g)</label>
                                <input type="number" id="buy-bud-bowl-estimate" min="0" step="0.01" placeholder="e.g. 0.25">
                            </div>
                        </div>
                        <div class="form-group hidden" id="buy-cart-starting-group">
                            <label for="buy-cart-starting-percent">Starting percent</label>
                            <input type="number" id="buy-cart-starting-percent" min="0" max="100" step="0.1" value="100">
                        </div>`,
        'buy weed complete fields');
}

if (!html.includes('id="use-weed-edible-cbd-mg-per"')) {
    html = replaceOnce(html,
        `                        <div id="use-weed-edibles-fields-group" class="use-weed-edibles-fields-group hidden">
                            <div class="form-group use-log-compact">
                                <label for="use-weed-edible-mg-per">THC mg per edible</label>
                                <input type="number" id="use-weed-edible-mg-per" min="0" step="0.1" placeholder="From linked inventory" oninput="updateWeedEdibleUsePreview()">
                                <p id="use-weed-edible-strength-hint" class="use-supply-preview hidden">Strength missing — needs review</p>
                            </div>
                            <p id="use-weed-edible-thc-preview" class="use-supply-preview">Estimated THC mg used: —</p>
                        </div>`,
        `                        <div id="use-weed-edibles-fields-group" class="use-weed-edibles-fields-group hidden">
                            <div class="form-group use-log-compact">
                                <label for="use-weed-edible-mg-per">THC mg per edible</label>
                                <input type="number" id="use-weed-edible-mg-per" min="0" step="0.1" placeholder="From linked inventory" oninput="updateWeedEdibleUsePreview()">
                                <label for="use-weed-edible-cbd-mg-per">CBD mg per edible</label>
                                <input type="number" id="use-weed-edible-cbd-mg-per" min="0" step="0.1" placeholder="From linked inventory" oninput="updateWeedEdibleUsePreview()">
                                <p id="use-weed-edible-strength-hint" class="use-supply-preview hidden">Strength missing — needs review</p>
                            </div>
                            <p id="use-weed-edible-thc-preview" class="use-supply-preview">Estimated THC mg used: —</p>
                        </div>

                        <div id="use-weed-bud-fields-group" class="use-weed-bud-fields-group hidden">
                            <div class="form-group use-log-compact hidden" id="use-weed-bud-estimate-group">
                                <label for="use-weed-bud-grams-per-unit">Estimated grams per joint/bowl</label>
                                <input type="number" id="use-weed-bud-grams-per-unit" min="0" step="0.01" placeholder="e.g. 0.35" oninput="this.dataset.fromDefault=''; updateWeedBudUsePreview()">
                                <p id="use-weed-bud-estimate-preview" class="use-supply-preview">—</p>
                            </div>
                        </div>

                        <div id="use-weed-preroll-fields-group" class="use-weed-preroll-fields-group hidden">
                            <div class="form-group use-log-compact">
                                <label for="use-weed-preroll-grams-per">Grams per pre-roll</label>
                                <input type="number" id="use-weed-preroll-grams-per" min="0" step="0.01" placeholder="From linked inventory">
                                <p class="use-supply-preview">Fractions allowed: 0.25, 0.5, 0.75, 1, or custom</p>
                            </div>
                        </div>`,
        'use weed complete fields');
}

// Show bud estimate row on buy UI when bud selected — patch updateBuyWeedProductTypeUI
app = tryReplace(app,
    `    document.getElementById('buy-weed-bud-group')?.classList.toggle('hidden', productType !== 'bud');
    document.getElementById('buy-weed-cart-group')?.classList.toggle('hidden', productType !== 'cart');
    document.getElementById('buy-weed-edibles-group')?.classList.toggle('hidden', productType !== 'edibles');
    document.getElementById('buy-weed-prerolls-group')?.classList.toggle('hidden', productType !== 'pre-rolls');
    document.getElementById('buy-quantity-group')?.classList.toggle('hidden', hideQty);`,
    `    document.getElementById('buy-weed-bud-group')?.classList.toggle('hidden', productType !== 'bud');
    document.getElementById('buy-weed-cart-group')?.classList.toggle('hidden', productType !== 'cart');
    document.getElementById('buy-weed-edibles-group')?.classList.toggle('hidden', productType !== 'edibles');
    document.getElementById('buy-weed-prerolls-group')?.classList.toggle('hidden', productType !== 'pre-rolls');
    document.getElementById('buy-weed-bud-estimates-row')?.classList.toggle('hidden', productType !== 'bud');
    document.getElementById('buy-cart-starting-group')?.classList.toggle('hidden', productType !== 'cart');
    document.getElementById('buy-quantity-group')?.classList.toggle('hidden', hideQty);`,
    'buy weed ui extras');

// Chart metrics for weed product specifics
if (app.includes("id: 'milestone_timeline'") && !app.includes("id: 'weed_thc_mg_used'")) {
    app = tryReplace(app,
        `    { id: 'milestone_timeline', label: 'Achievement timeline', category: 'recovery', defaultType: 'scatter', unitFamily: 'count' }
]);`,
        `    { id: 'milestone_timeline', label: 'Achievement timeline', category: 'recovery', defaultType: 'scatter', unitFamily: 'count' },
    { id: 'weed_thc_mg_used', label: 'THC mg used', category: 'use', defaultType: 'line', unitFamily: 'thc_mg' },
    { id: 'weed_cart_percent_used', label: 'Cart percent used', category: 'use', defaultType: 'bar', unitFamily: 'percent' },
    { id: 'weed_cart_depletion', label: 'Cart percent remaining', category: 'inventory', defaultType: 'area', unitFamily: 'percent' },
    { id: 'weed_preroll_count_used', label: 'Pre-rolls used', category: 'use', defaultType: 'bar', unitFamily: 'count' }
]);`,
        'chart weed metrics');
}

if (!css.includes('.use-weed-bud-fields-group')) {
    css += `

/* Complete Weed Support */
.use-weed-bud-fields-group,
.use-weed-preroll-fields-group,
.use-weed-edibles-fields-group,
.use-weed-cart-fields-group { margin-top: 6px; }
.weed-needs-review { color: #c62828; font-weight: 600; }
.weed-estimate-label { font-size: 0.85rem; color: var(--text-secondary); }
`;
    console.log('Appended weed-complete CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-weed-complete complete');
