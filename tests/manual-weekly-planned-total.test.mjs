import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRecoveryTrackerApp } from './harness.mjs';

test('sumManualWeeklyPlannedAmount totals amount-mode weekly goals', () => {
    const rt = loadRecoveryTrackerApp();
    const total = rt.sumManualWeeklyPlannedAmount([
        { week: 1, targetAmount: 3 },
        { week: 2, targetAmount: 3 },
        { week: 3, targetAmount: 2.7 },
        { week: 4, targetAmount: 2.3 },
        { week: 5, targetAmount: 1.5 },
        { week: 6, targetAmount: 0.5 }
    ], { mode: 'amount' });
    assert.equal(total, 13);
    assert.equal(rt.formatManualWeeklyPlannedTotal(total, 'g'), '13.0 g');
});

test('Edit Custom Plan Amount shows Total Planned Amount under weekly targets', () => {
    const rt = loadRecoveryTrackerApp();
    const nodes = new Map();
    const put = (id, props = {}) => {
        const classes = new Set(String(props.className || '').split(/\s+/).filter(Boolean));
        const node = {
            id,
            value: props.value ?? '',
            dataset: {},
            className: props.className || '',
            classList: {
                add(...n) { n.forEach(x => classes.add(x)); node.className = [...classes].join(' '); },
                remove(...n) { n.forEach(x => classes.delete(x)); node.className = [...classes].join(' '); },
                toggle(name, force) {
                    if (force === true) classes.add(name);
                    else if (force === false) classes.delete(name);
                    else if (classes.has(name)) classes.delete(name);
                    else classes.add(name);
                    node.className = [...classes].join(' ');
                    return classes.has(name);
                },
                contains(name) { return classes.has(name); }
            },
            textContent: '',
            innerHTML: '',
            options: props.options || [],
            appendChild(child) {
                if (child) this.options.push(child);
                return child;
            }
        };
        nodes.set(id, node);
        return node;
    };

    put('manual-weekly-targets-list', { tag: 'div' });
    put('manual-weekly-planned-total', { className: '' });
    put('manual-weekly-planned-total-value');
    put('manual-weekly-unit', {
        tag: 'select',
        value: 'g',
        options: [{ value: 'g' }]
    });
    put('manual-weekly-baseline', { value: '' });
    const amountBtn = {
        className: 'manual-mode-btn active',
        dataset: { mode: 'amount' },
        classList: {
            toggle(name, force) {
                if (force) amountBtn.className = 'manual-mode-btn active';
                else amountBtn.className = 'manual-mode-btn';
            }
        }
    };

    rt.document.getElementById = (id) => nodes.get(id) || null;
    rt.document.querySelector = (sel) => {
        if (sel === '.manual-mode-btn.active') return amountBtn;
        return null;
    };
    rt.document.querySelectorAll = (sel) => {
        if (sel === '.manual-mode-btn') return [amountBtn];
        return [];
    };

    rt.renderManualWeeklyTargetsEditor([
        { week: 1, targetAmount: 3 },
        { week: 2, targetAmount: 3 },
        { week: 3, targetAmount: 2.7 },
        { week: 4, targetAmount: 2.3 },
        { week: 5, targetAmount: 1.5 },
        { week: 6, targetAmount: 0.5 }
    ]);

    assert.equal(nodes.get('manual-weekly-planned-total-value').textContent, '13.0 g');
    assert.equal(nodes.get('manual-weekly-planned-total').classList.contains('hidden'), false);
    assert.match(nodes.get('manual-weekly-targets-list').innerHTML, /oninput="updateManualWeeklyPlannedTotal\(\)"/);
});
