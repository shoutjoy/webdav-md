// Run the actual AI Jena image transport against local Lemonade using a synthetic test image.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: node scripts/verify-flux9b-edit.mjs input.png output.png');
const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const scope = vm.createContext({ FormData, Blob, Uint8Array, atob, fetch,
    getLemonadeImageSettings: () => ({ width: 512, height: 512, steps: 4, cfgScale: 1, seed: -1 }),
    openAICompatibleRequestUrl: (_connection, path) => 'http://localhost:13305/api/v1/' + path,
    readOpenAICompatibleError: async response => JSON.stringify(await response.json())
});
vm.runInContext(app.slice(app.indexOf('async function generateLemonadeImage('), app.indexOf('function lemonadeImageSizeForRatio(')), scope);
const started = Date.now();
const result = await scope.generateLemonadeImage({apiKey:'lemonade', imageSize:'512x512', imageSteps:4, imageCfgScale:1}, 'Flux-2-Klein-9B-GGUF', [
    {role:'user', content:'Change the red ceramic cup to blue. Keep the cup shape, handle, table, camera angle and background unchanged.', attachments:[
        {kind:'image', name:'test-cup.png', dataUrl:'data:image/png;base64,' + readFileSync(inputPath).toString('base64')}
    ]}
], AbortSignal.timeout(900000));
writeFileSync(outputPath, Buffer.from(result.images[0].data, 'base64'));
console.log(JSON.stringify({model:result.model, images:result.images.length, seconds:Math.round((Date.now()-started)/1000), output:outputPath}));
