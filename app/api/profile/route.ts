import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { sameOrigin } from '../../../lib/security';
import {
  validateStructuredProfile,
  formatStructuredProfileText,
  embedStructuredProfileInText,
  extractEmbeddedStructuredProfile,
  StructuredProfileData,
} from '../../../lib/profile';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const u = await requireUser();
    const admin = supabaseAdmin();

    // Query profiles for the authenticated user
    let profile: any = null;
    let { data, error } = await admin
      .from('profiles')
      .select('id, resume_text, full_name, headline, resume_filename, resume_mime, updated_at, structured_profile')
      .eq('id', u.id)
      .maybeSingle();
    profile = data;

    // Fallback if column structured_profile does not exist yet in live DB
    if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('structured_profile'))) {
      const fallback = await admin
        .from('profiles')
        .select('id, resume_text, full_name, headline, resume_filename, resume_mime, updated_at')
        .eq('id', u.id)
        .maybeSingle();
      profile = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('profile_get_error', error);
      return jsonError('DATABASE_ERROR', 500);
    }

    let structuredProfile: StructuredProfileData | null = profile?.structured_profile || null;

    // Resilient fallback: extract embedded structured profile from resume_text if column was missing
    if (!structuredProfile && profile?.resume_text) {
      structuredProfile = extractEmbeddedStructuredProfile(profile.resume_text);
    }

    return NextResponse.json(
      {
        profile: profile || null,
        structured_profile: structuredProfile,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return jsonError(
      e.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'PROFILE_LOAD_FAILED',
      e.message === 'UNAUTHENTICATED' ? 401 : 500
    );
  }
}

export async function PUT(req: Request) {
  try {
    if (!sameOrigin(req)) {
      return jsonError('INVALID_ORIGIN', 403);
    }

    const u = await requireUser();
    const body = await req.json();

    // Validate structured profile payload
    const structuredInput = body.structured_profile !== undefined ? body.structured_profile : body;
    const validation = validateStructuredProfile(structuredInput);

    if (!validation.success || !validation.data) {
      return jsonError(validation.error || 'INVALID_PROFILE_PAYLOAD', 400);
    }

    const validData = validation.data;

    // Data version safety: ensure payload contains at least one meaningful career signal
    const hasCareerContent =
      Boolean(validData.full_name?.trim()) ||
      Boolean(validData.headline?.trim()) ||
      Boolean(validData.professional_summary?.trim()) ||
      (validData.target_roles && validData.target_roles.length > 0) ||
      (validData.technical_skills && validData.technical_skills.length > 0) ||
      (validData.employers && validData.employers.length > 0) ||
      Boolean(validData.raw_evidence?.trim());

    if (!hasCareerContent) {
      return jsonError('Profile cannot be empty. Please provide career details before saving.', 400);
    }

    const admin = supabaseAdmin();

    // Retrieve existing profile to preserve resume_text, filename, and prevent data wipe
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, resume_text, resume_filename, resume_mime, full_name, headline')
      .eq('id', u.id)
      .maybeSingle();

    const formattedSummary = formatStructuredProfileText(validData);
    let finalResumeText = existingProfile?.resume_text || formattedSummary;

    // If explicit new resume text passed in body, use it; otherwise update with formatted summary
    if (typeof body.resume_text === 'string' && body.resume_text.trim().length > 0) {
      finalResumeText = body.resume_text.trim();
    } else if (!existingProfile?.resume_text || existingProfile.resume_text.length < 50) {
      finalResumeText = formattedSummary;
    }

    // Embed structured profile in text for backward resilience
    finalResumeText = embedStructuredProfileInText(finalResumeText, validData);

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      id: u.id,
      full_name: validData.full_name || existingProfile?.full_name || '',
      headline: validData.headline || existingProfile?.headline || '',
      resume_text: finalResumeText,
      resume_filename: existingProfile?.resume_filename || 'master-resume.txt',
      resume_mime: existingProfile?.resume_mime || 'text/plain',
      updated_at: now,
      structured_profile: validData,
    };

    // Try upserting with structured_profile column
    let { error: upsertError } = await admin.from('profiles').upsert(updatePayload);

    // If live DB does not have structured_profile column yet (PostgreSQL 42703 / PostgREST PGRST204), upsert without column
    if (upsertError && (upsertError.code === '42703' || upsertError.code === 'PGRST204' || upsertError.message?.includes('structured_profile'))) {
      delete updatePayload.structured_profile;
      const retry = await admin.from('profiles').upsert(updatePayload);
      upsertError = retry.error;
    }

    if (upsertError) {
      console.error('profile_upsert_error', upsertError);
      return jsonError('DATABASE_ERROR', 500);
    }

    return NextResponse.json(
      {
        saved: true,
        structured_profile: validData,
        updated_at: now,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    console.error('profile_put_error', e);
    return jsonError(
      e.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'PROFILE_UPDATE_FAILED',
      e.message === 'UNAUTHENTICATED' ? 401 : 500
    );
  }
}

export async function PATCH(req: Request) {
  return PUT(req);
}
