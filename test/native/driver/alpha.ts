import {findInlineProvider} from '../../../src/inline.mjs';
import {normalizeRGBA} from '../../../src/core.mjs';

// Test-only: hold an already running native effect while comparing whole frames.
// No framebuffer writes, production instrumentation or artificial effect colors.
export async function alphaRun(h:any){
 const {c,owned,start,stop,capture,delay,wait,rowOf,internal,assertions,details,hover,read}=h;
 const rect=(n:any)=>({x:n.screenX,y:n.screenY,width:n.width,height:n.height});
 const descendants=(n:any):any[]=>[n,...(n.getChildren?.()??[]).flatMap(descendants)];
 let seq=300;
 const check=async(name:string)=>{
  const restore:any[]=[];
  for(const id of owned)for(const n of descendants(rowOf(id).node)){
   for(const clock of [n.inner,n.outer])if(clock?.advance){const old=clock.advance;clock.advance=()=>{};restore.push(()=>clock.advance=old);}
   if(n.textNode){const old=n.renderSelf;n.renderSelf=function(b:any){return old.call(this,b,0);};restore.push(()=>n.renderSelf=old);}
  }
  try{
   stop();h.setAlpha('');start();await delay(80);
   const opaque=await capture(name+'-rgb');
   const nodes=[...h.ctrl().rows.text.handles.keys()];
   const leaf=findInlineProvider(c.renderer.root,c.ui.model.current()?.providerID==='fixture-green'?'Fixture Green':'Fixture Red');
   const targets=nodes.map((n:any)=>({kind:Object.hasOwn(n,'_rename')?'sessionFg':'projectFg',rect:rect(n)}));
   if(leaf)targets.push({kind:'providerFg',rect:rect(leaf.parent.textParent)});
   const cases:any[]=[];
   for(const alpha of ['FF','80','00']){
    stop();h.setAlpha(alpha);start();await delay(80);const shot=await capture(name+'-'+alpha);
    const results=targets.map(({kind,rect:r}:any)=>{
     const failures:any[]=[],backgrounds=new Set(),inks=new Set();let cells=0;
     for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){
      const a=opaque.cells[y]?.[x],b=shot.cells[y]?.[x];if(!a||!b||a[0]===' ')continue;
      cells++;backgrounds.add(b[2]);inks.add(a[1]);
      const channels=(v:string)=>v.slice(1).match(/../g)!.map(s=>parseInt(s,16));
      const fg=channels(a[1]),bg=channels(b[2]),actual=channels(b[1]);
      const expected=fg.map((v:number,i:number)=>Math.round(bg[i]+(v-bg[i])*(parseInt(alpha,16)/255)));
      const ok=a[2]===b[2]&&(alpha==='00'?(b[0]===' '||actual.every((v:number,i:number)=>v===bg[i])):a[0]===b[0]&&a[3]===b[3]&&actual.every((v:number,i:number)=>Math.abs(v-expected[i])<=(alpha==='FF'?0:1)));
      if(!ok&&failures.length<8)failures.push({x,y,opaque:a,actual:b,expected});
     }
     return {kind,rect:r,cells,backgrounds:[...backgrounds],inks:[...inks],failures};
    });
    for(const kind of ['sessionFg','projectFg','providerFg']){
     const checks=results.filter((r:any)=>r.kind===kind);
     if(kind==='providerFg'&&!checks.length){assertions[name+'NativeFooterAbsentDuringQuestion']=c.ui.tabs.list().some((t:any)=>t.active&&t.attention);continue;}
     assertions[name+alpha+kind]=checks.length>0&&checks.every((r:any)=>r.cells>0&&!r.failures.length);
    }
    assertions[name+alpha+'RowBackgrounds']=JSON.stringify(opaque.rows.map((r:any)=>r.cells.map((l:any)=>l.map((p:any)=>p[2]))))===JSON.stringify(shot.rows.map((r:any)=>r.cells.map((l:any)=>l.map((p:any)=>p[2]))));
    assertions[name+alpha+'GapsUnchanged']=JSON.stringify(opaque.gaps.map((g:any)=>g.cells))===JSON.stringify(shot.gaps.map((g:any)=>g.cells));
    assertions[name+alpha+'OutsideTextUnchanged']=opaque.rows.every((row:any)=>row.cells.every((line:any,y:number)=>line.every((cell:any,x:number)=>{const xx=row.rect.x+x,yy=row.rect.y+y,next=shot.cells[yy]?.[xx];if(targets.some(({rect:r}:any)=>xx>=r.x&&xx<r.x+r.width&&yy>=r.y&&yy<r.y+r.height))return true;const spinner=row.tab.busy&&y===0&&x===1&&/^[\u2800-\u28ff]$/.test(cell[0])&&/^[\u2800-\u28ff]$/.test(next?.[0]);return JSON.stringify(spinner?cell.slice(1):cell)===JSON.stringify(spinner?next.slice(1):next);})));
    cases.push({alpha,results});
   }
   details[name]={cases,pulses:owned.map((id:string)=>internal(id).map((p:any)=>({running:p.inner.running,glow:p.inner.glowLevel})))};
   if(name==='alphaGlow'||name==='alphaUnread'||name==='alphaBusy'&&c.options.animationsTest)for(const kind of ['sessionFg','projectFg'])assertions[name+kind+'HeterogeneousBackground']=cases[1].results.some((r:any)=>r.kind===kind&&r.backgrounds.length>1);
   if(name==='alphaGlow'||name==='alphaUnread')assertions[name+'NativeTextEffectPresent']=cases[1].results.some((r:any)=>r.kind==='sessionFg'&&r.inks.length>1);
  }finally{stop();h.setAlpha('80');restore.reverse().forEach(f=>f());start();}
 };
 c.ui.tabs.focus(owned[2]);await delay(250);await check('alphaIdle');
 const row=rowOf(owned[0]).node;await hover(++seq,row.screenX+6,row.screenY+1);await check('alphaHover');await hover(++seq,139,44);
 const form=await c.client.session.form.create({sessionID:owned[2],title:'RGBA text',fields:[{key:'ok',type:'boolean',title:'Continue?',required:true}]});await wait(()=>Boolean(c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.attention),'alpha-attention');await delay(800);await check('alphaGlow');
 c.ui.tabs.focus(owned[0]);await delay(200);await check('alphaInactiveAttention');
 await c.client.session.form.reply({sessionID:owned[2],formID:form.id,answer:{ok:true}});await read(owned[2]);await delay(1100);
 await c.client.session.prompt({sessionID:owned[2],text:'fixture-busy'});await wait(()=>Boolean(c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.busy),'alpha-busy');await delay(450);await check('alphaBusy');
 h.releaseBusy();await wait(()=>!c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.busy,'alpha-complete');await delay(900);await check('alphaUnread');await read(owned[2]);await delay(1100);
 c.ui.tabs.focus(owned[2]);await delay(150);
 await c.client.session.switchModel({sessionID:owned[2],model:{id:'pc-fixture-2',providerID:'openai'}});await wait(()=>c.ui.model.current()?.modelID==='pc-fixture-2','alpha-same-provider-model');await delay(150);await check('alphaSameProviderModel');
 await c.client.session.switchModel({sessionID:owned[2],model:{id:'pc-fixture',providerID:'fixture-green'}});await wait(()=>c.ui.model.current()?.providerID==='fixture-green','alpha-provider-switch');await delay(200);await check('alphaProviderSwitch');
 const old=rowOf(owned[2]).node;c.ui.tabs.close(owned[2]);await delay(100);c.ui.tabs.focus(owned[2]);await delay(200);assertions.alphaRealRemount=rowOf(owned[2]).node!==old;await check('alphaRemount');
 if(c.options.themeTest){const before=c.themeMode;c.renderer.emit('theme_mode',before==='dark'?'light':'dark');await wait(()=>c.themeMode!==before,'alpha-theme-switch');await delay(250);assertions.alphaActualThemeChanged=c.themeMode!==before;details.alphaThemeModes={before,after:c.themeMode};await check('alphaThemeChanged');}
 await c.client.session.switchModel({sessionID:owned[2],model:{id:'pc-fixture',providerID:'fixture-unknown'}});await wait(()=>c.ui.model.current()?.providerID==='fixture-unknown','alpha-unknown');await delay(150);const unknown=await capture('alpha-unknown-on');stop();await delay(100);const unknownNative=await capture('alpha-unknown-native');assertions.alphaUnknownNative=JSON.stringify(unknown.rows[2].cells)===JSON.stringify(unknownNative.rows[2].cells);start();
 await c.client.session.switchModel({sessionID:owned[2],model:{id:'pc-fixture',providerID:'fixture-green'}});await wait(()=>c.ui.model.current()?.providerID==='fixture-green','alpha-known');await delay(150);
 stop();h.setAlpha('80');const native=await capture('alpha-native-dispose');const leaf=findInlineProvider(c.renderer.root,'Fixture Green');if(!leaf)throw Error('alpha-leaf-missing');leaf.fg=undefined;start();await delay(100);leaf.fg=undefined;stop();await delay(100);const disposed=await capture('alpha-disposed');assertions.alphaUndefinedRestore=leaf.fg===undefined&&!Object.hasOwn(leaf,'fg');
 assertions.alphaDisposeRows=JSON.stringify(native.rows.map((r:any)=>r.cells))===JSON.stringify(disposed.rows.map((r:any)=>r.cells));
 h.setRGBOff(true);start();await delay(100);const rgbOff=await capture('alpha-rgb-disabled');assertions.alphaRGBDisabledRows=JSON.stringify(rgbOff.rows.map((r:any)=>r.cells))===JSON.stringify(disposed.rows.map((r:any)=>r.cells));assertions.alphaRGBDisabledInline=leaf.fg===undefined&&!Object.hasOwn(leaf,'fg');stop();h.setRGBOff(false);
 h.setOmitted(true);const nativeFG=normalizeRGBA(leaf.fg);start();await delay(100);const omitted=await capture('alpha-omitted');const ink=(s:any)=>s.rows.map((r:any)=>r.cells.map((l:any)=>l.map((p:any)=>[p[0],p[1],p[3]])));assertions.alphaOmittedFieldsNative=JSON.stringify(ink(omitted))===JSON.stringify(ink(disposed));assertions.alphaOmittedProviderNative=JSON.stringify(normalizeRGBA(leaf.fg))===JSON.stringify(nativeFG);stop();h.setOmitted(false);
 details.alphaVersion=c.app.version;
}
