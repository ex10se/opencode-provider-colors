import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
const require=createRequire(import.meta.url);
const root=dirname(require.resolve('@opentui/core'));
assert.equal(JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version,'0.8.1');
const {OptimizedBuffer,RGBA,TextBuffer,TextBufferView,ResourceContext}=await import('@opentui/core');
const owner=new ResourceContext({objectCapacity:100,renderCellsMax:1000}),c=(s:string)=>RGBA.fromHex(s);
const proof:any[]=[];
try{for(const alpha of ['00','80','FF']){
 const b=OptimizedBuffer.create(3,1,'unicode',{respectAlpha:false,owner}),t=TextBuffer.create('unicode',owner),v=TextBufferView.create(t);
 try{
  const backgrounds=['#204060','#406020','#602040'];
  for(const [i,bg] of backgrounds.entries())b.setCell(i,0,' ',c('#ABCDEF'),c(bg));
  t.setDefaultFg(c('#FF0000'+alpha));t.setText('XXX');v.setViewport(0,0,3,1);b.drawTextBuffer(v,0,0);
  const spans=b.getSpanLines()[0].spans;assert.equal(spans.length,3);
  for(const [i,s] of spans.entries()){
   assert.equal(s.text,alpha==='00'?' ':'X');
   const bg=backgrounds[i].slice(1).match(/../g)!.map(x=>parseInt(x,16));
   assert.deepEqual([...s.bg.buffer],[...bg,255]);
   if(alpha!=='00')assert.deepEqual([...s.fg.buffer],[...bg.map((n,j)=>Math.round(n+([255,0,0][j]-n)*parseInt(alpha,16)/255)),255]);
  }
  proof.push({alpha,spans});
 }finally{v.destroy();t.destroy();b.destroy();}
}}finally{owner.destroy();}
console.log(JSON.stringify({version:'0.8.1',proof,assertions:28}));
