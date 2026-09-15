import {NextResponse} from 'next/server';
export function jsonError(message:string,status=400){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin'); if(!origin) return true;
 try{return new URL(origin).origin===new URL(process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000').origin}catch{return false}
}
export function contentLengthOk(req:Request,max=1_500_000){const n=Number(req.headers.get('content-length')||0);return !n||n<=max}
