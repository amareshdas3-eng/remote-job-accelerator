import {NextResponse} from 'next/server';
import {requireUser,hasEntitlement} from '../../../lib/auth';
import {supabaseAdmin} from '../../../lib/supabase';

export async function GET(){
  try{
    const u=await requireUser();
    const entitled=await hasEntitlement(u.email||'');
    const a=supabaseAdmin();

    let [p,j,apps,ints]: any[] = await Promise.all([
      a.from('profiles').select('resume_text,full_name,headline,resume_filename,resume_mime,structured_profile').eq('id',u.id).maybeSingle(),
      a.from('jobs').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(25),
      a.from('applications').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(50),
      a.from('interviews').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(25)
    ]);

    // Resilient fallback if structured_profile column is not present yet
    if (p.error && (p.error.code === '42703' || p.error.code === 'PGRST204' || p.error.message?.includes('structured_profile'))) {
      const fallback = await a.from('profiles').select('resume_text,full_name,headline,resume_filename,resume_mime').eq('id',u.id).maybeSingle();
      p = fallback;
    }

    let profileData = p.data || null;
    let structuredProfile = profileData?.structured_profile || null;
    if (!structuredProfile && profileData?.resume_text) {
      const { extractEmbeddedStructuredProfile } = await import('../../../lib/profile');
      structuredProfile = extractEmbeddedStructuredProfile(profileData.resume_text);
      if (profileData && structuredProfile) {
        profileData.structured_profile = structuredProfile;
      }
    }

    return NextResponse.json({
      entitled,
      profile:profileData,
      structured_profile:structuredProfile,
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
