import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMdproScriptMiddleware } from '../src/mdproScriptServer.js';

async function fixture(run) {
  const temp = await mkdtemp(join(tmpdir(), 'mdpro-script-'));
  try {
    const root = join(temp, 'mdpro'); await mkdir(root);
    const source = 'function openSettingsModal(){}; async function load(url){return import(url)}';
    await writeFile(join(root,'app.js'),source);
    await writeFile(join(root,'helper.mjs'),'export const value = 42;');
    await writeFile(join(temp,'outside.js'),'outside private file');
    await run({root,source});
  } finally { await rm(temp,{recursive:true,force:true}); }
}
async function request(middleware,url,method='GET') {
  const headers={}; let body,fallthrough=false;
  const res={statusCode:200,setHeader:(key,value)=>headers[key.toLowerCase()]=value,end:value=>{body=value;}};
  await middleware({url,method},res,()=>{fallthrough=true;});
  return {status:res.statusCode,headers,text:body?.toString(),fallthrough};
}
test('classic MDpro scripts and runtime query versions are served byte for byte',async()=>fixture(async({root,source})=>{
  const middleware=createMdproScriptMiddleware({root});
  const result=await request(middleware,'/mdpro/app.js?meAI=1&v=2');
  assert.equal(result.text,source); assert.equal(result.headers['cache-control'],'no-store');
  assert.match(result.headers['content-type'],/javascript/);
  const head=await request(middleware,'/mdpro/app.js','HEAD');
  assert.equal(head.text,undefined); assert.equal(head.headers['content-length'],Buffer.byteLength(source));
}));
test('nested app bases and native ES module helpers remain supported',async()=>fixture(async({root})=>{
  const middleware=createMdproScriptMiddleware({root,base:'/nested/'});
  assert.equal((await request(middleware,'/nested/mdpro/helper.mjs?import')).text,'export const value = 42;');
  assert.equal((await request(middleware,'/mdpro/app.js')).fallthrough,true);
}));
test('React modules, non-script assets and writes remain with their existing handlers',async()=>fixture(async({root})=>{
  const middleware=createMdproScriptMiddleware({root});
  for(const [url,method] of [['/src/main.jsx','GET'],['/mdpro/index.html','GET'],['/mdpro/app.js','POST']]) assert.equal((await request(middleware,url,method)).fallthrough,true);
}));
test('encoded traversal, malformed paths and missing files cannot return other source files',async()=>fixture(async({root})=>{
  const middleware=createMdproScriptMiddleware({root});
  assert.equal((await request(middleware,'/mdpro/%2e%2e/outside.js')).status,403);
  assert.equal((await request(middleware,'/mdpro/%ZZ.js')).status,400);
  assert.equal((await request(middleware,'/mdpro/missing.js')).status,404);
}));
