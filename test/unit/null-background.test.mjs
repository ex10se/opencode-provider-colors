import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateColors} from '../../src/paint.mjs';
import {resolveBackground} from '../../src/soft.mjs';
import {interceptIdleBackground} from '../../src/core.mjs';
const sample={bg:null,activeBg:'#57A98133',hoverBg:'#00000000',providerFg:'#FF0000',sessionFg:'#FF0000',projectFg:'#000000'};
test('exact user sample retains all foregrounds and nullable idle background',()=>{
 const c=validateColors({openai:sample}).openai;
 assert.equal(c.bg,null);assert.equal(c.sessionFg,'#FF0000');assert.equal(c.projectFg,'#000000');assert.equal(c.fg,'#FF0000');
 assert.equal(resolveBackground(c,'#444444',false,false),undefined);
 assert.equal(resolveBackground(c,'#444444',true,false),'#485850');
 assert.equal(resolveBackground(c,'#555555',false,true),'#555555');
 assert.equal(resolveBackground(c,'#555555',true,true),'#555555');
});
for(const key of ['bg','activeBg','hoverBg'])test(`${key} explicit null is native, not fallback`,()=>{
 const c=validateColors({openai:{bg:'#FF0000',[key]:null}}).openai;
 assert.equal(c[key],null);assert(Object.hasOwn(c,key));
 assert.equal(resolveBackground(c,'#444444',key==='activeBg',key==='hoverBg'),undefined);
});
for(const bg of [null,'#112233'])test(`missing active/hover inherit bg=${bg}`,()=>{
 const c=validateColors({openai:{bg}}).openai;
 for(const [active,hover] of [[false,false],[true,false],[false,true],[true,true]])assert.equal(resolveBackground(c,'#444444',active,hover),bg===null?undefined:'#112233');
});
test('hover null wins over active override; missing hover falls back to bg, not active',()=>{
 for(const [hoverBg,want] of [[null,undefined],['#00000000','#444444']]){
  const c=validateColors({openai:{bg:'#112233',activeBg:'#FF0000',hoverBg}}).openai;
  assert.equal(resolveBackground(c,'#444444',true,true),want);
 }
 assert.equal(resolveBackground(validateColors({openai:{bg:'#112233',activeBg:'#FF0000'}}).openai,'#444444',true,true),'#112233');
});
test('mixed providers and six null fields keep validation strict',()=>{
 const all={bg:null,activeBg:null,hoverBg:null,sessionFg:null,projectFg:null,providerFg:null};
 const c=validateColors({openai:all,'example-provider':'#ABCDEF'});
 assert.equal(c['example-provider'].bg,'#ABCDEF');assert.equal(c.openai.fg,undefined);
 assert.deepEqual(Object.keys(c.openai).sort(),['activeBg','bg','fg','hoverBg','objectPalette']);
 for(const v of [null,{},[],false])assert.throws(()=>validateColors({openai:v}));
 for(const key of Object.keys(all))for(const v of [false,1,undefined,'bad','#12345','#1234567'])assert.throws(()=>validateColors({openai:{bg:'#112233',[key]:v}}));
 assert.throws(()=>validateColors({openai:{bg:null,unknown:null}}));
});
test('native resolver result restores current host values through real background interception',()=>{
 class Node{get backgroundColor(){return this.value;}set backgroundColor(v){this.value=v;}requestRender(){}}
 const n=new Node();n.backgroundColor='#444444';let c=validateColors({openai:{bg:'#112233'}}).openai;
 const handle=interceptIdleBackground(n,{idle:'#444444',eligible:()=>true,resolve:host=>resolveBackground(c,host,false,false)});
 assert(handle);assert.equal(n.backgroundColor,'#112233');
 c=validateColors({openai:{bg:null}}).openai;handle.refresh();assert.equal(n.backgroundColor,'#444444');
 n.backgroundColor='#556677';assert.equal(n.backgroundColor,'#556677');handle.dispose();assert.equal(n.backgroundColor,'#556677');
});
