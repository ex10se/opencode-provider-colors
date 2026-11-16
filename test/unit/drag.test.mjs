import test from 'node:test';
import assert from 'node:assert/strict';
import {validateColors} from '../../src/paint.mjs';
import {resolveBackground} from '../../src/soft.mjs';
import {EventEmitter} from 'node:events';
import {EventController} from '../../src/events.mjs';

test('drag observer preserves mouse result, foreign replacement and exact ownership on dispose',()=>{
 for(const foreign of [false,true]){
  const root=new EventEmitter(),row={},target={parent:row};let calls=0;
  const native=function(event){assert.equal(this,root);calls++;return event.type;};
  root.processMouseEvent=native;
  const renderer=Object.assign(new EventEmitter(),{root,capturedRenderable:target});
  const c=new EventController({options:{},renderer},validateColors());
  c.snapshot={bindings:{get:node=>node===row?'session':undefined}};
  assert.equal(root.processMouseEvent({type:'drag',button:0}),'drag');assert.equal(c.dragID,'session');assert.equal(calls,1);
  assert.equal(root.processMouseEvent({type:'up',button:0}),'up');assert.equal(c.dragID,undefined);
  const replacement=()=>{};if(foreign)root.processMouseEvent=replacement;
  c.dispose();assert.equal(root.processMouseEvent,foreign?replacement:native);
 }
});

test('non-configurable mouse handler remains untouched',()=>{
 const root=new EventEmitter(),native=()=>{};
 Object.defineProperty(root,'processMouseEvent',{value:native,configurable:false});
 const c=new EventController({options:{},renderer:Object.assign(new EventEmitter(),{root})},validateColors());
 c.dispose();assert.equal(root.processMouseEvent,native);
});

test('drag background inherits active, then bg; explicit native active is not lost',()=>{
 const palette=(value)=>validateColors({openai:{bg:'#112233',...value}}).openai;
 assert.equal(resolveBackground(palette({activeBg:'#334455',dragBg:null}),'#000000',false,true,undefined,true),'#334455');
 assert.equal(resolveBackground(palette({dragBg:null}),'#000000',false,true,undefined,true),'#112233');
 assert.equal(resolveBackground(palette({activeBg:null,dragBg:null}),'#000000',false,true,undefined,true),undefined);
 assert.equal(resolveBackground(palette({activeBg:null,dragBg:'#FFFFFF80'}),'#000000',false,true,undefined,true),'#808080');
});

test('drag foreground permits null fallback and RGBA without changing ordinary foreground',()=>{
 const p=validateColors({openai:{bg:null,sessionFg:'#123456',projectFg:null,dragSessionFg:null,dragProjectFg:'#FFFFFF80'}}).openai;
 assert.equal(p.sessionFg,'#123456');assert.equal(p.dragSessionFg,undefined);assert.equal(p.dragProjectFg,'#FFFFFF80');
 for(const value of [false,2,'#XYZ'])assert.throws(()=>validateColors({openai:{bg:null,dragBg:value}}));
});
