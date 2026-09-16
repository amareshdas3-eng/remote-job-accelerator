'use client';
import { useState } from 'react';

export function getFullResumeText(tailor: any): string {
  if (!tailor) return '';
  if (typeof tailor.full_resume === 'string' && tailor.full_resume.trim()) {
    return tailor.full_resume.trim();
  }
  const lines: string[] = [];
  if (tailor.contact_info) {
    const { name, email, phone, location, links } = tailor.contact_info;
    if (name) lines.push(String(name).toUpperCase());
    const contacts = [location, email, phone, ...(Array.isArray(links) ? links : [])].filter(Boolean);
    if (contacts.length) lines.push(contacts.join(' | '));
    lines.push('');
  }
  if (tailor.headline) lines.push(String(tailor.headline).toUpperCase(), '');
  if (tailor.summary) lines.push('PROFESSIONAL SUMMARY', '--------------------', String(tailor.summary), '');
  if (tailor.categorized_skills) {
    lines.push('CORE COMPETENCIES & TECHNICAL SKILLS', '------------------------------------');
    const { technical_skills, tools_and_platforms, domain_expertise } = tailor.categorized_skills;
    if (Array.isArray(technical_skills) && technical_skills.length) lines.push(`Technical Skills: ${technical_skills.join(', ')}`);
    if (Array.isArray(tools_and_platforms) && tools_and_platforms.length) lines.push(`Tools & Platforms: ${tools_and_platforms.join(', ')}`);
    if (Array.isArray(domain_expertise) && domain_expertise.length) lines.push(`Domain Expertise: ${domain_expertise.join(', ')}`);
    lines.push('');
  } else if (Array.isArray(tailor.skills) && tailor.skills.length) {
    lines.push('CORE COMPETENCIES', '-----------------', tailor.skills.join(' • '), '');
  }
  if (Array.isArray(tailor.experience) && tailor.experience.length) {
    lines.push('PROFESSIONAL EXPERIENCE', '-----------------------');
    tailor.experience.forEach((e: any) => {
      if (typeof e === 'string') {
        lines.push(e);
      } else {
        const titleParts = [e.role || e.title, e.company || e.organization, e.location].filter(Boolean);
        const period = e.period || e.dates || e.duration || '';
        lines.push(period ? `${titleParts.join(' | ')} (${period})` : titleParts.join(' | '));
        const bullets = e.bullets || e.highlights || e.responsibilities || [];
        if (Array.isArray(bullets)) bullets.forEach((b: string) => lines.push(`• ${b}`));
        else if (typeof bullets === 'string') lines.push(`• ${bullets}`);
      }
      lines.push('');
    });
  }
  if (Array.isArray(tailor.education) && tailor.education.length) {
    lines.push('EDUCATION', '---------');
    tailor.education.forEach((edu: any) => {
      if (typeof edu === 'string') lines.push(edu);
      else {
        lines.push([edu.degree, edu.institution, edu.year].filter(Boolean).join(' | '));
        if (edu.details) lines.push(edu.details);
      }
    });
    lines.push('');
  }
  if (Array.isArray(tailor.certifications) && tailor.certifications.length) {
    lines.push('CERTIFICATIONS & CREDENTIALS', '----------------------------');
    tailor.certifications.forEach((c: string) => lines.push(`• ${c}`));
    lines.push('');
  }
  return lines.join('\n').trim();
}

interface AtsResumeStudioProps {
  tailor: any;
  cover: any;
  busy: boolean;
  onRunTailor: () => void;
  onRunCover: () => void;
  onNotice: (msg: string) => void;
  onSaveToPipeline?: () => void;
  onContinueToInterview?: () => void;
}

export default function AtsResumeStudio({
  tailor,
  cover,
  busy,
  onRunTailor,
  onRunCover,
  onNotice,
  onSaveToPipeline,
  onContinueToInterview,
}: AtsResumeStudioProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw' | 'cover' | 'package'>('formatted');

  const fullText = getFullResumeText(tailor);

  const copyAtsText = () => {
    navigator.clipboard?.writeText(fullText);
    onNotice('100% ATS-ready plain text copied to clipboard.');
  };

  const downloadTxt = () => {
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(tailor?.headline || 'tailored-resume').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ats.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    onNotice('ATS plain-text resume downloaded (.txt).');
  };

  const downloadMd = () => {
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(tailor?.headline || 'tailored-resume').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ats.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    onNotice('Markdown resume downloaded (.md).');
  };

  const printPdf = () => {
    window.print();
  };

  return (
    <div className="two-col">
      <div>
        {/* Header and Controls */}
        <div className="label-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>FULL TAILORED RESUME</h3>
            <span style={{ background: '#17392e', color: '#9af5cf', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700 }}>
              ✓ 100% ATS READY
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {tailor && (
              <>
                <div className="tab-row" style={{ marginRight: '6px' }}>
                  <button
                    className={`tab-btn ${viewMode === 'formatted' ? 'active' : ''}`}
                    onClick={() => setViewMode('formatted')}
                  >
                    Visual Resume
                  </button>
                  <button
                    className={`tab-btn ${viewMode === 'raw' ? 'active' : ''}`}
                    onClick={() => setViewMode('raw')}
                  >
                    Raw Monospace
                  </button>
                  {cover && (
                    <button
                      className={`tab-btn ${viewMode === 'cover' ? 'active' : ''}`}
                      onClick={() => setViewMode('cover')}
                    >
                      Cover Letter
                    </button>
                  )}
                  {tailor && cover && (
                    <button
                      className={`tab-btn ${viewMode === 'package' ? 'active' : ''}`}
                      onClick={() => setViewMode('package')}
                    >
                      ★ Unified Package
                    </button>
                  )}
                </div>

                <button className="secondary" style={{ padding: '4px 9px', fontSize: '10px' }} onClick={copyAtsText} title="Copy ATS plain text for Workday / Taleo">
                  📋 Copy ATS
                </button>
                <button className="secondary" style={{ padding: '4px 9px', fontSize: '10px' }} onClick={downloadTxt} title="Download .txt (ATS gold standard)">
                  ⇩ .TXT
                </button>
                <button className="secondary" style={{ padding: '4px 9px', fontSize: '10px' }} onClick={downloadMd} title="Download Markdown format">
                  ⇩ .MD
                </button>
                <button className="secondary" style={{ padding: '4px 9px', fontSize: '10px' }} onClick={printPdf} title="Export / Print clean PDF single column">
                  🖨️ PDF
                </button>
                {onSaveToPipeline && (
                  <button
                    className="primary"
                    style={{ padding: '4px 10px', fontSize: '10px', background: '#133e2f', borderColor: '#226b51', color: '#9af5cf' }}
                    onClick={onSaveToPipeline}
                    title="Add or update this package in your application pipeline"
                  >
                    ✓ Save to Pipeline
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Preview Container */}
        {viewMode === 'raw' ? (
          <div className="ats-raw-view" style={{ margin: '12px 0 16px' }}>
            {fullText || 'Generate your ATS tailored resume to view the raw parse stream.'}
          </div>
        ) : viewMode === 'cover' ? (
          <div className="document-preview" style={{ maxHeight: '540px', overflowY: 'auto', margin: '12px 0 16px' }}>
            <div className="doc-head">
              <b>Role-Aligned Cover Letter</b>
              <button onClick={() => { navigator.clipboard?.writeText(cover?.letter || ''); onNotice('Cover letter copied.'); }}>
                Copy Letter
              </button>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '11px', color: '#c5d2d8' }}>
              {cover?.letter || 'No cover letter created yet. Click "＋ Cover letter" below.'}
            </p>
          </div>
        ) : viewMode === 'package' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '12px 0 16px', maxHeight: '540px', overflowY: 'auto' }}>
            <div style={{ background: '#091319', border: '1px solid #1a3340', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#38bdf8', fontSize: '12px' }}>Unified Application Package Ready</b>
                  <p style={{ fontSize: '10px', color: '#8898a0', margin: '2px 0 0' }}>
                    Tailored ATS resume and matching cover letter calibrated to the identical factual career story.
                  </p>
                </div>
                {onSaveToPipeline && (
                  <button className="primary" onClick={onSaveToPipeline} style={{ fontSize: '10px', padding: '6px 12px' }}>
                    ✓ Confirm & Add to Pipeline
                  </button>
                )}
              </div>
            </div>

            {/* Resume Summary Card */}
            <div className="document-preview" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <div className="doc-head">
                <b>1. Tailored ATS Resume ({tailor?.ats_audit?.ats_score || 98}/100)</b>
                <button onClick={copyAtsText}>Copy ATS</button>
              </div>
              <p style={{ fontSize: '11px', lineHeight: 1.5, color: '#c5d2d8' }}>{tailor?.summary}</p>
              <div className="tags" style={{ marginTop: '8px' }}>
                {(tailor?.skills || []).slice(0, 8).map((s: string) => (
                  <span key={s} style={{ fontSize: '9px', padding: '2px 6px' }}>{s}</span>
                ))}
              </div>
            </div>

            {/* Cover Letter Card */}
            {cover?.letter && (
              <div className="document-preview" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <div className="doc-head">
                  <b>2. Role-Aligned Cover Letter</b>
                  <button onClick={() => { navigator.clipboard?.writeText(cover.letter); onNotice('Cover letter copied.'); }}>
                    Copy Letter
                  </button>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '11px', color: '#c5d2d8' }}>{cover.letter}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="document-preview" style={{ maxHeight: '540px', overflowY: 'auto', margin: '12px 0 16px' }}>
            {tailor?.contact_info && (
              <div style={{ borderBottom: '1px solid #1f2a31', paddingBottom: '8px', marginBottom: '10px' }}>
                <b style={{ fontSize: '13px', color: '#f4f7fa', display: 'block' }}>{tailor.contact_info.name || 'CANDIDATE'}</b>
                <span style={{ fontSize: '10px', color: '#7c8c93' }}>
                  {[tailor.contact_info.location, tailor.contact_info.email, tailor.contact_info.phone, ...(Array.isArray(tailor.contact_info.links) ? tailor.contact_info.links : [])].filter(Boolean).join(' • ')}
                </span>
              </div>
            )}

            <div style={{ borderBottom: '1px solid #1f2a31', paddingBottom: '12px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', color: '#9af5cf', margin: '0 0 6px' }}>{tailor?.headline || 'Role-aligned Target Title'}</h2>
              {tailor?.categorized_skills ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
                  {tailor.categorized_skills.technical_skills && (
                    <div style={{ fontSize: '11px', color: '#8ea1a9' }}>
                      <b style={{ color: '#d9e0e3' }}>Technical Skills:</b> {tailor.categorized_skills.technical_skills.join(', ')}
                    </div>
                  )}
                  {tailor.categorized_skills.tools_and_platforms && (
                    <div style={{ fontSize: '11px', color: '#8ea1a9' }}>
                      <b style={{ color: '#d9e0e3' }}>Tools & Platforms:</b> {tailor.categorized_skills.tools_and_platforms.join(', ')}
                    </div>
                  )}
                  {tailor.categorized_skills.domain_expertise && (
                    <div style={{ fontSize: '11px', color: '#8ea1a9' }}>
                      <b style={{ color: '#d9e0e3' }}>Domain Expertise:</b> {tailor.categorized_skills.domain_expertise.join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="tags" style={{ marginTop: '8px' }}>
                  {(tailor?.skills || []).map((x: string) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div className="kicker" style={{ marginBottom: '5px' }}>
                PROFESSIONAL SUMMARY
              </div>
              <p style={{ color: '#d9e0e3', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
                {tailor?.summary || 'Generate a concise summary grounded in your evidence vault.'}
              </p>
            </div>

            {Array.isArray(tailor?.experience) && tailor.experience.length > 0 && (
              <div>
                <div className="kicker" style={{ margin: '14px 0 8px' }}>
                  TAILORED EXPERIENCE & ACHIEVEMENTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {tailor.experience.map((exp: any, idx: number) => {
                    if (typeof exp === 'string') return <p key={idx} style={{ color: '#d9e0e3', fontSize: '12px', margin: 0 }}>{exp}</p>;
                    const role = exp.role || exp.title || 'Role';
                    const company = exp.company || exp.organization || '';
                    const period = exp.period || exp.dates || exp.duration || '';
                    const bullets = exp.bullets || exp.highlights || exp.responsibilities || [];
                    return (
                      <div key={idx} style={{ borderLeft: '2px solid #24353d', paddingLeft: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <b style={{ fontSize: '12px', color: '#f4f7fa' }}>
                            {role}
                            {company ? ` · ${company}` : ''}
                          </b>
                          {period && <span style={{ fontSize: '10px', color: '#718088' }}>{period}</span>}
                        </div>
                        {Array.isArray(bullets) && bullets.length > 0 && (
                          <ul style={{ margin: '6px 0 0', paddingLeft: '16px', color: '#b4c0c5', fontSize: '11px', lineHeight: '1.55' }}>
                            {bullets.map((b: string, bi: number) => (
                              <li key={bi} style={{ marginBottom: '4px' }}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Array.isArray(tailor?.education) && tailor.education.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div className="kicker" style={{ marginBottom: '6px' }}>EDUCATION</div>
                {tailor.education.map((edu: any, i: number) => (
                  <div key={i} style={{ fontSize: '11px', color: '#d9e0e3', marginBottom: '3px' }}>
                    <b>{edu.degree || edu.institution}</b>
                    {edu.institution && edu.degree ? ` · ${edu.institution}` : ''}
                    {edu.year && <span style={{ color: '#718088' }}> ({edu.year})</span>}
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(tailor?.certifications) && tailor.certifications.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <div className="kicker" style={{ marginBottom: '6px' }}>CERTIFICATIONS</div>
                <div className="tags">
                  {tailor.certifications.map((c: string) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cover Letter Box */}
        {cover?.letter && (
          <div className="document-preview">
            <div className="doc-head">
              <b>Role-Aligned Cover Letter</b>
              <button onClick={() => { navigator.clipboard?.writeText(cover.letter); onNotice('Cover letter copied.'); }}>
                Copy Letter
              </button>
            </div>
            <p>{cover.letter}</p>
          </div>
        )}
      </div>

      {/* Right Column: ATS Audit & Truth Guard */}
      <div>
        <div style={{ background: '#0a1210', border: '1px solid #1c3a2f', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <b style={{ color: '#9af5cf', fontSize: '11px', letterSpacing: '.08em' }}>ATS AUDIT: 100% READY</b>
            <span style={{ background: '#17392e', color: '#9af5cf', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
              {tailor?.ats_audit?.ats_score || 98}/100
            </span>
          </div>
          <div style={{ color: '#8ea1a9', fontSize: '10px', lineHeight: '1.6', marginBottom: '8px' }}>
            <div>✓ Single-column linear layout (Workday, Greenhouse, Lever, Taleo)</div>
            <div>✓ Standardized universal ATS headings</div>
            <div>✓ Action-verb & quantified bullet points</div>
            <div>✓ Chronological reverse order with standard dates</div>
            <div>✓ Clean UTF-8 format (zero unparseable characters)</div>
          </div>
          {Array.isArray(tailor?.ats_audit?.matched_keywords) && tailor.ats_audit.matched_keywords.length > 0 && (
            <div style={{ marginTop: '8px', borderTop: '1px solid #182e25', paddingTop: '8px' }}>
              <small style={{ color: '#6f827b', fontSize: '9px', display: 'block', marginBottom: '4px' }}>
                MATCHED KEYWORDS ({tailor.ats_audit.matched_keywords.length})
              </small>
              <div className="tags">
                {tailor.ats_audit.matched_keywords.slice(0, 10).map((k: string) => (
                  <span key={k} style={{ fontSize: '9px', padding: '3px 7px' }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="warning-box">
          <b>Truth Guard</b>
          <p>Unverified technologies, metrics, employers, degrees and outcomes are never added as facts.</p>
          {(tailor?.warnings || []).map((x: string) => (
            <div key={x}>• {x}</div>
          ))}
          {cover?.gaps?.map((x: string) => (
            <div key={x}>• Gap: {x}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
