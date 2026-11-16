import test from 'node:test';
import assert from 'node:assert/strict';
import {OrdinaryRows} from '../../src/ordinary.mjs';
import {validateColors} from '../../src/paint.mjs';
class Box {value='#4F4F4F';get backgroundColor(){return this.value;}set backgroundColor(v){this.value=v;}}
function fixture(){
 const node=new Box(),panel=new Box();Object.assign(panel,{width:42,height:45,screenX:0});
 Object.assign(node,{parent:{parent:{parent:panel}},width:42,screenX:0});
 const row={node,title:'A'},session={model:{providerID:'openai',id:'saved'},agent:'build'};
 const tab={sessionID:'a',title:'A',active:false,busy:false,attention:false};
 const snapshot={rows:[row],mapping:{ok:true},bindings:{get:()=> 'a'}};
 const c=new OrdinaryRows({app:{version:'2.2.5'},renderer:{height:45,capabilities:{rgb:true}},theme:{background:{raised:{base:'#4F4F4F',high:'#5F5F5F'},action:{primary:{selected:'#000000'}}}},ui:{tabs:{list:()=>[tab]},router:{current:()=>({type:'session',sessionID:'a'})}},data:{session:{get:()=>session}}},validateColors({'example-provider':'#EADBFF'}),()=>snapshot);
 return {c,node,tab,session};
}
test('saved provider colors unopened known session without observation',()=>{const f=fixture();f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');f.c.dispose();});
test('observed provider colors persist across consecutive updates',()=>{const f=fixture();f.c.observe('a',{providerID:'example-provider',modelID:'draft'});f.c.update();f.c.update();assert.equal(f.node.backgroundColor,'#5F5D61');f.c.dispose();});
test('observed unknown provider never falls back to stale known saved provider',()=>{const f=fixture();f.c.observe('a',{providerID:'unknown',modelID:'draft'});f.c.update();assert.equal(f.node.backgroundColor,'#4F4F4F');f.c.dispose();});
test('hover passes native color and returns provider on native leave',()=>{const f=fixture();f.c.update();f.node.backgroundColor='#5F5F5F';assert.equal(f.node.backgroundColor,'#606060');f.node.backgroundColor='#4F4F4F';assert.equal(f.node.backgroundColor,'#5A5F5E');f.c.dispose();});
test('inactive attention restores native surface and provider color returns when attention clears',()=>{
  for(const [key,value] of [['attention',true]]){
  const f=fixture();f.c.update();f.tab[key]=value;f.c.update();assert.equal(f.node.backgroundColor,'#4F4F4F');f.tab[key]=false;f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');f.c.dispose();
 }
});
test('saved model changes invalidate observed override for that session',()=>{const f=fixture();f.c.observe('a',{providerID:'example-provider',modelID:'draft'});f.c.update();assert.equal(f.node.backgroundColor,'#5F5D61');f.session.model={id:'another',providerID:'openai'};f.c.update();assert.equal(f.node.backgroundColor,'#5A5F5E');f.c.dispose();assert.equal(Object.hasOwn(f.node,'backgroundColor'),false);});
