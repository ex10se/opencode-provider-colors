import {findInlineProvider} from '../../../src/inline.mjs';
import {normalizeRGBA} from '../../../src/core.mjs';

export async function nullRun(h:any){
 const {c,owned,start,stop,capture,delay,wait,rowOf,hover,read,ctrl,assertions,details,setPalette,releaseBusy}=h;
 const sample={bg:null,activeBg:'#57A98133',hoverBg:'#00000000',providerFg:'#FF0000',sessionFg:'#FF0000',projectFg:'#000000'};
 const palettes=(openai:any)=>({openai,'fixture-green':{bg:'#3986181A',activeBg:null,hoverBg:null}});
 const bg=(r:any)=>r.cells.map((l:any)=>l.map((p:any)=>p[2]));
 const shape=(r:any)=>r.cells.map((l:any)=>l.map((p:any)=>[p[0],p[3]]));
 const eq=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
 const check=async(name:string,nativeBG:boolean)=>{
  stop();await delay(200);const off=await capture(name+'-native'),nativeProviderVisible=Boolean(findInlineProvider(c.renderer.root,'Fixture Red'));
  start();await delay(200);const on=await capture(name+'-on');
  const a=on.rows[2],b=off.rows[2];
  assertions[name+'PluginActive']=Boolean(ctrl());
  assertions[name+'TitleRed']=a.cells[0].slice(16).some((p:any)=>p[0]!==' '&&p[1]==='#ff0000');
  assertions[name+'ProjectBlack']=a.cells[1].some((p:any)=>p[0]!==' '&&p[1]==='#000000');
  assertions[name+'CharactersAttributes']=eq(shape(a),shape(b));
  assertions[name+'State']=eq(a.tab,b.tab);
  if(!name.startsWith('coloredBg'))assertions[name+'NativeGaps']=eq(on.gaps,off.gaps)&&ctrl().rows.gaps.entries.size===0;
  if(nativeBG)assertions[name+'NativeBackgroundCells']=eq(bg(a),bg(b));
  else{
   // Independent 0x33/255 source-over oracle on the host selected surface.
   const base=b.cells[0].at(-3)[2].slice(1).match(/../g).map((v:string)=>parseInt(v,16)),want='#'+base.map((v:number,i:number)=>Math.round(v+([87,169,129][i]-v)*.2).toString(16).padStart(2,'0')).join('');
   assertions[name+'ActiveAlphaTail']=a.cells.every((l:any)=>l.slice(16,-2).every((p:any)=>p[2]===want));
   details[name+'ExpectedAlpha']=want;
  }
  if(a.tab.active&&nativeProviderVisible){const leaf=findInlineProvider(c.renderer.root,'Fixture Red');assertions[name+'ProviderLeafRed']=normalizeRGBA(leaf?.fg)?.slice(0,3).join(',')==='255,0,0';
   const n=leaf?.parent?.textParent;const cells=n?on.cells.slice(n.screenY,n.screenY+n.height).flatMap((l:any)=>l.slice(n.screenX,n.screenX+n.width)):[];
   assertions[name+'ProviderFinalRed']=cells.some((p:any)=>p[0]!==' '&&p[1]==='#ff0000');}
  else if(a.tab.active)assertions[name+'NativeProviderAbsent']=!findInlineProvider(c.renderer.root,'Fixture Red');
  details[name]={native:b,on:a,nativeGaps:off.gaps,onGaps:on.gaps};stop();
 };
 setPalette(palettes(sample));c.ui.tabs.focus(owned[0]);await delay(200);await check('sampleInactiveIdle',true);
 c.ui.tabs.focus(owned[2]);await delay(200);await check('sampleActiveIdle',false);
 c.ui.tabs.focus(owned[0]);await delay(150);const r=rowOf(owned[2]).node;
 await hover(301,r.screenX+6,r.screenY+1);await check('sampleInactiveHover',true);
 assertions.sampleHoverActuallyRaised=details.sampleInactiveHover.native.background.slice(0,3).join(',')===normalizeRGBA(c.theme.background.raised.high).slice(0,3).join(',');
 await hover(302,139,44);
 const form=await c.client.session.form.create({sessionID:owned[2],title:'Nullable background question',fields:[{key:'ok',type:'boolean',title:'Continue?',required:true}]});
 await wait(()=>Boolean(c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.attention),'question');
 await check('sampleInactiveQuestion',true);c.ui.tabs.focus(owned[2]);await delay(200);await check('sampleActiveQuestion',false);
 setPalette(palettes({...sample,activeBg:null,hoverBg:null}));await check('nullActiveQuestion',true);
 c.ui.tabs.focus(owned[0]);await delay(200);await check('nullInactiveQuestion',true);
 await c.client.session.form.reply({sessionID:owned[2],formID:form.id,answer:{ok:true}});await wait(()=>!c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.attention,'question-cleared');await read(owned[2]);
 await c.client.session.prompt({sessionID:owned[2],text:'fixture-busy'});await wait(()=>Boolean(c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.busy),'busy');
 await check('nullInactiveBusy',true);c.ui.tabs.focus(owned[2]);await delay(200);await check('nullActiveBusy',true);
 c.ui.tabs.focus(owned[0]);await delay(150);releaseBusy();await wait(()=>!c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.busy,'busy-cleared');await check('nullUnread',true);await read(owned[2]);await delay(200);
 await c.client.session.prompt({sessionID:owned[2],text:'fixture-permission'});await wait(()=>Boolean(c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.attention),'permission');
 await c.data.session.permission.sync(owned[2]);const permissions=c.data.session.permission.list(owned[2]);assertions.permissionExists=permissions.length>0;
 await check('nullInactivePermission',true);c.ui.tabs.focus(owned[2]);await delay(200);await check('nullActivePermission',true);
 await c.client.permission.reply({sessionID:owned[2],requestID:permissions[0].id,decision:'reject'});await wait(()=>!c.ui.tabs.list().find((t:any)=>t.sessionID===owned[2])?.busy,'permission-cleared');await read(owned[2]);await delay(300);
 setPalette(palettes({...sample,bg:'#FF00FF',activeBg:null,hoverBg:null}));
 // Explicit null must beat a non-null fallback for the active state.
 await check('coloredBgNullActive',true);
 c.ui.tabs.focus(owned[0]);await delay(200);await hover(303,r.screenX+6,r.screenY+1);await check('coloredBgNullHover',true);await hover(304,139,44);
 stop();setPalette(palettes({...sample,activeBg:null,hoverBg:null}));c.ui.tabs.focus(owned[1]);await delay(200);const off=await capture('mixed-custom-native');start();await delay(200);const on=await capture('mixed-custom-on');assertions.mixedCustomActiveNative=eq(bg(on.rows[1]),bg(off.rows[1]));assertions.mixedOpenAIIdleNative=eq(bg(on.rows[2]),bg(off.rows[2]));stop();
}
