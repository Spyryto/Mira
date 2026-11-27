// Optional same-origin loopback capability. The fragment never goes to the server.
const session=location.hostname==='127.0.0.1'&&location.hash.match(/^#desktop=([a-f0-9]{48})$/)?.[1];
export const desktopEnabled=Boolean(session);
async function request(path,body){
 const response=await fetch('/_desktop/'+path,{method:body?'POST':'GET',headers:{'X-Mira-Session':session,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Desktop host unavailable.');return data;
}
export const openDesktop=()=>request('project');
export const saveDesktop=(file,expected)=>request('save',{...file,expected});
