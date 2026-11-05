import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForExportStep} from '../mdpro/rHwp/export-task.mjs';
test('hung export read times out and a subsequent step succeeds',async()=>{
    await assert.rejects(waitForExportStep(new Promise(()=>{}),{timeoutMs:10,label:'이미지 읽기'}),/이미지 읽기.*지연/);
    assert.equal(await waitForExportStep(Promise.resolve('retry'),{timeoutMs:100}), 'retry');
});
test('cancel rejects immediately and late source completion cannot finish the step',async()=>{
    const controller=new AbortController();let finish;
    const source=new Promise(resolve=>{finish=resolve;});
    const pending=waitForExportStep(source,{signal:controller.signal,timeoutMs:1000});
    controller.abort(new DOMException('cancel','AbortError'));
    await assert.rejects(pending,error=>error.name==='AbortError');
    finish('late result');
    await assert.rejects(waitForExportStep(Promise.resolve(),{signal:controller.signal}),error=>error.name==='AbortError');
});
