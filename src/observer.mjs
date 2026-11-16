export function readObservedState(context){
 const tabs=context.ui.tabs.list().map(t=>({...t}));
 for(const tab of tabs){const s=context.data.session.get(tab.sessionID);s?.model?.providerID;s?.model?.id;s?.model?.modelID;s?.model?.variant;s?.agent;}
 const route={...context.ui.router.current()},selected=context.ui.model.current();
 const providers=context.data.location.provider.list(context.location),providerID=selected?.providerID;
 const providerLabel=providerID===undefined?undefined:providers?.find(p=>p.id===providerID)?.name??providerID;
 context.theme.background.raised.base;context.theme.background.raised.high;context.theme.background.action.primary.selected;
 return {tabs,route,selected:selected?{...selected}:undefined,providerLabel};
}
