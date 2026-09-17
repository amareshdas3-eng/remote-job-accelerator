'use client';
import { useState, useEffect, useMemo } from 'react';
import { RemoteJobOpportunity } from '../../app/api/jobs/discover/route';
import { SavedJob } from './OpportunityWorkspace';

interface JobDiscoveryProps {
  onSelectJob: (job: SavedJob, advanceToWorkspace?: boolean) => void;
  activeJobId: string | null;
  busy: boolean;
  onNotice: (msg: string) => void;
  onCustomIngest: (url: string, text: string) => Promise<boolean>;
  resumeText?: string;
  userProfile?: any;
}

export default function JobDiscovery({
  onSelectJob,
  activeJobId,
  busy,
  onNotice,
  onCustomIngest,
  resumeText = '',
  userProfile,
}: JobDiscoveryProps) {
  const [opportunities, setOpportunities] = useState<RemoteJobOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'electrical' | 'project_management' | 'ai_operations' | 'industrial'>('all');
  const [discoveryMode, setDiscoveryMode] = useState<'curated' | 'custom'>('curated');
  const [customUrl, setCustomUrl] = useState('');
  const [customText, setCustomText] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Evidence profile keyword detection
  const profileSignals = useMemo(() => {
    const text = (resumeText + ' ' + (userProfile?.headline || '')).toLowerCase();
    const hasElectrical = text.includes('electrical') || text.includes('substation') || text.includes('switchgear') || text.includes('power');
    const hasPM = text.includes('project management') || text.includes('pmp') || text.includes('schedule') || text.includes('budget');
    const hasCommissioning = text.includes('commissioning') || text.includes('erection') || text.includes('testing') || text.includes('o&m') || text.includes('plant');
    const hasAIOps = text.includes('ai') || text.includes('python') || text.includes('automation') || text.includes('analytics');
    const hasIndustrial = text.includes('industrial') || text.includes('scada') || text.includes('instrumentation');

    const detected = [];
    if (hasElectrical) detected.push('Electrical Power Systems');
    if (hasCommissioning) detected.push('Erection & Commissioning / Plant O&M');
    if (hasPM) detected.push('PMP / Technical Project Management');
    if (hasIndustrial) detected.push('Industrial Systems & SCADA');
    if (hasAIOps) detected.push('AI-Assisted Operations');

    return detected.length > 0 ? detected : ['Executive Engineering Leadership', 'Technical Project Management', 'Operations'];
  }, [resumeText, userProfile]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/jobs/discover?category=${category}&q=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs) setOpportunities(data.jobs);
      })
      .catch(() => onNotice('Could not load remote opportunities.'))
      .finally(() => setLoading(false));
  }, [category, search, onNotice]);

  const handleSelectCuratedJob = async (opp: RemoteJobOpportunity) => {
    setSelectingId(opp.id);
    try {
      const res = await fetch('/api/jobs/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: opp.title,
          company: opp.company,
          description: opp.description,
          url: opp.url,
          company_website: opp.url,
          application_url: opp.url,
          remote_status: opp.remote_status || '100% Remote',
          location: opp.location || '100% Remote (Global / US)',
          salary: opp.salary_range,
          employment_type: 'Full-time Remote',
          source: opp.source,
          metadata: {
            category: opp.category,
            match_preview: opp.match_preview,
            key_requirements: opp.key_requirements,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to select job');

      onNotice(`Selected "${opp.title} at ${opp.company}". Canonical job record established.`);
      onSelectJob(data.job, true);
    } catch (e: any) {
      onNotice(e.message || 'Could not select opportunity');
    } finally {
      setSelectingId(null);
    }
  };

  const handleCustomIngestSubmit = async () => {
    if (!customUrl && !customText.trim()) {
      onNotice('Please enter a job URL or paste the job description.');
      return;
    }
    const success = await onCustomIngest(customUrl, customText);
    if (success) {
      onNotice('Custom opportunity ingested and selected as active canonical job.');
    }
  };

  return (
    <div className="discovery-container">
      {/* Discovery Header Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, #09131a 0%, #060c10 100%)',
          border: '1px solid #1c3547',
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '18px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', background: '#0e291f', color: '#9af5cf', border: '1px solid #1c4d38', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, letterSpacing: '.06em' }}>
                ✓ PROFILE-POPULATED REMOTE ENGINE
              </span>
              <span style={{ fontSize: '11px', color: '#7ea4b3' }}>
                Automatically scanned your verified master evidence
              </span>
            </div>

            <h3 style={{ fontSize: '17px', margin: '0 0 4px', color: '#f8fafc', fontWeight: 700 }}>
              High-Conviction Remote Opportunities for Your Career Evidence
            </h3>
            
            <p style={{ fontSize: '11px', color: '#8ea2ad', margin: '0 0 10px', lineHeight: 1.5, maxWidth: '800px' }}>
              Click <strong>"Select Job"</strong> on any opportunity to make it your canonical active job. The exact same opportunity persists across Match Analysis, ATS Resume Studio, Cover Letter, Interview Prep, and Pipeline.
            </p>

            {/* Profile Evidence Signals detected */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9px', color: '#687882', textTransform: 'uppercase', fontWeight: 700 }}>
                Matched Evidence Signals:
              </span>
              {profileSignals.map((sig) => (
                <span
                  key={sig}
                  style={{
                    fontSize: '9px',
                    background: '#0a161f',
                    border: '1px solid #1a3547',
                    color: '#38bdf8',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  ✓ {sig}
                </span>
              ))}
            </div>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '6px', background: '#0a1014', border: '1px solid #192730', borderRadius: '8px', padding: '4px' }}>
            <button
              className={`tab-btn ${discoveryMode === 'curated' ? 'active' : ''}`}
              onClick={() => setDiscoveryMode('curated')}
              style={{ fontSize: '11px', padding: '6px 14px', borderRadius: '6px' }}
            >
              ★ Matched Remote Roles
            </button>
            <button
              className={`tab-btn ${discoveryMode === 'custom' ? 'active' : ''}`}
              onClick={() => setDiscoveryMode('custom')}
              style={{ fontSize: '11px', padding: '6px 14px', borderRadius: '6px' }}
            >
              ＋ Import Custom Job
            </button>
          </div>
        </div>
      </div>

      {discoveryMode === 'curated' ? (
        <div>
          {/* Search and Category Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px', maxWidth: '440px' }}>
              <input
                type="text"
                placeholder="Search remote opportunities by title, company, or requirement keywords…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: '11px', background: '#080d11', border: '1px solid #1c2b33', borderRadius: '8px', color: '#f8fafc' }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Remote (6)' },
                { id: 'electrical', label: '⚡ Electrical & Power' },
                { id: 'project_management', label: '📋 Engineering PM' },
                { id: 'industrial', label: '🏭 Industrial & Plant' },
                { id: 'ai_operations', label: '✦ AI Operations' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  style={{
                    background: category === cat.id ? '#143124' : '#080d11',
                    border: `1px solid ${category === cat.id ? '#256346' : '#1a2730'}`,
                    color: category === cat.id ? '#9af5cf' : '#829198',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: category === cat.id ? 700 : 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opportunities Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#68767d', fontSize: '12px', background: '#070b0e', border: '1px solid #162229', borderRadius: '10px' }}>
              Populating remote opportunities matching your verified career evidence…
            </div>
          ) : opportunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#68767d', fontSize: '12px', background: '#070b0e', border: '1px solid #162229', borderRadius: '10px' }}>
              No opportunities matched your filter. Try adjusting your query or use "Import Custom Job".
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {opportunities.map((opp) => {
                const isSelected = activeJobId === opp.id || (activeJobId && opp.title.toLowerCase().includes('electrical'));
                const isSelectingThis = selectingId === opp.id;

                return (
                  <div
                    key={opp.id}
                    style={{
                      background: '#070b0e',
                      border: `1px solid ${isSelected ? '#204a37' : '#192830'}`,
                      borderRadius: '10px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 0 16px rgba(154,245,207,0.08)' : 'none',
                      transition: 'border-color .15s ease',
                    }}
                  >
                    <div>
                      {/* Top Badges & Fit Score */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '15px', color: '#f8fafc', display: 'block', lineHeight: 1.3 }}>
                            {opp.title}
                          </strong>
                          <span style={{ fontSize: '13px', color: '#9af5cf', fontWeight: 600 }}>{opp.company}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#0e241a',
                            color: '#9af5cf',
                            border: '1px solid #1a4a34',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opp.match_preview.fit_score}% Fit Preview
                        </span>
                      </div>

                      {/* Location & Compensation */}
                      <div style={{ display: 'flex', gap: '12px', margin: '8px 0 10px', fontSize: '11px', color: '#889ea8' }}>
                        <span>📍 {opp.location}</span>
                        <span>💰 {opp.salary_range}</span>
                      </div>

                      {/* Evidence Alignment Summary */}
                      <div style={{ background: '#091318', border: '1px solid #152733', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '9px', color: '#7ea4b3', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                          EVIDENCE ALIGNMENT:
                        </span>
                        <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '0 0 6px', lineHeight: 1.45 }}>
                          {opp.match_preview.role_focus}
                        </p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {opp.match_preview.aligned_skills.map((skill) => (
                            <span
                              key={skill}
                              style={{
                                fontSize: '9px',
                                background: '#0e1f18',
                                border: '1px solid #1b4533',
                                color: '#9af5cf',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              ✓ {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Key Requirements List */}
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '9px', color: '#687882', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          Key Requirements:
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#8a9aa2', lineHeight: 1.5 }}>
                          {opp.key_requirements.slice(0, 3).map((req, i) => (
                            <li key={i} style={{ marginBottom: '3px' }}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Card Actions: Official Link and 1-Click Select */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #142028', paddingTop: '12px', marginTop: '8px' }}>
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '11px', color: '#687882', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Official Posting</span> ↗
                      </a>

                      <button
                        className="primary"
                        style={{ fontSize: '11px', padding: '7px 18px', fontWeight: 700 }}
                        onClick={() => handleSelectCuratedJob(opp)}
                        disabled={busy || isSelectingThis}
                      >
                        {isSelectingThis ? 'Selecting…' : 'Select Job →'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* CUSTOM INGESTION TAB */
        <div style={{ background: '#070b0e', border: '1px solid #1a272e', borderRadius: '10px', padding: '24px' }}>
          <h4 style={{ fontSize: '15px', color: '#f4f7fa', margin: '0 0 6px' }}>Import Custom Public Listing</h4>
          <p style={{ fontSize: '11px', color: '#889ea8', margin: '0 0 18px' }}>
            Bring in any public listing from LinkedIn, Greenhouse, Lever, Ashby, or employer career boards to create a canonical job record.
          </p>

          <div className="field" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '10px', color: '#68767d', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              PUBLIC JOB LISTING URL
            </label>
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/… or Greenhouse / Lever URL"
              style={{ width: '100%', padding: '10px 14px', fontSize: '11px', background: '#0a1014', border: '1px solid #1c2b33', borderRadius: '6px', color: '#f4f7fa' }}
            />
          </div>

          <div className="divider" style={{ margin: '16px 0', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: '#526169' }}>OR PASTE COMPLETE JOB DESCRIPTION</span>
          </div>

          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={9}
            placeholder="Paste role title, company name, requirements, responsibilities, and remote criteria…"
            style={{ width: '100%', padding: '12px 14px', fontSize: '11px', lineHeight: 1.6, background: '#0a1014', border: '1px solid #1c2b33', borderRadius: '6px', color: '#c5d2d8' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              className="primary"
              disabled={busy || (!customUrl && !customText.trim())}
              onClick={handleCustomIngestSubmit}
              style={{ padding: '9px 24px', fontSize: '12px', fontWeight: 700 }}
            >
              {busy ? 'Ingesting…' : 'Ingest & Select Canonical Job →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
