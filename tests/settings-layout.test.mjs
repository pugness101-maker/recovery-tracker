import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SETTINGS_SECTION_ORDER = Object.freeze([
    'settingsBackup',
    'settingsAppearance',
    'settingsTaperSuggestions',
    'settingsSubstances',
    'settingsDataHealth',
    'settingsDashboardLayout',
    'settingsContacts',
    'settingsDangerZone'
]);

function readSettingsTabHtml() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const start = html.indexOf('<section id="settings-tab"');
    assert.ok(start >= 0, 'settings-tab section missing');
    const end = html.indexOf('</section>', start);
    assert.ok(end > start, 'settings-tab section not closed');
    return html.slice(start, end);
}

function extractSettingsSectionIds(settingsHtml) {
    const ids = [];
    const re = /data-section="(settings[^"]+)"/g;
    let match;
    while ((match = re.exec(settingsHtml)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

test('Settings tab lists Account & Data first with expected section order', () => {
    const settingsHtml = readSettingsTabHtml();

    assert.equal(
        (settingsHtml.match(/Account &amp; Data/g) || []).length,
        1,
        'Account & Data section must appear exactly once'
    );
    assert.equal(
        (settingsHtml.match(/data-section="settingsBackup"/g) || []).length,
        1,
        'settingsBackup accordion must appear exactly once'
    );

    const sectionIds = extractSettingsSectionIds(settingsHtml);
    assert.deepEqual(
        sectionIds,
        SETTINGS_SECTION_ORDER,
        'Settings sections must follow the canonical order in Simple and Advanced mode'
    );

    const backupIdx = settingsHtml.indexOf('data-section="settingsBackup"');
    const appearanceIdx = settingsHtml.indexOf('data-section="settingsAppearance"');
    const dangerIdx = settingsHtml.indexOf('data-section="settingsDangerZone"');
    assert.ok(backupIdx < appearanceIdx, 'Account & Data must render before Appearance');
    assert.ok(backupIdx < dangerIdx, 'Account & Data must render before Danger Zone');
});
