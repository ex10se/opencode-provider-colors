import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {EventController} from '../../src/events.mjs';
import {findInlineProvider} from '../../src/inline.mjs';
import {validateColors} from '../../src/paint.mjs';
import {readObservedState} from '../../src/observer.mjs';
import {createRoot,createComputed,createSignal,untrack} from 'solid-js/dist/solid.js';
class Node extends EventEmitter {constructor(children=[]){super();this.children=children;this.width=90;this.height=2;for(const n of children)n.parent=this;}getChildren(){return this.children;}}
class Leaf{constructor(text){this.children=[text];this.value=undefined;}get fg(){return this.value;}set fg(value){this.value=value;}}
function text(value){const leaf=new Leaf(value),n=new Node();n.height=1;n.width=value.length;n.textNode={children:[leaf],textParent:n};leaf.parent=n.textNode;return n;}
function fixture(){
 const provider=text('Codex Safe'),group=new Node([text('·'),text('Fixture model'),provider]),footer=new Node([new Node([text('Build'),group])]);
 const editor=Object.assign(new Node(),{editorView:{},editBuffer:{},width:80,height:1}),surface=new Node([editor,footer]),root=new Node([surface]);
 const renderer=Object.assign(new EventEmitter(),{root,height:45,width:140,capabilities:{rgb:true}});
 const context={options:{},location:{directory:'/fixture'},app:{version:'2.2.5'},renderer,theme:{background:{raised:{base:'#141414',high:'#1e1e1e'},action:{primary:{selected:'#000000'}}}},ui:{tabs:{list:()=>[]},router:{current:()=>({type:'home'})},model:{current:()=>({providerID:'openai',modelID:'fixture'})}},data:{location:{provider:{list:()=>[{id:'openai',name:'Codex Safe'}]}},session:{get:()=>undefined}}};
 const c=new EventController(context,validateColors({'example-provider':'#EADBFF'})),state={tabs:[],route:{type:'home'},selected:{providerID:'openai',modelID:'fixture'},providerLabel:'Codex Safe'};
 c.counts={discoveries:0,inlineDiscoveries:0,reconciles:0,updates:0,listeners:c.listeners.length};
  return {c,state,context,root,provider,group,surface,footer,editor,leaf:provider.textNode.children[0]};
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
test('unrelated root layout with unchanged bound geometry does not scan rows',async()=>{
 const f=fixture();f.c.update(f.state);await tick();f.c.snapshot={rows:[],mapping:{ok:true}};f.c.rowGeometry=[];const before=f.c.counts.discoveries;
 f.root.emit('layout-changed');await tick();assert.equal(f.c.counts.discoveries,before);f.c.dispose();
});
test('provider-only change rediscovers inline without row DFS or incidental layout events',async()=>{
 const f=fixture();f.c.update(f.state);await tick();assert.equal(f.leaf.fg,'#B8EEE4');const scans=f.c.counts.discoveries;
 f.c.update({...f.state,selected:{providerID:'example-provider',modelID:'fixture'},providerLabel:'Example Provider'});f.leaf.children[0]='Example Provider';await tick();
 assert.equal(f.leaf.fg,'#EADBFF');assert.equal(f.c.counts.discoveries,scans);f.c.dispose();
});
test('destroyed footer anchor replacement at unchanged size restores inline',async()=>{
 const f=fixture();f.c.update(f.state);await tick();const scans=f.c.counts.discoveries;
 const replacement=text('Codex Safe');replacement.parent=f.group;f.group.children[2]=replacement;f.provider.isDestroyed=true;f.provider.emit('destroyed');await tick();
 assert.equal(replacement.textNode.children[0].fg,'#B8EEE4');assert.equal(f.c.counts.discoveries,scans);f.c.dispose();
});
test('does not attempt forbidden nonroot native layout hooks',()=>{
 const f=fixture(),attempts=[],node=new Node();node.on=function(event,fn){attempts.push(event);if(['layout-changed','resized'].includes(event))throw Error('forbidden');return EventEmitter.prototype.on.call(this,event,fn);};
 // Exercise the subscription boundary directly; native node must never see these.
 f.c.watch(node,'layout-changed');f.c.watch(node,'resized');assert.deepEqual(attempts,[]);f.c.dispose();
});
test('inactive saved variant-only mutation triggers observer consumer',()=>{
 createRoot(dispose=>{const f=fixture(),[variant,setVariant]=createSignal('low');const model={providerID:'openai',id:'fixture',get variant(){return variant();}};
 f.context.ui.tabs.list=()=>[{sessionID:'inactive',title:'one'}];f.context.data.session.get=()=>({model,agent:'build'});let captured;
 createComputed(()=>{readObservedState(f.context);captured=untrack(()=>model.variant);});assert.equal(captured,'low');setVariant('high');assert.equal(captured,'high');dispose();f.c.dispose();});
});
test('dispose restores exact undefined foreground and cancels queued work',async()=>{
 const f=fixture();f.c.update(f.state);await tick();assert.equal(f.leaf.fg,'#B8EEE4');f.leaf.fg=undefined;
 f.c.schedule();const before=f.c.counts.discoveries;f.c.dispose();await tick();assert.equal(f.leaf.fg,undefined);assert.equal(Object.hasOwn(f.leaf,'fg'),false);assert.equal(f.c.counts.discoveries,before);assert.equal(f.c.listeners.length,0);
});
test('structurally complete zero-size composer is colored before native layout prepares text',async()=>{
 const f=fixture();f.editor.width=0;f.editor.height=0;f.provider.width=0;f.provider.height=0;f.c.update(f.state);await tick();assert.equal(f.leaf.fg,'#B8EEE4');const scans=f.c.counts.inlineDiscoveries;
 f.provider.width=10;f.provider.height=1;
 f.editor.width=80;f.editor.height=1;f.root.emit('layout-changed');assert.equal(f.leaf.fg,'#B8EEE4');assert.equal(f.c.counts.inlineDiscoveries,scans);f.c.dispose();
});
test('detached nondestroyed cached composer is restored and never reused for same provider',async()=>{
 const f=fixture();f.c.update(f.state);await tick();assert.equal(f.leaf.fg,'#B8EEE4');f.root.children=[];f.surface.parent=undefined;f.c.update(f.state);assert.equal(f.c.inline.anchor(),undefined);assert.equal(f.leaf.fg,undefined);f.c.dispose();
});
test('cached composer removed from parent children is invalid even before parent pointer clears',async()=>{
 const f=fixture();f.c.update(f.state);await tick();f.root.children=[];f.c.update(f.state);assert.equal(f.c.inline.anchor(),undefined);assert.equal(f.leaf.fg,undefined);f.c.dispose();
});
test('pending metadata binds latest provider on layout and cancels stale queued discovery',async()=>{
 const f=fixture();f.group.children.splice(2);f.c.update(f.state);await tick();f.c.snapshot={rows:[],mapping:{ok:true}};f.c.rowGeometry=[];
 f.c.update({...f.state,selected:{providerID:'example-provider',modelID:'fixture'},providerLabel:'Example Provider'});f.leaf.children[0]='Example Provider';f.group.children.push(f.provider);const scans=f.c.counts.inlineDiscoveries,rows=f.c.counts.discoveries;
 f.root.emit('layout-changed');assert.equal(f.leaf.fg,'#EADBFF');await tick();assert.equal(f.c.counts.inlineDiscoveries,scans);assert.equal(f.c.counts.discoveries,rows);f.c.dispose();
});
test('synchronous layout binding tolerates reentrant layout notification and removes pending listeners',async()=>{
 const f=fixture();f.group.children.splice(2);f.c.update(f.state);await tick();f.c.snapshot={rows:[],mapping:{ok:true}};f.c.rowGeometry=[];let value,writes=0;Object.defineProperty(f.leaf,'value',{get:()=>value,set:v=>{value=v;writes++;f.root.emit('layout-changed');}});f.group.children.push(f.provider);
 f.root.emit('layout-changed');assert.equal(value,'#B8EEE4');assert.equal(writes,1);const listeners=[...f.c.inlineListeners];f.c.dispose();assert.equal(value,undefined);assert.ok(listeners.every(x=>!x.node.listeners(x.event).includes(x.fn)));
});
test('unsupported provider never scans the tree even when discovery is requested',()=>{
 const f=fixture();let walks=0;const get=f.root.getChildren;f.root.getChildren=function(){walks++;return get.call(this);};f.c.inline.update(f.root,undefined,undefined,true);assert.equal(walks,0);assert.equal(findInlineProvider(f.root,undefined),undefined);assert.equal(walks,0);f.c.dispose();
});
test('provider registry arrival, name mutation and location changes are tracked before untrack',()=>{
 createRoot(dispose=>{const f=fixture(),[providers,setProviders]=createSignal(undefined),[name,setName]=createSignal('SDK name'),[location,setLocation]=createSignal('one');
 Object.defineProperty(f.context,'location',{get:location});f.context.data.location.provider.list=loc=>loc==='two'?[{id:'openai',name:'Other location'}]:providers();
 let captured,runs=0;createComputed(()=>{const state=readObservedState(f.context);untrack(()=>{captured=state.providerLabel;runs++;});});
 assert.equal(captured,'openai');setProviders([{id:'openai',get name(){return name();}}]);assert.equal(captured,'SDK name');setName('Renamed');assert.equal(captured,'Renamed');setLocation('two');assert.equal(captured,'Other location');
 const before=runs;dispose();setLocation('one');setName('After disposal');assert.equal(runs,before);f.c.dispose();
 });
});
test('provider label uses nullish fallback, preserves empty name and handles missing selection',()=>{
 const f=fixture();for(const [name,expected] of [[undefined,'openai'],[null,'openai'],['',''],['Native name','Native name']]){f.context.data.location.provider.list=()=>[{id:'openai',name}];assert.equal(readObservedState(f.context).providerLabel,expected);}
 f.context.ui.model.current=()=>({providerID:'unknown'});assert.equal(readObservedState(f.context).providerLabel,'unknown');f.context.ui.model.current=()=>undefined;assert.equal(readObservedState(f.context).providerLabel,undefined);f.c.dispose();
});
test('name-only change rebinds without row discovery and never rewrites native text',async()=>{
 const f=fixture();f.c.update(f.state);await tick();const rows=f.c.counts.discoveries,scans=f.c.counts.inlineDiscoveries;
 f.c.update({...f.state,providerLabel:'SDK renamed'});f.leaf.children[0]='SDK renamed';await tick();
 assert.equal(f.leaf.fg,'#B8EEE4');assert.deepEqual(f.leaf.children,['SDK renamed']);assert.equal(f.c.counts.discoveries,rows);assert.ok(f.c.counts.inlineDiscoveries>scans);f.c.dispose();assert.equal(f.leaf.fg,undefined);
});
test('empty SDK name and unknown palette leave inline foreground native',async()=>{
 for(const [providerLabel,providerID] of [['','openai'],['Custom provider','unknown']]){const f=fixture();f.leaf.children[0]=providerLabel;f.c.update({...f.state,providerLabel,selected:{providerID}});await tick();assert.equal(f.leaf.fg,undefined);assert.equal(f.c.inline.anchor(),undefined);f.c.dispose();}
});
test('production controller does not enable counters from options',()=>{
 const f=fixture();f.c.dispose();f.context.options.fixtureHook=true;const controller=new EventController(f.context,validateColors({'example-provider':'#EADBFF'}));assert.equal(controller.counts,undefined);controller.dispose();
});
