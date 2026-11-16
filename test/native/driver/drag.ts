export async function dragRun(h: any) {
  const {c, owned, mouse, capture, rowOf, assertions: a, details, delay, ctrl} = h;
  await c.ui.tabs.focus(owned[2]);
  await delay(200);
  h.start();
  await delay(200);
  const before = await capture('drag-before');
  const row = rowOf(owned[0]).node;
  const ordered = [...before.rows].sort((a: any,b: any)=>a.rect.y-b.rect.y).map((r: any)=>r.id);
  const destination = ordered[0]===owned[0]?ordered.length-1:0;
  const target = rowOf(ordered[destination]).node, dropY = target.screenY + 1;
  const expectedOrder = ordered.filter((id: string)=>id!==owned[0]);expectedOrder.splice(destination,0,owned[0]);
  const x = row.screenX + 5, y = row.screenY + 1;
  await mouse('down', x, y);
  await mouse('drag', x, dropY);
  const during = await capture('drag-during');
  details.pointer = {pressed: !!c.renderer.pressedRenderable, captured: !!c.renderer.capturedRenderable,
    mapping: ctrl()?.snapshot?.mapping, before: before.rows.map((r: any) => [r.id, r.rect.y]),
    during: during.rows.map((r: any) => [r.id, r.rect.y])};
  a.realPointerCaptured = !!c.renderer.capturedRenderable;
  a.previewMovedBeforeDrop = during.rows.find((r: any) => r.id === owned[0]).rect.y !== before.rows.find((r: any) => r.id === owned[0]).rect.y;
  a.dragTitleRetainsColor = during.rows.find((r: any) => r.id === owned[0]).cells[0].some((cell: any) => cell[0] === 'N' && cell[1] === '#ff0000');
  a.dragBackgroundInheritsActive = JSON.stringify(during.rows.find((r: any) => r.id === owned[0]).background) === JSON.stringify(before.rows.find((r: any) => r.id === owned[2]).background);
  a.otherTitleRetainsColor = during.rows.find((r: any) => r.id === owned[1]).cells[0].some((cell: any) => cell[0] === 'N' && cell[1] === '#ff0000');
  await mouse('up', x, dropY);
  await delay(200);
  const after = await capture('drag-after');
  a.pointerReleased = !c.renderer.capturedRenderable && !c.renderer.pressedRenderable;
  a.dropCommitted = JSON.stringify(c.ui.tabs.list().map((t: any)=>t.sessionID)) === JSON.stringify(expectedOrder);
  a.afterTitleColored = after.rows.find((r: any) => r.id === owned[0]).cells[0].some((cell: any) => cell[0] === 'N' && cell[1] === '#ff0000');
  h.stop();
  const originalMouse = c.renderer.root.processMouseEvent;
  const palette: any = {
    openai: {bg:'#112233',activeBg:'#223344',hoverBg:'#334455',sessionFg:'#FF0000',projectFg:'#000000',dragBg:'#556677',dragSessionFg:'#00FF00',dragProjectFg:'#FFFFFF'},
    'fixture-green': {bg:'#221133',activeBg:'#331144',hoverBg:'#441155',sessionFg:'#FF0000',projectFg:'#000000',dragBg:'#660066',dragSessionFg:'#00FFFF',dragProjectFg:'#FFFF00'},
  };
  const cell = (shot: any, id: string, line: number, char: string) => shot.rows.find((r: any) => r.id===id).cells[line].find((v: any)=>v[0]===char);
  const background = (shot: any, id: string) => shot.rows.find((r: any)=>r.id===id).cells[0].at(-1)[2];
  const cycle = async (label: string, id: string, expected: string[], cancel = false) => {
    h.setPalette(palette);h.start();await delay(160);
    const start = await capture(label+'-before'), node = rowOf(id).node;
    const others = owned.filter((other: string)=>other!==id);
    const targetNode=rowOf(others.find((other: string)=>rowOf(other).node.screenY!==node.screenY)!).node;
    const x=node.screenX+5, originY=node.screenY+1, dropY=targetNode.screenY+1;
    await mouse('down',x,originY);await mouse('drag',x,dropY);
    const mid=await capture(label+'-during');
    a[label+'Captured']=!!c.renderer.capturedRenderable;
    a[label+'Background']=background(mid,id)===expected[0];
    a[label+'Title']=cell(mid,id,0,'N')?.[1]===expected[1];
    a[label+'Project']=cell(mid,id,1,'L')?.[1]===expected[2];
    a[label+'OtherTitles']=others.every((other: string)=>cell(mid,other,0,'N')?.[1]==='#ff0000');
    const order=c.ui.tabs.list().map((tab: any)=>tab.sessionID);
    if(cancel){
      // Returning to the original slot before releasing cancels the reorder.
      await mouse('drag',x,originY);
    }
    await mouse('up',x,cancel?originY:dropY);await delay(160);
    const end=await capture(label+'-after');
    a[label+'Released']=!c.renderer.capturedRenderable&&!ctrl().dragID;
    a[label+'TitleRestored']=cell(end,id,0,'N')?.[1]==='#ff0000';
    a[label+'ProjectRestored']=cell(end,id,1,'L')?.[1]==='#000000';
    if(cancel)a[label+'OrderUnchanged']=JSON.stringify(order)===JSON.stringify(c.ui.tabs.list().map((tab: any)=>tab.sessionID));
    h.stop();a[label+'MouseHookRestored']=c.renderer.root.processMouseEvent===originalMouse;
  };
  await cycle('custom',owned[0],['#556677','#00ff00','#ffffff']);
  await cycle('secondProvider',owned[1],['#660066','#00ffff','#ffff00']);
  await cycle('cancelReorder',owned[0],['#556677','#00ff00','#ffffff'],true);
  palette.openai.dragBg=null;palette.openai.dragSessionFg=null;palette.openai.dragProjectFg=null;
  await cycle('nullInherits',owned[0],['#223344','#ff0000','#000000']);
  palette.openai.dragBg='#FFFFFF80';palette.openai.dragSessionFg='#FFFFFF80';palette.openai.dragProjectFg='#FFFFFF00';
  h.setPalette(palette);h.start();await delay(160);
  const alphaNode=rowOf(owned[0]).node, alphaTarget=rowOf(owned[1]).node;
  const alphaX=alphaNode.screenX+5,alphaY=alphaTarget.screenY+1;
  await mouse('down',alphaX,alphaNode.screenY+1);await mouse('drag',alphaX,alphaY);
  const translucent=await capture('drag-alpha');
  const titleCell=cell(translucent,owned[0],0,'N');
  a.alphaTitleBlends=!!titleCell&&titleCell[1]!== '#ffffff'&&titleCell[1]!==titleCell[2];
  a.alphaProjectZero=translucent.rows.find((r:any)=>r.id===owned[0]).cells[1].every((v:any)=>v[0]===' ');
  await mouse('up',alphaX,alphaY);h.stop();
  a.finalMouseHookRestored=c.renderer.root.processMouseEvent===originalMouse;
}
