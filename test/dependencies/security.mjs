import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {Minimatch} from 'minimatch';
import {glob,globStream,globStreamSync,globSync} from 'glob';
const mode=process.argv[2];
if(mode==='preprocess'){
 const pattern=Array(10).fill('**/../a/b').join('/');
 const bounded=new Minimatch(pattern,{optimizationLevel:2,braceExpandMax:64});
 const small=new Minimatch('**/../a/b/**/../c/d',{optimizationLevel:2});
 const large=new Minimatch('{x,*}/{0..999}',{optimizationLevel:2});
 const result={bounded:bounded.set.length,small:small.set.length,smallMatch:small.match('x/a/b/y/c/d'),large:large.set.length,matches:['x/5','y/999','.y/5'].map(p=>large.match(p))};
  {
  assert.equal(bounded.set.length,64);assert.equal(large.set.length,2000);
  assert.equal(new Minimatch(Array(30).fill('**/../a/b').join('/'),{optimizationLevel:2,braceExpandMax:64}).set.length,64);
 }
 assert.equal(small.set.length,4);assert.equal(result.smallMatch,true);assert.deepEqual(result.matches,[true,true,false]);console.log(JSON.stringify(result));
}else if(mode==='abort'){
  const cwd=fs.mkdtempSync(path.join(tmpdir(),'provider-colors-abort-'));
  process.on('exit',()=>fs.rmSync(cwd,{recursive:true,force:true}));
 const mk=(dir,n)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'f'),'');if(n){mk(path.join(dir,'a'),n-1);mk(path.join(dir,'b'),n-1);}};mk(cwd,5);
 const counted=ac=>{let calls=0;const tick=()=>{if(++calls===1)ac.abort(new Error('audit abort'));};return {count:()=>calls,cfs:{...fs,readdir(...args){tick();return fs.readdir(...args);},readdirSync(...args){tick();return fs.readdirSync(...args);}}};};
 const ac=new AbortController();const c=counted(ac);let rejected=false;try{await glob('**',{cwd,signal:ac.signal,fs:c.cfs});}catch(e){rejected=e.message==='audit abort';}const atReject=c.count();await new Promise(r=>setTimeout(r,150));const later=c.count();
 const ac2=new AbortController();const c2=counted(ac2);let errors=0;const stream=globStreamSync('**',{cwd,signal:ac2.signal,fs:c2.cfs});stream.on('error',()=>{errors++;});stream.resume();await new Promise(r=>setTimeout(r,100));
 const paused=globStream('**',{cwd});await new Promise(r=>setTimeout(r,50));const values=await Array.fromAsync(paused);assert.deepEqual(values.sort(),globSync('**',{cwd}).sort());
 const result={rejected,atReject,later,syncCalls:c2.count(),syncErrors:errors,pausedResumed:values.length};
  assert.ok(rejected);assert.equal(atReject,1);assert.equal(atReject,later);assert.equal(c2.count(),1);assert.equal(errors,1);
 console.log(JSON.stringify(result));
}
