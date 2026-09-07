import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function restoreFeatureSettings(settings)');
const restore = source.slice(start, source.indexOf('async function loadAiSettingsToUI()', start));

for (const enabled of [true, false]) {
    test(`saved feature toggles restore with the settings modal closed (${enabled})`, () => {
        const elements = new Map();
        const settings = {};
        const context = {
            document: { getElementById(id) {
                if (!elements.has(id)) elements.set(id, { checked: !enabled });
                return elements.get(id);
            } },
            localStorage: { setItem() {} },
            VIEW_PADDING_KEY: 'padding',
            applyViewPadding() {}, normalizeViewPadding: value => value,
            getViewPaddingFromLocal: () => 0,
            setSelectionWrapEnabledToLocal() {}, setViewModeEditEnabledToLocal() {},
            setGoogleCalendarEnabledToLocal() {}, loadGoogleCalendarOptionsUI() {},
            applyGoogleCalendarVisibility(value) { assert.equal(value, enabled); }
        };
        for (const match of restore.matchAll(/settings\.(\w+)/g)) settings[match[1]] = enabled;
        settings.viewPadding = 12;
        for (const match of restore.matchAll(/\b(get\w+From(?:Settings|Local))\(/g)) {
            if (!(match[1] in context)) context[match[1]] = () => enabled;
        }
        vm.runInNewContext(restore, context);
        context.restoreFeatureSettings(settings);
        assert.ok(elements.size >= 15);
        for (const [id, element] of elements) assert.equal(element.checked, enabled, id);
        assert.equal(context.selectionWrapEnabled, enabled);
        assert.equal(context.viewModeEditEnabled, enabled);
    });
}

test('startup awaits feature restoration before document recovery and optional tools', () => {
    const startup = source.slice(source.indexOf('window.onload = async () => {'));
    const initialization = startup.indexOf('await initAiVisibility();');
    assert.ok(initialization > startup.indexOf('await initDB();'));
    assert.ok(initialization < startup.indexOf('await window.TidyScriptManager.configure('));
    assert.ok(initialization < startup.indexOf('await checkAutoSave();'));
});
