// Exercise the actual WebDAV Jena transport without changing server model options.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const base = process.env.LEMONADE_BASE_URL || 'http://localhost:13305/api/v1';
const output = resolve(process.argv[2] || 'artifacts/lemonade-image-quality');
mkdirSync(output, { recursive: true });
const health = await fetch(base + '/health').then(response => response.json());
const loaded = health.all_models_loaded?.find(model => model.type === 'image' && !model.is_busy);
if (!loaded) throw new Error('Load an idle image model first. This script does not load or reconfigure models.');
const model = loaded.model_name;
const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const store = new Map();
const requests = [];
const scope = vm.createContext({ FormData, Blob, Uint8Array, atob,
  LEMONADE_DEFAULT_MODEL: model,
  localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
  findCachedLemonadeModel: () => ({ image_defaults: loaded.recipe_options }),
  openAICompatibleRequestUrl: (_, path) => base + '/' + path,
  openAICompatibleHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer lemonade' }),
  readOpenAICompatibleError: response => response.text(),
  fetch: async (url, request) => {
    requests.push({ endpoint: url, parameters: request.body instanceof FormData
      ? Object.fromEntries([...request.body].filter(([key]) => key !== 'image'))
      : JSON.parse(request.body) });
    return fetch(url, request);
  }
});
vm.runInContext(app.slice(app.indexOf('function getLemonadeImageSettings('), app.indexOf('function lemonadeImageSizeForRatio(')), scope);
const results = [];
for (const size of [256, 1024, 512]) {
  const edit = size === 512;
  if (edit && !existsSync(resolve(output, '256.png'))) { results.push({ size, edit, skipped: 'No successful source PNG for edit' }); continue; }
  scope.saveLemonadeImageSettings(model, { width: size, height: size, steps: 4, cfgScale: 1, seed: 42 });
  const started = Date.now();
  console.log(`Starting ${edit ? 'edit' : 'generation'} ${size}x${size} with ${model}`);
  try {
    const result = await scope.generateLemonadeImage({ apiKey: 'lemonade' }, model, [{ role: 'user',
      content: edit ? 'Change the white cup to blue. Preserve the cup shape, linen, spoon and camera angle.'
        : 'A white ceramic coffee cup on natural linen beside a stainless steel spoon. Sharp focus across the entire scene, detailed linen weave, neutral daylight, realistic photograph.',
      attachments: edit ? [{ kind: 'image', name: 'cup.png', dataUrl: 'data:image/png;base64,' + readFileSync(resolve(output, '256.png')).toString('base64') }] : []
    }], AbortSignal.timeout(900000));
    const bytes = Buffer.from(result.images[0].data, 'base64');
    const file = `${edit ? 'edit-' : ''}${size}.png`;
    writeFileSync(resolve(output, file), bytes);
    const dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (dimensions.width !== size || dimensions.height !== size) throw new Error('Returned PNG dimensions differ from requested size');
    results.push({ file, ...dimensions, seconds: Math.round((Date.now() - started) / 1000), imageSettings: result.imageSettings });
    console.log(JSON.stringify(results.at(-1)));
  } catch (error) {
    results.push({ size, edit, error: String(error), seconds: Math.round((Date.now() - started) / 1000) });
    process.exitCode = 1;
    console.error(String(error));
  } finally {
    writeFileSync(resolve(output, 'comparison.json'), JSON.stringify({ model, serverVersion: health.version, recipeOptionsBefore: loaded.recipe_options, requests, results }, null, 2));
  }
}
const after = await fetch(base + '/health').then(response => response.json());
const optionsAfter = after.all_models_loaded?.find(item => item.model_name === model)?.recipe_options;
const evidence = JSON.parse(readFileSync(resolve(output, 'comparison.json'), 'utf8'));
evidence.recipeOptionsAfter = optionsAfter;
evidence.recipeOptionsPreserved = JSON.stringify(loaded.recipe_options) === JSON.stringify(optionsAfter);
writeFileSync(resolve(output, 'comparison.json'), JSON.stringify(evidence, null, 2));
