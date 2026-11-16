import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
const req=createRequire(import.meta.url);
const lane=path.resolve(import.meta.dirname,'../..');
const fixture=fs.mkdtempSync(path.join(tmpdir(),'provider-colors-consumers-'));
process.on('exit',()=>fs.rmSync(fixture,{recursive:true,force:true}));
const results={};
const write=(p,value='x')=>{const dest=path.join(fixture,p);assert.ok(dest.startsWith(fixture+path.sep));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value);};
const json=(p,v)=>write(p,JSON.stringify(v));
const sorted=a=>[...a].sort();
const relative=a=>sorted(a.map(p=>path.relative(fixture,p).split(path.sep).join('/')));
async function check(name,fn){try{results[name]={ok:true,value:await fn()};}catch(e){results[name]={ok:false,error:String(e.stack)};}}
const g=await import('glob');const mm=await import('minimatch');
await check('esm-cjs-consumer-exports',()=>{
 for(const m of [g,req('glob')])for(const n of ['glob','globSync','globIterate','globIterateSync','globStream','globStreamSync','Glob'])assert.equal(typeof m[n],'function',n);
 for(const m of [mm,req('minimatch')]){assert.equal(typeof m.minimatch,'function');assert.equal(typeof m.minimatch.match,'function');assert.equal(typeof m.Minimatch,'function');}
 return 'all used exports present';
});
for(const p of ['src/main.ts','src/deep/util.ts','src/deep/util.js','src/.hidden.ts','.root.ts','ignored/no.ts','readme.md'])write(p);
const opts={cwd:fixture,dot:true,nodir:true,ignore:['ignored/**']};
await check('glob-sync-async-iterate-stream',async()=>{
 const expected=['.root.ts','src/.hidden.ts','src/deep/util.ts','src/main.ts'];
 const values=[await g.glob('**/*.ts',opts),g.globSync('**/*.ts',opts),[...g.globIterateSync('**/*.ts',opts)],await Array.fromAsync(g.globIterate('**/*.ts',opts)),await Array.fromAsync(g.globStream('**/*.ts',opts)),await Array.fromAsync(g.globStreamSync('**/*.ts',opts))];
 for(const v of values)assert.deepEqual(sorted(v),expected);
 return values.map(sorted);
});
await check('glob-options-consumers',async()=>{
 const value={array:sorted(await g.glob(['src/**/*.ts','readme.md'],{cwd:fixture,nodir:true})),absolute:relative(await g.glob('src/**/*.ts',{...opts,absolute:true,follow:false})),withTypes:(await g.glob('src/**/*.ts',{...opts,withFileTypes:true})).map(p=>p.name).sort()};
  assert.deepEqual(value.array,['readme.md','src/deep/util.ts','src/main.ts']);
  assert.deepEqual(value.absolute,['src/.hidden.ts','src/deep/util.ts','src/main.ts']);
  assert.deepEqual(value.withTypes,['.hidden.ts','main.ts','util.ts']);
  write('symlinks/target/nested/file.txt');fs.mkdirSync(path.join(fixture,'symlinks/scan'));
  fs.symlinkSync(path.join(fixture,'symlinks/target'),path.join(fixture,'symlinks/scan/link'),process.platform==='win32'?'junction':'dir');
  const cwd=path.join(fixture,'symlinks/scan');
  assert.deepEqual(await g.glob('**/*.txt',{cwd,follow:false}),[]);
  assert.deepEqual(await g.glob('**/*.txt',{cwd,follow:true}),['link/nested/file.txt']);
  return value;
});
await check('minimatch-consumer-options',()=>{
 const paths=['src/main.ts','src/deep/util.ts','src/.hidden.ts','src/test.js','.root.ts'];
 const ignoreRule=new mm.Minimatch('!*.ts',{matchBase:true,dot:true,flipNegate:true,nocase:true});
 const value={match:mm.minimatch.match(paths,'**/*.ts'),dot:mm.match(paths,'**/*.ts',{dot:true}),ignoreRule:paths.map(p=>ignoreRule.match(p)),partial:mm.minimatch('packages','packages/*',{partial:true,windowsPathsNoEscape:true}),winPattern:mm.minimatch('src/deep/util.ts','src\\**\\*.ts',{windowsPathsNoEscape:true}),normalized:mm.minimatch('C:\\work\\src\\a.ts'.replace(/\\+/g,'/'),'C:/work/**/*.ts',{platform:'win32'}),braces:mm.match(paths,'src/**/*.{ts,js}')};
  assert.equal(value.partial,true);assert.equal(value.winPattern,true);assert.equal(value.normalized,true);
  assert.deepEqual(value.match,['src/main.ts','src/deep/util.ts']);
  assert.deepEqual(value.dot,['src/main.ts','src/deep/util.ts','src/.hidden.ts','.root.ts']);
  assert.deepEqual(value.ignoreRule,[true,true,true,false,true]);
  assert.deepEqual(value.braces,['src/main.ts','src/deep/util.ts','src/test.js']);return value;
});
const pkg={name:'fixture-root',version:'1.0.0',workspaces:['packages/*','!packages/excluded']};json('package.json',pkg);
for(const [dir,name] of [['packages/a','a'],['packages/b','b'],['packages/excluded','excluded'],['packages/.dot','dot'],['packages/a/node_modules/hidden','hidden']])json(`${dir}/package.json`,{name,version:'1.0.0'});
await check('map-workspaces-real-and-virtual',async()=>{
 const map=req('@npmcli/map-workspaces');const actual=await map({cwd:fixture,pkg});
 const packages={'':pkg};for(const [dir,name]of [['packages/a','a'],['packages/b','b'],['packages/excluded','excluded']])packages[dir]={name,version:'1.0.0'};
 const virtual=map.virtual({cwd:fixture,lockfile:{packages}});
 assert.deepEqual([...actual.keys()],['a','b']);assert.deepEqual([...virtual.keys()],['a','b']);return {actual:[...actual.keys()],virtual:[...virtual.keys()]};
});
await check('opencode-util-glob',async()=>{
 const util=import.meta.resolve('@opencode/util/glob');assert.ok(util.startsWith(pathToFileURL(lane+'/node_modules/').href));
 const {Glob}=await import(util);
  const scan=sorted(await Glob.scan('**/*.ts',opts));assert.deepEqual(scan,['.root.ts','src/.hidden.ts','src/deep/util.ts','src/main.ts']);const match=Glob.match('**/*.ts','src/.hidden.ts');assert.equal(match,true);return {scan,match};
});
await check('package-json-normalize-glob-steps',async()=>{
 const base=path.join(fixture,'normalize');json('normalize/package.json',{name:'normalize',version:'1.0.0',directories:{bin:'bin',man:'man'}});
 write('normalize/bin/cli.js');write('normalize/man/cli.1');write('normalize/README.md','fixture readme');write('normalize/binding.gyp','{}');
 const p=await req('@npmcli/package-json').load(base);await p.normalize({steps:['binDir','mans','readme','gypfile']});
  const {bin,man,readme,gypfile,scripts}=p.content;assert.equal(scripts.install,'node-gyp rebuild');assert.equal(readme,'fixture readme');assert.ok(man.includes('man/cli.1'));assert.deepEqual(bin,{'cli.js':'bin/cli.js'});assert.equal(gypfile,true);return {bin,man,readme,gypfile,scripts};
});
await check('tuf-delegated-role',()=>{
 const {DelegatedRole}=req(path.join(path.dirname(req.resolve('@tufjs/models')),'role.js'));const role=new DelegatedRole({keyIDs:['x'],threshold:1,name:'test',terminating:false,paths:['packages/*.tgz']});
 const value=['packages/a.tgz','packages/a/b.tgz','packages/.hidden.tgz','packages/a.zip'].map(p=>role.isDelegatedPath(p));assert.deepEqual(value,[true,false,false,false]);return value;
});
await check('ignore-walk-negations-dotfiles',async()=>{
 write('walk/.npmignore','*.log\n!keep.log\nnested/ignored/**\n');for(const p of ['a.log','keep.log','.dot','nested/main.ts','nested/ignored/a.ts'])write('walk/'+p);
 const files=await req('ignore-walk')({path:path.join(fixture,'walk'),ignoreFiles:['.npmignore']});assert.ok(files.includes('keep.log'));assert.ok(!files.includes('a.log'));assert.ok(!files.includes('nested/ignored/a.ts'));assert.ok(files.includes('.dot'));return sorted(files);
});
await check('arborist-path-selector',async()=>{
 const base=path.join(fixture,'tree');json('tree/package.json',{name:'tree',version:'1.0.0',dependencies:{foo:'1.0.0',bar:'1.0.0'}});for(const name of ['foo','bar'])json(`tree/node_modules/${name}/package.json`,{name,version:'1.0.0'});
 const tree=await new (req('@npmcli/arborist'))({path:base}).loadActual();const hits=await tree.querySelectorAll(':path(node_modules/f*)');assert.deepEqual(hits.map(n=>n.name),['foo']);return hits.map(n=>n.name);
});
await check('cacache-put-get-verify-rm-and-win-normalize',async()=>{
 const cache=path.join(fixture,'cache');const c=req('cacache');await c.put(cache,'key','test payload');assert.equal((await c.get(cache,'key')).data.toString(),'test payload');const stats=await c.verify(cache);assert.equal(stats.verifiedContent,1);
 const cg=req(path.join(path.dirname(req.resolve('cacache')),'util/glob.js'));const matched=relative(await cg(path.join(fixture,'src/**/*.ts').replaceAll('/','\\'),{nodir:true}));assert.deepEqual(matched,['src/deep/util.ts','src/main.ts']);await c.rm.all(cache);assert.deepEqual(Object.keys(await c.ls(cache)),[]);return {verifiedContent:stats.verifiedContent,matched};
});
await check('pacote-local-tarball-extract-packlist',async()=>{
 json('pack-source/package.json',{name:'packed-fixture',version:'1.0.0'});write('pack-source/.npmignore','*.log\n!keep.log\n');for(const f of ['index.js','drop.log','keep.log','nested/a.js','.dot'])write('pack-source/'+f);
 const pacote=req('pacote');const dest=path.join(fixture,'pack-extract');const tar=await pacote.tarball(path.join(fixture,'pack-source'),{Arborist:req('@npmcli/arborist'),ignoreScripts:true,cache:path.join(fixture,'pacote-cache')});write('local.tgz',tar);await pacote.extract(path.join(fixture,'local.tgz'),dest,{ignoreScripts:true,cache:path.join(fixture,'pacote-cache')});const files=sorted(await g.glob('**',{cwd:dest,nodir:true,dot:true}));assert.ok(files.includes('keep.log'));assert.ok(!files.includes('drop.log'));assert.ok(files.includes('nested/a.js'));return files;
});
await check('rimraf5-glob-true-sync-async',async()=>{
 const rr=req('rimraf');const base=path.join(fixture,'delete-owned');for(const f of ['a.tmp','b.tmp','keep.txt','nested/c.tmp'])write('delete-owned/'+f);
  assert.ok(fs.realpathSync(base).startsWith(fs.realpathSync(fixture)+path.sep));
  await rr.rimraf(path.join(base,'*.tmp').split(path.sep).join('/'),{glob:true});assert.equal(fs.existsSync(path.join(base,'a.tmp')),false);assert.equal(fs.existsSync(path.join(base,'keep.txt')),true);rr.rimrafSync(path.join(base,'**/*.tmp').split(path.sep).join('/'),{glob:true});
  const remaining=sorted(await g.glob('**',{cwd:base,nodir:true}));assert.deepEqual(remaining,['keep.txt']);return remaining;
});
assert.equal(Object.keys(results).length,13);
console.log(JSON.stringify(results,null,2));process.exitCode=Object.values(results).every(x=>x.ok)?0:1;
