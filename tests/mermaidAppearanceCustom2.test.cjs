const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const context = { window: {}, Intl };
for (const file of ['appearance-custom.js', 'appearance-custom2.js', 'appearance-types.js', 'appearance-source.js']) vm.runInNewContext(fs.readFileSync('mdpro/js/mermaid/' + file, 'utf8'), context);
const api = context.window.MermaidAppearanceCustom2, source = context.window.MermaidAppearanceSource;
const code = 'xychart-beta\n title "Monthly Revenue"\n x-axis [Jan, Feb, Mar, Apr, May, Jun]\n y-axis "Revenue (USD)" 0 --> 10000\n bar [5000, 6200, 7800, 5500, 8900, 9200]\n line [5000, 6200, 7800, 5500, 8900, 9200]';
const item = { id: 'values-1', label: '매출', series: 0, indices: [0, 2, 5], fontSize: 16, color: null, distance: 8, x: 0, y: 0, position: 'outside', grouping: true, decimals: -1, prefix: '', suffix: '' };
const config = { version: 1, sourceKey: context.window.MermaidAppearanceCustom.sourceKey(code), items: [item] };

test('source values come only from bar arrays, including multiple series, signs, decimals and exponent notation', () => {
    assert.deepEqual([...api.parse(code).series[0].values], [5000, 6200, 7800, 5500, 8900, 9200]);
    assert.equal(api.parse(code).series.length, 1);
    const parsed = api.parse('---\nconfig:\n theme: dark\n---\n%% comment\nxychart-beta horizontal\n line [99]\n bar [-3, 0, .5, 1e2]\n bar [1,2,3,4]');
    assert.equal(parsed.horizontal, true);
    assert.deepEqual([...parsed.series[0].values], [-3, 0, .5, 100]);
    assert.equal(parsed.series.length, 2);
    assert.deepEqual(parsed.series.map(s => s.plot).join(','), '1,2');
    assert.equal(api.parse('flowchart LR\nA[bar 12]').series.length, 0);
    for (const value of ['NaN', 'Infinity', '1e999', '1,', '1+2', '0x10', '']) assert.throws(() => api.parse('xychart-beta\nbar [' + value + ']'));
});

test('numeric labels and existing custom tools roundtrip without modifying handwritten code', () => {
    const custom = { version: 1, sourceKey: config.sourceKey, rules: [{ index: 1, signature: 'rect|bar', style: { fill: '#112233' } }] };
    const saved = source.serialize(code, { custom2: config, custom }, [], 0);
    assert.equal(source.readAppearance(saved).custom2.items[0].indices.length, 3);
    assert.equal(source.readAppearance(saved).custom.rules[0].style.fill, '#112233');
    assert.deepEqual([...api.parse(saved).series[0].values], [...api.parse(code).series[0].values]);
    assert.equal(context.window.MermaidAppearanceCustom.sourceKey(saved), config.sourceKey);
    assert.equal(source.serialize(saved, {}, [], 0), code);
    const again = source.serialize(saved, { custom2: { ...config, items: [{ ...item, fontSize: 28, prefix: '$' }] } }, [], 0);
    assert.equal((again.match(/^%% MDPRO appearance start$/gm) || []).length, 1);
    assert.equal(source.readAppearance(again).custom2.items[0].fontSize, 28);
});

test('custom2 rejects invalid fields, duplicate items/indices, executable colors, excessive labels and malformed metadata', () => {
    for (const patch of [{ fontSize: 121 }, { x: Infinity }, { decimals: 2.5 }, { color: 'url(http://bad)' }, { series: -1 }, { indices: [0, 0] }, { indices: [500] }, { prefix: 'x'.repeat(25) }, { position: 'script' }]) assert.throws(() => api.clean({ ...config, items: [{ ...item, ...patch }] }));
    assert.throws(() => api.clean({ ...config, items: [item, item] }));
    assert.throws(() => api.clean({ ...config, items: [{ ...item, indices: Array.from({ length: 500 }, (_, i) => i) }, { ...item, id: 'second' }] }));
    assert.equal(source.readAppearance('%% MDPRO appearance values ' + JSON.stringify({ custom2: { ...config, items: [{ ...item, color: 'red' }] } })), null);
});

test('display formatting does not alter values and treats prefix/suffix as plain text', () => {
    assert.equal(api.format(5000, item), '5,000');
    assert.equal(api.format(-1234.567, { ...item, grouping: false, decimals: 2, prefix: '$', suffix: ' USD' }), '$-1234.57 USD');
    assert.equal(api.format(0, { ...item, decimals: 2 }), '0.00');
    assert.equal(api.format(20, { ...item, prefix: '<script>', suffix: '%' }), '<script>20%');
});
