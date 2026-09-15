import crypto from 'node:crypto'; import {SignJWT,jwtVerify} from 'jose';
const key=()=>new TextEncoder().encode(process.env.EXTENSION_JWT_SECRET!);
export function hashCode(code:string){return crypto.createHash('sha256').update(code).digest('hex')}
export async function extToken(sub:string){return new SignJWT({scope:'extension'}).setProtectedHeader({alg:'HS256'}).setSubject(sub).setIssuedAt().setExpirationTime('15m').sign(key())}
export async function verifyExt(t:string){const {payload}=await jwtVerify(t,key());if(payload.scope!=='extension'||!payload.sub)throw new Error('invalid');return payload.sub as string}
