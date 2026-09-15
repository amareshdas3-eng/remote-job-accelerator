import {supabaseAdmin} from './supabase';
export async function rate(key:string,limit=20,windowMs=60000){
  const bucket=Math.floor(Date.now()/windowMs)*windowMs;
  const a=supabaseAdmin();
  const {data,error}=await a.rpc('consume_rate_limit',{p_key:key,p_bucket:new Date(bucket).toISOString(),p_limit:limit});
  if(error) return true; // availability-first: endpoint still has auth + provider limits
  return data===true;
}
