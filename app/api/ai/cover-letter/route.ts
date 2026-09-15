import {NextResponse} from 'next/server';
import {requirePro} from '../../../../lib/auth';
import {ai,safeJson} from '../../../../lib/ai';
import {rate} from '../../../../lib/rate';
import {sameOrigin} from '../../../../lib/security';
import {supabaseAdmin} from '../../../../lib/supabase';
export async function POST(req:Request){
 try{
  const u=await requirePro();
  if(!sameOrigin(req)) return NextResponse.json({error:'INVALID_ORIGIN'},{status:403});
  if(!rate('cover-letter:'+u.id)) return NextResponse.json({error:'RATE_LIMIT'},{status:429});
  const b=await req.json(); const resume=String(b.resume||'').slice(0,30000),job=String(b.job||'').slice(0,30000);
  if(!resume||!job) return NextResponse.json({error:'Job and resume evidence are required.'},{status:400});
  const raw=await ai('You are an evidence-first career writer. Return ONLY valid JSON with keys subject, letter, evidence_used (array), gaps (array). Write a concise professional cover letter grounded only in the supplied evidence. Never invent employers, degrees, technologies, metrics, dates, titles or outcomes. If a job requirement cannot be supported, leave it out and list it in gaps.','Create a tailored cover letter for this role. RESUME EVIDENCE:\n'+resume+'\nJOB DESCRIPTION:\n'+job);
  const result=safeJson(raw);
  if(b.job_id) await supabaseAdmin().from('jobs').update({cover_letter:result,updated_at:new Date().toISOString()}).eq('id',b.job_id).eq('user_id',u.id);
  return NextResponse.json(result);
 }catch(e:any){const status=e.message==='PRO_REQUIRED'?402:e.message==='UNAUTHENTICATED'?401:500;return NextResponse.json({error:e.message==='PRO_REQUIRED'?'PRO_REQUIRED':'COVER_LETTER_FAILED'},{status})}
}
