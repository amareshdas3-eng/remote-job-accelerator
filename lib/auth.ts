import { supabaseServer, supabaseAdmin } from './supabase';
export async function requireUser(){const s=await supabaseServer();const {data:{user},error}=await s.auth.getUser();if(error||!user)throw new Error('UNAUTHENTICATED');return user}
export async function hasEntitlement(email:string){const {data}=await supabaseAdmin().from('entitlements').select('status,expires_at').eq('email',email.toLowerCase()).eq('product','remote-job-complete').maybeSingle();return !!data&&data.status==='active'&&(!data.expires_at||new Date(data.expires_at)>new Date())}
export async function requirePro(){const u=await requireUser();if(!(await hasEntitlement(u.email||'')))throw new Error('PRO_REQUIRED');return u}
