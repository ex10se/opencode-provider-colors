import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'../..');
const lock=JSON.parse(readFileSync(path.join(root,'package-lock.json'),'utf8'));
for(const [name,version] of [['glob','14.0.3'],['minimatch','11.0.4'],['@opencode/plugin','2.2.5']]) {
  const entries=Object.entries(lock.packages).filter(([key])=>key.endsWith('/node_modules/'+name)||key==='node_modules/'+name);
  assert.ok(entries.length>0,name);
  for(const [key,entry] of entries) {
    assert.equal(entry.version,version,key);
    assert.equal(JSON.parse(readFileSync(path.join(root,key,'package.json'),'utf8')).version,version,key);
  }
}
console.log('Dependency graph: glob14.0.3/minimatch11.0.4/plugin2.2.5 verified');
const temporary=mkdtempSync(path.join(tmpdir(),'provider-colors-dependencies-'));
try {
  for(const [file,args,timeout,heap] of [
    ['consumers.mjs',[],30000,256],
    ['security.mjs',['preprocess'],3000,128],
    ['security.mjs',['abort'],3000,128],
  ]) {
    const result=spawnSync(process.execPath,[`--max-old-space-size=${heap}`,path.join(import.meta.dirname,file),...args],{
      cwd:root,encoding:'utf8',timeout,killSignal:'SIGKILL',maxBuffer:1024*1024,
      env:{PATH:process.env.PATH,TMPDIR:temporary,TMP:temporary,TEMP:temporary},
    });
    process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
    assert.equal(result.status,0,`${file} ${args.join(' ')}: ${result.error?.code??result.signal??'failed'}`);
  }
  console.log('PASS: 13 consumer groups and 2 bounded security cases (no build/plugin tests executed here)');
} finally {
  rmSync(temporary,{recursive:true,force:true});
}
