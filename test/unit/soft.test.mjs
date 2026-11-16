import test from 'node:test';
import assert from 'node:assert/strict';
import {OrdinaryRows} from '../../src/ordinary.mjs';
import * as paint from '../../src/paint.mjs';
import {EventController} from '../../src/events.mjs';
import {normalizeRGBA} from '../../src/core.mjs';
const transparent={r:0,g:0,b:0,a:0,intent:'rgb',slot:0};
class Box {constructor(color='#4F4F4F'){this.value=color;}get backgroundColor(){return this.value;}set backgroundColor(v){this.value=v;}}
function fixture(options={}){
 const panel=new Box();Object.assign(panel,{width:42,height:45,screenX:0});
 const node=new Box();Object.assign(node,{parent:{parent:{parent:panel}},width:42,screenX:0});
 const session={model:{providerID:'openai',id:'saved'},agent:'build'},tab={sessionID:'a',title:'A',active:false,busy:false,attention:false,unread:false};
 const snapshot={rows:[{node,title:'A'}],mapping:{ok:true},bindings:{get:()=> 'a'}};
 const context={options,app:{version:'2.2.5'},renderer:{height:45,capabilities:{rgb:true}},theme:{background:{raised:{base:'#4F4F4F',high:'#5F5F5F'},action:{primary:{selected:transparent}}}},ui:{tabs:{list:()=>[tab]},router:{current:()=>({type:'session',sessionID:'a'})}},data:{session:{get:()=>session}}};
 const c=new OrdinaryRows(context,paint.validateColors({'example-provider':'#EADBFF'}),()=>snapshot);
 return {c,node,panel,session,tab,context,snapshot};
}
test('shared custom palette drives inline foreground instead of independent provider literals',()=>{
 const c={colors:paint.validateColors({openai:'#ABCDEF'}),state:{selected:{providerID:'openai'}},context:{renderer:{capabilities:{rgb:true}}}};
 assert.equal(EventController.prototype.fg.call(c),'#ABCDEF');c.state.selected.providerID='unknown';assert.equal(EventController.prototype.fg.call(c),undefined);
});
test('idle active and hover use the approved base with independent native source, never previous blend',()=>{
 const f=fixture();f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');
 for(let i=0;i<10;i++)f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');
 f.node.backgroundColor='#5F5F5F';assert.equal(f.node.backgroundColor,'#606060');
 f.node.backgroundColor='#4F4F4F';assert.equal(f.node.backgroundColor,'#5A5F5E');
 f.tab.active=true;f.node.backgroundColor=transparent;f.c.update();assert.equal(f.node.backgroundColor,'#545756');
 f.node.backgroundColor='#5F5F5F';assert.equal(f.node.backgroundColor,'#5F6060');
 f.node.backgroundColor=transparent;f.c.dispose();assert.equal(f.node.backgroundColor,transparent);assert.equal(Object.hasOwn(f.node,'backgroundColor'),false);
});
test('custom provider same base is blended at each state and updates on saved provider changes',()=>{
 const f=fixture();f.c.update();f.session.model={providerID:'example-provider',id:'new'};f.c.update();assert.equal(f.node.backgroundColor,'#5F5D61');
 f.tab.active=true;f.node.backgroundColor=transparent;f.c.update();assert.equal(f.node.backgroundColor,'#575658');f.node.backgroundColor='#5F5F5F';assert.equal(f.node.backgroundColor,'#606060');f.c.dispose();
});
test('changing theme recomputes from actual new native inherited surface',()=>{
 const f=fixture();f.tab.active=true;f.node.backgroundColor=transparent;f.c.update();assert.equal(f.node.backgroundColor,'#545756');
 f.context.theme.background.raised.base='#303030';f.panel.backgroundColor='#303030';f.c.update();assert.equal(f.node.backgroundColor,'#373A39');f.c.dispose();
});
test('status priority and unknown provider return untouched native surface then soft color',()=>{
 const f=fixture();f.c.update();
  for(const key of ['attention']){f.tab[key]=true;f.c.update();assert.equal(f.node.backgroundColor,'#4F4F4F');f.tab[key]=false;f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');}
 f.c.observe('a',{providerID:'unknown',modelID:'draft'});f.c.update();assert.equal(f.node.backgroundColor,'#4F4F4F');f.c.dispose();
});
test('unsupported RGB and partial alpha fail closed without guessing native colors',()=>{
 const f=fixture();f.context.renderer.capabilities.rgb=false;f.c.update();assert.equal(f.node.backgroundColor,'#4F4F4F');assert.equal(Object.hasOwn(f.node,'backgroundColor'),false);
 f.context.renderer.capabilities.rgb=true;f.c.update();const partial={...transparent,a:128/255};f.node.backgroundColor=partial;assert.equal(f.node.backgroundColor,partial);f.c.dispose();
});
test('opacity rejects coercion, unknown keys and nonfinite/out-of-range values',()=>{
 for(const invalid of [null,[],{active:'0.05'},{active:NaN},{active:Infinity},{inactive:-1},{hoverMultiplier:1.01},{typo:.1}])assert.throws(()=>fixture({providerRowOpacity:invalid}));
 const f=fixture({providerRowOpacity:{inactive:0,active:1,hoverMultiplier:0}});f.c.update();assert.equal(f.node.backgroundColor,'#4F4F4F');f.tab.active=true;f.node.backgroundColor=transparent;f.c.update();assert.equal(f.node.backgroundColor,'#B8EEE4');f.c.dispose();
});
test('unsupported foreground capability remains native even when palette is known',()=>{
 const c={colors:paint.validateColors({'example-provider':'#EADBFF'}),state:{selected:{providerID:'openai'}},context:{renderer:{capabilities:{rgb:false}}}};
 assert.equal(EventController.prototype.fg.call(c),undefined);
});
test('active question keeps five-percent row tint including cooccurring busy, with native unknown surfaces',()=>{
 const f=fixture();f.tab.active=true;f.tab.attention=true;f.node.backgroundColor=transparent;f.c.update();
 assert.equal(f.node.backgroundColor,'#545756');
 f.tab.busy=true;f.c.update();assert.equal(f.node.backgroundColor,'#545756');
 f.node.backgroundColor='#5F5F5F';assert.equal(f.node.backgroundColor,'#5F6060');
 f.node.backgroundColor='#987654';assert.equal(f.node.backgroundColor,'#987654');
 f.node.backgroundColor=transparent;f.tab.attention=false;f.tab.busy=false;f.c.update();assert.equal(f.node.backgroundColor,'#545756');
 f.c.dispose();assert.equal(f.node.backgroundColor,transparent);assert.equal(Object.hasOwn(f.node,'backgroundColor'),false);
});
class NativeColor {
 constructor(r,g,b,a=255){this.buffer=new Uint8Array([r,g,b,a]);}
 static fromInts(...v){return new NativeColor(...v);}
 get r(){return this.buffer[0]/255;}get g(){return this.buffer[1]/255;}get b(){return this.buffer[2]/255;}get a(){return this.buffer[3]/255;}get intent(){return 'rgb';}get slot(){return 0;}
 equals(v){return v instanceof NativeColor&&this.buffer.every((n,i)=>n===v.buffer[i]);}
}
class Pulse {
 constructor(parent){Object.assign(this,{parent,_edge:undefined,screenX:0,screenY:parent.screenY,width:42,height:1,visible:true,_backgroundColor:new NativeColor(79,79,79),inner:{advance(){},glowLevel:1},outer:{advance(){}}});}
 set backgroundColor(v){if(!v.equals(this._backgroundColor))this._backgroundColor=v;}
 renderSelf(){}
}
function pulseFixture(){
 const f=fixture();Object.assign(f.node,{height:2,screenY:3,visible:true});const containers=[3,4].map(screenY=>({parent:f.node,screenX:0,screenY,width:42,height:1,visible:true}));
 const pulses=containers.map(p=>new Pulse(p));containers.forEach((p,i)=>p.getChildren=()=>[pulses[i]]);const marker={parent:f.node,height:1,width:1,visible:false};f.node.getChildren=()=>[marker,...containers];
 f.tab.active=true;f.tab.attention=true;f.node.backgroundColor=transparent;return {...f,pulses,containers};
}
test('internal attention bases tint independently and restore the latest native setter value',()=>{
 const f=pulseFixture();f.c.update();for(const p of f.pulses)assert.deepEqual(normalizeRGBA(p._backgroundColor).slice(0,3),[84,87,86]);
 f.tab.busy=true;f.c.update();for(const p of f.pulses)assert.deepEqual(normalizeRGBA(p._backgroundColor).slice(0,3),[84,87,86]);
 for(let i=0;i<5;i++)f.c.update();assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[84,87,86]);
 const hover=new NativeColor(95,95,95);f.pulses[0].backgroundColor=hover;assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[95,96,96]);
 f.tab.active=false;f.c.update();assert.equal(f.pulses[0]._backgroundColor,hover);assert.deepEqual(normalizeRGBA(f.pulses[1]._backgroundColor).slice(0,3),[79,79,79]);
 f.tab.active=true;f.c.update();f.c.dispose();assert.equal(f.pulses[0]._backgroundColor,hover);assert.ok(f.pulses.every(p=>!Object.hasOwn(p,'backgroundColor')));
});
test('internal pulse ownership and pair geometry fail closed without touching edge pulses',()=>{
 const f=pulseFixture();f.pulses[1]._edge='above';f.c.update();assert.ok(f.pulses.every(p=>!Object.hasOwn(p,'backgroundColor')));f.c.dispose();
 const g=pulseFixture();g.c.update();const foreign=()=>{};Object.defineProperty(g.pulses[0],'backgroundColor',{configurable:true,set:foreign});g.c.update();g.c.dispose();assert.equal(Object.getOwnPropertyDescriptor(g.pulses[0],'backgroundColor').set,foreign);
 const h=pulseFixture();h.c.update();h.containers[0].parent={};h.c.update();assert.deepEqual(normalizeRGBA(h.pulses[0]._backgroundColor).slice(0,3),[79,79,79]);h.c.dispose();
});
test('replaced prototype setter is not masked and added internal pulses fail closed',()=>{
 const f=pulseFixture(),original=Object.getOwnPropertyDescriptor(Pulse.prototype,'backgroundColor');f.c.update();
 try{Object.defineProperty(Pulse.prototype,'backgroundColor',{configurable:true,set(v){this._backgroundColor=v;}});f.c.update();assert.ok(f.pulses.every(p=>!Object.hasOwn(p,'backgroundColor')));}finally{f.c.dispose();Object.defineProperty(Pulse.prototype,'backgroundColor',original);}
 const g=pulseFixture();g.c.update();const extra=new Pulse(g.containers[0]);g.containers[0].getChildren=()=>[g.pulses[0],extra];g.c.update();assert.ok(g.pulses.every(p=>!Object.hasOwn(p,'backgroundColor')));g.c.dispose();
});
test('unread internal bases retain ten percent through read release and busy',()=>{
 const f=pulseFixture();f.tab.active=false;f.tab.attention=false;f.tab.unread=true;f.node.backgroundColor='#4F4F4F';f.c.update();
 for(const p of f.pulses)assert.deepEqual(normalizeRGBA(p._backgroundColor).slice(0,3),[90,95,94]);
 for(let i=0;i<10;i++)f.c.update();assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[90,95,94]);
 f.tab.unread=false;f.c.update();assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[90,95,94]);
 f.tab.busy=true;f.c.update();assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[90,95,94]);f.c.dispose();
});
test('busy rows and both internal pulses retain active five and inactive ten percent',()=>{
 const f=pulseFixture();f.tab.attention=false;f.tab.busy=true;f.c.update();assert.equal(f.node.backgroundColor,'#545756');
 for(const p of f.pulses)assert.deepEqual(normalizeRGBA(p._backgroundColor).slice(0,3),[84,87,86]);
 f.tab.active=false;f.node.backgroundColor='#4F4F4F';f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');
 for(const p of f.pulses)assert.deepEqual(normalizeRGBA(p._backgroundColor).slice(0,3),[90,95,94]);
 const hover=new NativeColor(95,95,95);f.pulses[0].backgroundColor=hover;assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[96,96,96]);
 for(let i=0;i<10;i++)f.c.update();assert.deepEqual(normalizeRGBA(f.pulses[1]._backgroundColor).slice(0,3),[90,95,94]);
 f.c.dispose();assert.equal(f.pulses[0]._backgroundColor,hover);assert.deepEqual(normalizeRGBA(f.pulses[1]._backgroundColor).slice(0,3),[79,79,79]);
});
test('busy RGB and unknown fallbacks restore native row and pulse bases',()=>{
 const f=pulseFixture();f.tab.attention=false;f.tab.busy=true;f.c.update();assert.equal(f.node.backgroundColor,'#545756');
 f.context.renderer.capabilities.rgb=false;f.c.update();assert.equal(f.node.backgroundColor,transparent);assert.ok(f.pulses.every(p=>!Object.hasOwn(p,'backgroundColor')));assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[79,79,79]);
 f.context.renderer.capabilities.rgb=true;f.c.update();f.c.observe('a',{providerID:'unknown',modelID:'draft'});f.c.update();assert.equal(f.node.backgroundColor,transparent);assert.deepEqual(normalizeRGBA(f.pulses[0]._backgroundColor).slice(0,3),[79,79,79]);f.c.dispose();
});
