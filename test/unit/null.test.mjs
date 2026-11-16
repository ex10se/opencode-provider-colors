import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateColors} from '../../src/paint.mjs';
import {RowTextColors} from '../../src/text.mjs';
import {InlineProvider} from '../../src/inline.mjs';

const fields=['sessionFg','projectFg','providerFg'];
for(const key of fields)test(`${key}: null is exact omission`,()=>{
 const input={bg:'#123456',[key]:null};
 const result=validateColors({openai:input});
 assert.deepEqual(result,validateColors({openai:{bg:'#123456'}}));
 assert(!Object.hasOwn(result.openai,key));
 assert.equal(input[key],null);
 assert(Object.isFrozen(result.openai));
});
test('mixed null and explicit foregrounds preserve aliases without palette labels',()=>{
 assert.deepEqual(validateColors({openai:{bg:'#123456',sessionFg:null,projectFg:'#ABCDEF80',providerFg:null}}),validateColors({openai:{bg:'#123456',projectFg:'#ABCDEF80'}}));
 const c=validateColors({openai:{bg:'#123456',sessionFg:null,projectFg:null,providerFg:'#AABBCC'}}).openai;
 assert.equal(c.fg,'#AABBCC');assert.equal(Object.hasOwn(c,'label'),false);
 assert.deepEqual(validateColors({custom:{bg:'#123456',sessionFg:null,projectFg:null,providerFg:null}}),validateColors({custom:{bg:'#123456'}}));
});
test('null is still forbidden for unknown keys',()=>{
 for(const key of ['fg','label','unknown'])assert.throws(()=>validateColors({openai:{bg:'#123456',[key]:null}}),/invalid-provider-colors/);
 for(const key of fields)for(const value of [false,0,undefined,'', '#12345', '#1234567'])assert.throws(()=>validateColors({openai:{bg:'#123456',[key]:value}}));
});

// Lightweight render-tree fixture: exercise production hook ownership and
// native-style restoration without starting a UI or claiming pixel evidence.
class Color {constructor(hex){this.hex=hex;[this.r,this.g,this.b]=hex.slice(1,7).match(/../g).map(x=>parseInt(x,16)/255);this.a=1;this.intent='rgb';this.slot=0;} static fromHex(hex){return new Color(hex);}}
class TextRoot {
 requestRender(){this.renders=(this.renders??0)+1;}
 prepareWithInheritedStyle(style){return {chunks:[{fg:style.fg,text:'native'}]};}
}
function rowFixture(){
 const row={width:20,opacity:1,backgroundColor:'#444444'};
 const nodes=[];
 row.getChildren=()=>fields.slice(0,2).map((_,i)=>containers[i]);
 const containers=[0,1].map(i=>{
  const container={height:1,width:20,parent:row};
  const pulse={parent:container,inner:{advance(){}},getChildren:()=>[nodes[i]]};
  nodes[i]={parent:pulse,fg:'#CCCCCC',_backdrop:'#444444',textNode:new TextRoot(),...(i===0?{_rename:true}:{})};
  container.getChildren=()=>[pulse];return container;
 });
 return {row,nodes,entries:new Map([[row,{id:'s',nativeBase:'#444444',sessionTextEligible:()=>true,pulseEligible:()=>true}]])};
}
for(const nullValue of [true,false])test(`session/project color -> ${nullValue?'null':'omission'} restores native preparation`,()=>{
 const {nodes,entries}=rowFixture(),painter=new RowTextColors(),colors=validateColors({openai:{bg:'#123456',sessionFg:'#FF0000',projectFg:'#00FF00'}});
 const provider=()=>({providerID:'openai'}),native=new Color('#CCCCCC');
 painter.update(entries,colors,provider);
 assert.equal(painter.handles.size,2);
 assert.equal(nodes[0].textNode.prepareWithInheritedStyle({fg:native}).chunks[0].fg.hex,'#ff0000');
 assert.equal(nodes[1].textNode.prepareWithInheritedStyle({fg:native}).chunks[0].fg.hex,'#00ff00');
 const next=validateColors({openai:{bg:'#123456',...(nullValue?{sessionFg:null,projectFg:null}:{})}});
 // Exercise the supported teardown/recreate lifecycle, not a claimed hot reload.
 painter.dispose();painter.update(entries,next,provider);
 assert.equal(painter.handles.size,0);
 for(const node of nodes){assert.equal(node.textNode.prepareWithInheritedStyle({fg:native}).chunks[0].fg,native);assert(!Object.hasOwn(node.textNode,'prepareWithInheritedStyle'));}
});
test('row disposal preserves foreign prepare hook when null replaces color',()=>{
 const {nodes,entries}=rowFixture(),painter=new RowTextColors();
 painter.update(entries,validateColors({openai:{bg:'#123456',sessionFg:'#FF0000'}}),()=>({providerID:'openai'}));
 const foreign=()=>({chunks:[{text:'foreign'}]});nodes[0].textNode.prepareWithInheritedStyle=foreign;
 painter.dispose();painter.update(entries,validateColors({openai:{bg:'#123456',sessionFg:null}}),()=>({providerID:'openai'}));
 assert.equal(nodes[0].textNode.prepareWithInheritedStyle,foreign);assert.equal(painter.handles.size,0);
});
class Leaf {get fg(){return this.value;}set fg(value){this.value=value;}}
function inlineFixture(){
 const node=(children=[])=>{const n={getChildren:()=>children};for(const child of children)child.parent=n;return n;};
 const text=label=>{const leaf=new Leaf();leaf.children=[label];leaf.value='#CCCCCC';const root={children:[leaf]};leaf.parent=root;const n={textNode:root,width:10,height:1};root.textParent=n;return n;};
 const provider=text('Codex Safe'),group=node([text('·'),text('model'),provider]),line=node([text('agent'),group]),footer=node([line]);
 const editor={editorView:{},editBuffer:{},width:10,height:1};
 return {root:node([node([editor,footer])]),leaf:provider.textNode.children[0]};
}
for(const foreign of [false,true])test(`provider color -> null restores native; foreign=${foreign}`,()=>{
 const {root,leaf}=inlineFixture(),owner=new InlineProvider();
 const active=validateColors({openai:{bg:'#123456',providerFg:'#FF0000'}}).openai;
 owner.update(root,'Codex Safe',active.fg);assert.equal(leaf.fg,'#FF0000');
 leaf.fg='#BBBBBB';assert.equal(leaf.fg,'#FF0000');
 if(foreign)Object.defineProperty(leaf,'fg',{configurable:true,writable:true,value:'#ABCDEF'});
 const native=validateColors({openai:{bg:'#123456',providerFg:null}}).openai;
 owner.update(root,'Codex Safe',native.fg);
 assert.equal(leaf.fg,foreign?'#ABCDEF':'#BBBBBB');assert.equal(Object.hasOwn(leaf,'fg'),foreign);assert.equal(owner.anchor(),undefined);
});
