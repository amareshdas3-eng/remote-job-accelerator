// app/api/telemetry/route.ts
// Ingests client-side funnel telemetry events with user context

import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase';
import { trackServerEvent, FunnelEvent } from '../../../lib/analytics';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body.event as FunnelEvent;
    const properties = body.properties || {};

    if (!event) {
      return NextResponse.json({ error: 'EVENT_REQUIRED' }, { status: 400 });
    }

    let userId: string | undefined;
    try {
      const s = await supabaseServer();
      const { data: { user } } = await s.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch {
      // Unauthenticated client event (e.g. landing_view, signup_started)
    }

    await trackServerEvent(event, properties, userId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'TELEMETRY_FAILED' }, { status: 500 });
  }
}
