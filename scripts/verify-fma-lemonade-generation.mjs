import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync('mdpro/Apps/fmaviewer/js/image/lemonadeSettings.js', 'utf8');
const source = code.slice(code.indexOf('    window.waitForFmaLemonadeIdle ='), code.indexOf('    function render('));
const base = process.argv.find(arg => arg.startsWith('--base='))?.slice(7) || 'http://localhost:13305/api/v1';
const store = new Map([['ss_openai_compatible_base_url_lemonade', 'http://localhost:13305/api/v1']]);
const scope = vm.createContext({ window: { getFmaLemonadeImageModel: () => 'Flux-2-Klein-4B', getFmaLemonadeBaseUrl: () => base },
  host: () => ({ localStorage: { getItem: key => store.get(key) ?? null } }),
  location: { protocol: 'file:', hostname: '' }, FormData, Blob, Uint8Array, atob, DOMException, AbortSignal, setTimeout, clearTimeout, fetch });
vm.runInContext(source, scope);
const output = 'artifacts/fma-generation';
mkdirSync(output, { recursive: true });
const started = Date.now();
let lastPhase = "";
function logPhase(phase) { if (phase !== lastPhase) { console.log(phase); lastPhase = phase; } }
const edit = process.argv.includes('--edit');
const suffix = (base.includes('5174') ? 'proxy-' : '') + (edit ? 'edit' : 'generation');
try {
  const input = edit ? [{ type: 'image', mime_type: 'image/png', data: readFileSync(output + '/generation.png').toString('base64') }, { type: 'text', text: 'Change her hair to red. Keep her face, identity, black jacket and grey background the same.' }] : [{ type: 'text', text: 'A studio portrait of a woman with straight black hair wearing a black jacket, plain grey background, photographic.' }];
  const result = await scope.window.requestFmaLemonadeImage(input, AbortSignal.timeout(600000), { mode: edit ? 'edit' : 'generate', onPhase: logPhase, onGenerationFallback: notice => console.log(notice) });
  const bytes = Buffer.from(result.src.split(',')[1], 'base64');
  writeFileSync(output + '/' + suffix + '.png', bytes);
  const evidence = { success: true, base, edit, generationFallback: !!result.generationFallback, bytes: bytes.length, seconds: (Date.now() - started) / 1000, model: 'Flux-2-Klein-4B', size: '512x512' };
  writeFileSync(output + '/' + suffix + '-result.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} catch (error) {
  const evidence = { success: false, error: error.message, seconds: (Date.now() - started) / 1000 };
  writeFileSync(output + '/' + suffix + '-result.json', JSON.stringify(evidence, null, 2));
  console.error(JSON.stringify(evidence));
  process.exitCode = 1;
}
