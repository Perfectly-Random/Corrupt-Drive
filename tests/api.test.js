'use strict';
const assert=require('node:assert/strict');
process.env.NODE_ENV='production';
const handler=require('../api/account');
let count=0,requests=[];
async function call(method='POST',body={action:'session'},headers={},upstream={ok:true,user:{id:'u1',username:'echo'},revision:0,state:{}}){
 requests=[];global.fetch=async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>structuredClone(upstream)}};
 const out={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}};
 const req={method,body,query:{},headers:{host:'corrupt-drive.vercel.app',origin:'https://corrupt-drive.vercel.app','sec-fetch-site':'same-origin','content-type':'application/json',cookie:'__Host-cd_session='+'a'.repeat(64),...headers}};
 await handler(req,out);count++;return out;
}
(async()=>{
 assert.equal((await call('POST',{action:'save'},{origin:'https://attacker.invalid'})).statusCode,403);assert.equal(requests.length,0);
 assert.equal((await call('POST',{action:'session'},{'sec-fetch-site':'cross-site'})).statusCode,403);
 assert.equal((await call('POST',{action:'session'},{'content-type':'text/plain'})).statusCode,415);
 assert.equal((await call('PUT')).statusCode,405);
 assert.equal((await call('POST',{action:'session'},{cookie:''})).statusCode,401);
 assert.equal((await call('POST',{action:'save'},{'content-length':'510001'})).statusCode,413);
 assert.equal((await call('POST','{')).statusCode,400);
 assert.equal((await call('POST',[])).statusCode,400);
 assert.equal((await call('POST',{action:'admin'})).statusCode,400);
 const login=await call('POST',{action:'login',username:'echo',password:'test-password'},{cookie:''},{ok:true,token:'b'.repeat(64),user:{id:'u1',username:'echo'},revision:0,state:{}});
 assert.equal(login.statusCode,200);assert.ok(!('token'in login.body));assert.match(login.headers['Set-Cookie'],/^__Host-cd_session=/);assert.match(login.headers['Set-Cookie'],/HttpOnly/);assert.match(login.headers['Set-Cookie'],/Secure/);assert.match(login.headers['Set-Cookie'],/SameSite=Strict/);
 const saved=await call('POST',{action:'save',token:'c'.repeat(64),userId:'other',revision:1,state:{version:2,stats:{}}});assert.equal(saved.statusCode,200);const payload=JSON.parse(requests[0].init.body);assert.equal(payload.payload.token,'a'.repeat(64));assert.ok(!('userId'in payload.payload));assert.match(requests[0].init.headers.Authorization,/^Bearer /);
 const conflict=await call('POST',{action:'save'},{},{ok:false,code:409,error:'Newer revision'});assert.equal(conflict.statusCode,409);
 const logout=await call('POST',{action:'logout'},{},{ok:true});assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
 const malformed=await call('POST',{action:'login'},{},{ok:true,token:'bad'});assert.equal(malformed.statusCode,503);
 assert.equal(login.headers['Cache-Control'],'no-store, private');
 console.log(`${count} API gateway cases passed: origin, methods, size, input, secure cookies, session ownership, conflict and logout.`);
})().catch(e=>{console.error(e);process.exit(1);});
