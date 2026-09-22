'use strict';
// Same-origin gateway: the Data API role can execute one RPC, not read private tables.
const ENDPOINT='https://ep-divine-rice-adqxt183.apirest.c-2.us-east-1.aws.neon.tech/corrupt_drive/rest/v1/rpc/rpc';
const ACTIONS=new Set(['register','login','recover','session','load','save','logout']);
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Cookie');
 const secure=process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL),name=secure?'__Host-cd_session':'cd_session';
 const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 try{
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{ok:false,error:'Method not allowed.'});}
  const health=req.method==='GET'&&req.query?.health==='1';let action=health?'health':'session',body={};
  if(req.method==='POST'){
   const expected=(secure?'https://':'http://')+req.headers.host;
   if(req.headers.origin!==expected||req.headers['sec-fetch-site']==='cross-site')return send(403,{ok:false,error:'Open the game directly to continue.'});
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{ok:false,error:'JSON is required.'});
   if(Number(req.headers['content-length']||0)>510000)return send(413,{ok:false,error:'Save is too large.'});
   body=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>510000)return send(400,{ok:false,error:'Invalid request.'});
   action=body.action;if(!ACTIONS.has(action))return send(400,{ok:false,error:'Unknown operation.'});
  }
  const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
  const payload=['register','login','recover'].includes(action)?{username:body.username,password:body.password,recovery:body.recovery}:{token};
  if(action==='save'){payload.state=body.state;payload.revision=body.revision;}
  if(!health&&!['register','login','recover'].includes(action)&&!token)return send(401,{ok:false,error:'Please sign in.'});
  const upstream=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Content-Profile':'game_api','Accept-Profile':'game_api'},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(18000)});
  if(!upstream.ok)return send(503,{ok:false,error:'Cloud storage is unavailable. Keep this tab open; your local backup is retained.'});
  const data=await upstream.json();if(!data||typeof data!=='object'||typeof data.ok!=='boolean')return send(503,{ok:false,error:'Cloud storage returned an invalid response.'});
  if(data.token){if(!/^[a-f0-9]{64}$/.test(data.token))return send(503,{ok:false,error:'Session could not be created.'});res.setHeader('Set-Cookie',`${name}=${data.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure?'; Secure':''}`);delete data.token;}
  if(action==='logout'&&data.ok)res.setHeader('Set-Cookie',`${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);
  return send(data.ok?200:([400,401,409,413,429].includes(data.code)?data.code:400),data);
 }catch(error){return send(error instanceof SyntaxError?400:503,{ok:false,error:error instanceof SyntaxError?'Invalid JSON.':'Cannot reach cloud storage. Your local backup is retained.'});}
};
