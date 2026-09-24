import { NextResponse } from 'next/server';
import { requireUser, hasEntitlement } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../lib/security';
import { logger } from '../../../lib/logger';

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

export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const requestId = req.headers.get('x-request-id') || undefined;

    const { data, error } = await supabaseAdmin()
      .from('applications')
      .select('*')
      .eq('user_id', u.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    logger.info('applications_fetch', { requestId, userId: u.id, count: data?.length || 0 });
    return NextResponse.json({ applications: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    logger.error('applications_fetch_failed', {}, e);
    return jsonError('UNAUTHENTICATED', 401);
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!(await hasEntitlement(u.email || ''))) return jsonError('PRO_REQUIRED', 402);
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const requestId = req.headers.get('x-request-id') || undefined;
    const b = await req.json();
    const status = statuses.includes(String(b.status)) ? String(b.status) : 'saved';
    const admin = supabaseAdmin();

    // Idempotent upsert: check if application already exists for this job_id or (company, role)
    let existing: any = null;
    if (b.job_id) {
      const { data } = await admin
        .from('applications')
        .select('*')
        .eq('user_id', u.id)
        .eq('job_id', b.job_id)
        .maybeSingle();
      existing = data;
    } else if (b.company && b.role) {
      const { data } = await admin
        .from('applications')
        .select('*')
        .eq('user_id', u.id)
        .eq('company', b.company)
        .eq('role', b.role)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      const patch: any = {
        updated_at: new Date().toISOString(),
        status: b.status && statuses.includes(b.status) ? b.status : existing.status,
      };
      if (b.notes !== undefined) patch.notes = String(b.notes || '').slice(0, 5000);
      if (b.route) patch.route = String(b.route).slice(0, 100);
      if (b.route_details || b.offer_details) {
        patch.route_details = {
          ...(existing.route_details || {}),
          ...(b.route_details || {}),
          ...(b.offer_details ? { offer: b.offer_details } : {})
        };
      }
      if (b.applied_at) {
        patch.applied_at = b.applied_at;
      } else if (patch.status === 'applied' && !existing.applied_at) {
        patch.applied_at = new Date().toISOString();
      }
      if (b.next_action) patch.next_action = String(b.next_action).slice(0, 500);
      if (b.next_action_date) patch.next_action_date = b.next_action_date;

      const { data: updated, error: updateError } = await admin
        .from('applications')
        .update(patch)
        .eq('id', existing.id)
        .eq('user_id', u.id)
        .select()
        .single();

      if (updateError) throw updateError;
      logger.info('application_upsert_update', { requestId, userId: u.id, applicationId: existing.id, status: patch.status });
      return NextResponse.json({ application: updated }, { status: 200 });
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
        route_details: b.route_details || (b.offer_details ? { offer: b.offer_details } : {}),
        applied_at: b.applied_at || (status === 'applied' ? new Date().toISOString() : null),
        next_action: b.next_action ? String(b.next_action).slice(0, 500) : null,
        next_action_date: b.next_action_date || null,
      })
      .select()
      .single();

    if (error) throw error;
    logger.info('application_create_success', { requestId, userId: u.id, applicationId: data?.id, status });
    return NextResponse.json({ application: data }, { status: 201 });
  } catch (e: any) {
    logger.error('application_create_failed', {}, e);
    return jsonError('APPLICATION_CREATE_FAILED', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const u = await requireUser();
    if (!(await hasEntitlement(u.email || ''))) return jsonError('PRO_REQUIRED', 402);
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const requestId = req.headers.get('x-request-id') || undefined;
    const b = await req.json();
    if (!b.id) return jsonError('Application id required', 400);

    // Validate lifecycle status if provided
    if ('status' in b && !statuses.includes(String(b.status))) {
      return jsonError('INVALID_STATUS', 400);
    }

    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of ['company', 'role', 'job_url', 'notes', 'route', 'next_action']) {
      if (k in b) patch[k] = String(b[k] || '').slice(0, k === 'notes' ? 5000 : 1000);
    }
    if ('status' in b) {
      patch.status = b.status;
      if (b.status === 'applied' && !b.applied_at) {
        patch.applied_at = new Date().toISOString();
      }
    }
    if ('route_details' in b || 'offer_details' in b) {
      patch.route_details = {
        ...(b.route_details || {}),
        ...(b.offer_details ? { offer: b.offer_details } : {})
      };
    }
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
    logger.info('application_patch_success', { requestId, userId: u.id, applicationId: b.id, status: patch.status });
    return NextResponse.json({ application: data });
  } catch (e: any) {
    logger.error('application_patch_failed', {}, e);
    return jsonError('APPLICATION_UPDATE_FAILED', 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const u = await requireUser();
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const requestId = req.headers.get('x-request-id') || undefined;
    const url = new URL(req.url);
    let id = url.searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return jsonError('Application id is required', 400);
    }

    const { error } = await supabaseAdmin()
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', u.id);

    if (error) throw error;

    logger.info('application_delete_success', { requestId, userId: u.id, applicationId: id });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    logger.error('application_delete_failed', {}, e);
    return jsonError('APPLICATION_DELETE_FAILED', 500);
  }
}
