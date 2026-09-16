import {NextResponse} from 'next/server';
import {requireUser,hasEntitlement} from '../../../lib/auth';
import {supabaseAdmin} from '../../../lib/supabase';

export async function GET(){
  try{
    const u=await requireUser();
    const entitled=await hasEntitlement(u.email||'');
    const a=supabaseAdmin();

    const [p,j,apps,ints]=await Promise.all([
      a.from('profiles').select('resume_text,full_name,headline,resume_filename,resume_mime').eq('id',u.id).maybeSingle(),
      a.from('jobs').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(25),
      a.from('applications').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(50),
      a.from('interviews').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(25)
    ]);

    return NextResponse.json({
      entitled,
      profile:p.data||null,
      jobs:j.data||[],
      applications:apps.data||[],
      interviews:ints.data||[]
    },{headers:{'Cache-Control':'no-store'}});
  }catch(e:any){
    return NextResponse.json(
      {error:e.message==='UNAUTHENTICATED'?'UNAUTHENTICATED':'WORKSPACE_LOAD_FAILED'},
      {status:e.message==='UNAUTHENTICATED'?401:500}
    );
  }
}
