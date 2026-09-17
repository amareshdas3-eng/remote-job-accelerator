import { NextResponse } from 'next/server';
import { requireUser, hasEntitlement } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../lib/security';

const statuses = [
  'saved',
  'selected',
  'in_progress',
  'ready_to_apply',
  'applied',
  'follow_up',
  'screening',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
  'closed',
];

export async function GET() {
  try {
    const u = await requireUser();
    const { data, error } = await supabaseAdmin()
      .from('applications')
      .select('*')
      .eq('user_id', u.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ applications: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('UNAUTHENTICATED', 401);
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!(await hasEntitlement(u.email || ''))) return jsonError('PRO_REQUIRED', 402);
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const b = await req.json();
    const status = statuses.includes(String(b.status)) ? String(b.status) : 'saved';
    const admin = supabaseAdmin();

    // Check if an application already exists for this job_id and user
    if (b.job_id) {
      const { data: existing } = await admin
        .from('applications')
        .select('*')
        .eq('user_id', u.id)
        .eq('job_id', b.job_id)
        .maybeSingle();

      if (existing) {
        const patch: any = {
          updated_at: new Date().toISOString(),
          status,
        };
        if (b.notes) patch.notes = String(b.notes).slice(0, 5000);
        if (b.route) patch.route = String(b.route).slice(0, 100);
        if (b.route_details) patch.route_details = b.route_details;
        if (b.applied_at) patch.applied_at = b.applied_at;
        if (b.next_action) patch.next_action = String(b.next_action).slice(0, 500);
        if (b.next_action_date) patch.next_action_date = b.next_action_date;

        const { data: updated, error: updateError } = await admin
          .from('applications')
          .update(patch)
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return NextResponse.json({ application: updated }, { status: 200 });
      }
    }

    const { data, error } = await admin
      .from('applications')
      .insert({
        user_id: u.id,
        company: String(b.company || '').slice(0, 200),
        role: String(b.role || '').slice(0, 200),
        job_id: b.job_id || null,
        job_url: String(b.job_url || '').slice(0, 1000),
        status,
        notes: String(b.notes || '').slice(0, 5000),
        route: b.route ? String(b.route).slice(0, 100) : 'website',
        route_details: b.route_details || {},
        applied_at: b.applied_at || null,
        next_action: b.next_action ? String(b.next_action).slice(0, 500) : null,
        next_action_date: b.next_action_date || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ application: data }, { status: 201 });
  } catch (e) {
    console.error(e);
    return jsonError('APPLICATION_CREATE_FAILED', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const u = await requireUser();
    if (!(await hasEntitlement(u.email || ''))) return jsonError('PRO_REQUIRED', 402);
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const b = await req.json();
    if (!b.id) return jsonError('Application id required', 400);

    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of ['company', 'role', 'job_url', 'notes', 'route', 'next_action']) {
      if (k in b) patch[k] = String(b[k] || '').slice(0, k === 'notes' ? 5000 : 1000);
    }
    if ('status' in b && statuses.includes(String(b.status))) {
      patch.status = b.status;
      if (b.status === 'applied' && !b.applied_at) {
        patch.applied_at = new Date().toISOString();
      }
    }
    if ('route_details' in b) patch.route_details = b.route_details;
    if ('applied_at' in b) patch.applied_at = b.applied_at;
    if ('next_action_date' in b) patch.next_action_date = b.next_action_date;

    const { data, error } = await supabaseAdmin()
      .from('applications')
      .update(patch)
      .eq('id', b.id)
      .eq('user_id', u.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch (e) {
    console.error(e);
    return jsonError('APPLICATION_UPDATE_FAILED', 500);
  }
}
