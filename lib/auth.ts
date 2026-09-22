import { SignJWT,jwtVerify } from "jose";import { cookies } from "next/headers";
const key=()=>new TextEncoder().encode(process.env.AUTH_SECRET||"dev-only-change-me");
export async function sessionToken(user:{id:string,email:string,name:string}){return new SignJWT({email:user.email,name:user.name}).setProtectedHeader({alg:"HS256"}).setSubject(user.id).setIssuedAt().setExpirationTime("30d").sign(key())}
export async function currentUser(){try{const c=await cookies(),t=c.get("cd_session")?.value;if(!t)return null;const {payload}=await jwtVerify(t,key());return {id:String(payload.sub),email:String(payload.email),name:String(payload.name)}}catch{return null}}
export async function setSession(token:string){const c=await cookies();c.set("cd_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*24*30})}
export async function clearSession(){const c=await cookies();c.delete("cd_session")}