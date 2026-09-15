import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sameOrigin } from '../../../../lib/security';

const MAX = 5 * 1024 * 1024;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) {
      return jsonError('INVALID_ORIGIN', 403);
    }

    const u = await requireUser();

    let text = '';
    let filename = 'master-resume.txt';
    let mime = 'text/plain';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      text = String(body?.text || '');
      filename = String(body?.filename || filename).slice(0, 180);
      mime = String(body?.mime || mime);
    } else if (contentType.includes('multipart/form-data')) {
      const f = await req.formData();
      const file = f.get('file');

      if (!(file instanceof File)) {
        return jsonError('Resume file is required');
      }

      if (file.size > MAX) {
        return jsonError('Resume exceeds 5 MB', 413);
      }

      filename = file.name.slice(0, 180);
      mime = file.type || 'application/octet-stream';

      const buf = Buffer.from(await file.arrayBuffer());

      if (
        mime === 'text/plain' ||
        filename.toLowerCase().endsWith('.txt')
      ) {
        text = buf.toString('utf8');
      } else if (
        mime === 'application/pdf' ||
        filename.toLowerCase().endsWith('.pdf')
      ) {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buf });
        try {
          const parsed = await parser.getText();
          text = parsed.text;
        } finally {
          await parser.destroy().catch(() => {});
        }
      } else if (
        mime.includes('wordprocessingml') ||
        filename.toLowerCase().endsWith('.docx')
      ) {
        const mammoth = await import('mammoth');
        text = (
          await mammoth.extractRawText({
            buffer: buf
          })
        ).value;
      } else {
        return jsonError('Supported formats: PDF, DOCX, TXT', 415);
      }
    } else {
      return jsonError('Use JSON text or multipart file upload', 415);
    }

    text = text.replace(/\u0000/g, '').trim();

    if (text.length < 80) {
      return jsonError('Could not extract enough resume text', 422);
    }

    if (text.length > 50000) {
      text = text.slice(0, 50000);
    }

    const a = supabaseAdmin();

    const { error } = await a.from('profiles').upsert({
      id: u.id,
      resume_text: text,
      resume_filename: filename,
      resume_mime: mime,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;

    return NextResponse.json(
      {
        saved: true,
        filename,
        characters: text.length
      },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (e: any) {
    console.error('resume_upload', e);

    return jsonError(
      e.message === 'UNAUTHENTICATED'
        ? 'UNAUTHENTICATED'
        : 'RESUME_UPLOAD_FAILED',
      e.message === 'UNAUTHENTICATED' ? 401 : 500
    );
  }
}
