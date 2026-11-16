import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {supportsVersion} from '../../src/core.mjs';

test('version gate admits only verified hosts, not adjacent or prerelease versions',()=>{
 for(const version of ['2.2.5','2.2.7'])assert.equal(supportsVersion(version),true);
 for(const version of ['2.2.4','2.2.6','2.2.8','2.2.7-beta','3.0.0',undefined])assert.equal(supportsVersion(version),false);
});

test('production entry and internal factory enforce gates, track SDK names and clean up without globals',()=>{
 // Browser conditions select the same reactive Solid implementation used by
 // the host, rather than the SSR stub. The SDK itself is a type-only dependency.
 const result=spawnSync('bun',['--conditions=browser','--eval',String.raw`
 import assert from 'node:assert/strict';
 import {EventEmitter} from 'node:events';
 import {createRoot,createSignal} from 'solid-js';
 import plugin from './src/tui.ts';
 import {createProviderColors} from './src/runtime.ts';
 assert.equal(plugin.id,'opencode-provider-colors');
 for(const [version,rgb,options] of [['2.2.4',true,{}],['2.2.6',true,{}],['2.2.5',false,{}],['2.2.5',undefined,{}],['2.2.5',true,{providerColors:[]}],['2.2.5',true,{providerRowOpacity:{inactive:2}}]]){
  const context={app:{version},options,renderer:{capabilities:{rgb},get root(){throw Error('allocated listeners before validation');}},get ui(){throw Error('allocated slot before validation');}};
  assert.equal(createProviderColors(context),undefined);assert.equal(plugin.setup(context),undefined);
 }
 const globals=Reflect.ownKeys(globalThis);
 let removed=0,slots=0,disposeOwner;
 const root=Object.assign(new EventEmitter(),{getChildren:()=>[],width:80,height:24});
 const renderer=Object.assign(new EventEmitter(),{root,capabilities:{rgb:true}});
 const [name,setName]=createSignal('SDK provider'),[location,setLocation]=createSignal('one');
 const context={app:{version:'2.2.5'},options:{},renderer,get location(){return location();},
  theme:{background:{raised:{base:'#141414',high:'#1e1e1e'},action:{primary:{selected:'#000000'}}}},
  data:{session:{get:()=>undefined},location:{provider:{list:loc=>[{id:'openai',name:loc==='one'?name():'Another location'}]}}},
  ui:{tabs:{list:()=>[]},router:{current:()=>({type:'home'})},model:{current:()=>({providerID:'openai',modelID:'fixture'})},
   slot({append,render}){assert.equal(append,'app');slots++;createRoot(dispose=>{disposeOwner=dispose;assert.equal(render(),null);});return()=>{removed++;disposeOwner();};}}};
 const runtime=createProviderColors(context);assert.ok(runtime);assert.equal(runtime.controller.state.providerLabel,'SDK provider');
 assert.equal(runtime.controller.counts,undefined);setName('Renamed provider');assert.equal(runtime.controller.state.providerLabel,'Renamed provider');
 setLocation('two');assert.equal(runtime.controller.state.providerLabel,'Another location');
 runtime.dispose();assert.equal(removed,1);assert.equal(runtime.controller.disposed,true);assert.equal(root.eventNames().length,0);assert.equal(renderer.eventNames().length,0);
 const state=runtime.controller.state;setName('After disposal');setLocation('one');assert.equal(runtime.controller.state,state);
  context.app.version='2.2.7';
  const cleanup=plugin.setup(context);assert.equal(typeof cleanup,'function');cleanup();assert.equal(slots,2);assert.equal(removed,2);
 await Promise.resolve();assert.equal(root.eventNames().length,0);assert.equal(renderer.eventNames().length,0);assert.deepEqual(Reflect.ownKeys(globalThis),globals);
 console.log('runtime-contract-ok');
 `],{cwd:new URL('../..',import.meta.url),encoding:'utf8',timeout:30000});
 assert.ifError(result.error);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/runtime-contract-ok/);
});
