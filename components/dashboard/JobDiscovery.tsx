'use client';
import { useState, useEffect, useMemo } from 'react';
import { RemoteJobOpportunity } from '../../app/api/jobs/discover/route';
import { SavedJob } from './OpportunityWorkspace';

interface JobDiscoveryProps {
  onSelectJob: (job: SavedJob, advanceToMatching?: boolean) => void;
  activeJobId: string | null;
  busy: boolean;
  onNotice: (msg: string) => void;
  onCustomIngest: (url: string, text: string) => Promise<boolean>;
}

export default function JobDiscovery({
  onSelectJob,
  activeJobId,
  busy,
  onNotice,
  onCustomIngest,
}: JobDiscoveryProps) {
  const [opportunities, setOpportunities] = useState<RemoteJobOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'electrical' | 'project_management' | 'ai_operations' | 'industrial'>('all');
  const [discoveryMode, setDiscoveryMode] = useState<'curated' | 'custom'>('curated');
  const [customUrl, setCustomUrl] = useState('');
  const [customText, setCustomText] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to select job');

      onNotice(`Selected "${opp.title} at ${opp.company}". Canonical job record active.`);
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
          background: '#091217',
          border: '1px solid #1c323f',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', background: '#122c23', color: '#9af5cf', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              ✓ EVIDENCE-MATCHED
            </span>
            <span style={{ fontSize: '11px', color: '#889ea8' }}>
              Matched against Electrical Engineering · Plant O&M · PMP · AI-Assisted PM Evidence
            </span>
          </div>
          <h3 style={{ fontSize: '16px', margin: '6px 0 2px', color: '#f4f7fa' }}>
            Curated Remote Roles for Your Evidence Profile
          </h3>
          <p style={{ fontSize: '11px', color: '#8aa0ab', margin: 0 }}>
            Select any role once with 1 click. The exact same job follows you through Matching, Resume Tailoring, Cover Letter, and Pipeline.
          </p>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`tab-btn ${discoveryMode === 'curated' ? 'active' : ''}`}
            onClick={() => setDiscoveryMode('curated')}
            style={{ fontSize: '11px', padding: '6px 14px' }}
          >
            ★ Matched Opportunities
          </button>
          <button
            className={`tab-btn ${discoveryMode === 'custom' ? 'active' : ''}`}
            onClick={() => setDiscoveryMode('custom')}
            style={{ fontSize: '11px', padding: '6px 14px' }}
          >
            ＋ Paste / URL Ingest
          </button>
        </div>
      </div>

      {discoveryMode === 'curated' ? (
        <div>
          {/* Controls: Search & Category Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px', maxWidth: '420px' }}>
              <input
                type="text"
                placeholder="Filter by title, company, or requirement keywords…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: '#0a1014', borderRadius: '8px' }}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Remote' },
                { id: 'electrical', label: '⚡ Electrical & Plant' },
                { id: 'project_management', label: '📋 Engineering PM' },
                { id: 'industrial', label: '🏭 Industrial & Infrastructure' },
                { id: 'ai_operations', label: '✦ AI Operations' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  style={{
                    background: category === cat.id ? '#152b22' : '#0a1014',
                    border: `1px solid ${category === cat.id ? '#2b5e48' : '#1c282e'}`,
                    color: category === cat.id ? '#9af5cf' : '#829198',
                    padding: '5px 10px',
                    fontSize: '10px',
                    fontWeight: category === cat.id ? 700 : 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Job Opportunities Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#68767d', fontSize: '12px' }}>
              Scanning curated remote opportunities for your profile…
            </div>
          ) : opportunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#68767d', fontSize: '12px' }}>
              No opportunities matched your filter. Try adjusting your query or use "Paste / URL Ingest".
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
              {opportunities.map((opp) => {
                const isSelected = activeJobId && opp.title.toLowerCase().includes('electrical'); // visual hint
                const isSelectingThis = selectingId === opp.id;

                return (
                  <div
                    key={opp.id}
                    style={{
                      background: '#070b0e',
                      border: '1px solid #1a272e',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                    }}
                  >
                    <div>
                      {/* Card Header: Role & Remote Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#f4f7fa', display: 'block', lineHeight: 1.3 }}>
                            {opp.title}
                          </strong>
                          <span style={{ fontSize: '12px', color: '#9af5cf', fontWeight: 600 }}>{opp.company}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#0f241a',
                            color: '#9af5cf',
                            border: '1px solid #1a4230',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opp.match_preview.fit_score}% Fit Preview
                        </span>
                      </div>

                      {/* Location & Compensation */}
                      <div style={{ display: 'flex', gap: '10px', margin: '8px 0 10px', fontSize: '10px', color: '#889ea8' }}>
                        <span>📍 {opp.location}</span>
                        <span>💰 {opp.salary_range}</span>
                      </div>

                      {/* Why it matches banner */}
                      <div style={{ background: '#091215', border: '1px solid #16242c', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '8px', color: '#7ea4b3', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, display: 'block' }}>
                          EVIDENCE ALIGNMENT:
                        </span>
                        <p style={{ fontSize: '10px', color: '#c5d1d6', margin: '2px 0 4px', lineHeight: 1.4 }}>
                          {opp.match_preview.role_focus}
                        </p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {opp.match_preview.aligned_skills.map((skill) => (
                            <span
                              key={skill}
                              style={{
                                fontSize: '8px',
                                background: '#101c17',
                                border: '1px solid #1b362a',
                                color: '#9af5cf',
                                padding: '1px 5px',
                                borderRadius: '3px',
                              }}
                            >
                              ✓ {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Key Requirements List */}
                      <ul style={{ margin: '0 0 12px 16px', padding: 0, fontSize: '10px', color: '#829198', lineHeight: 1.5 }}>
                        {opp.key_requirements.slice(0, 3).map((req, i) => (
                          <li key={i} style={{ marginBottom: '2px' }}>{req}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #141e24', paddingTop: '10px', marginTop: '6px' }}>
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '10px', color: '#68767d', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      >
                        <span>Official Posting</span> ↗
                      </a>

                      <button
                        className="primary"
                        style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 700 }}
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
        <div style={{ background: '#070b0e', border: '1px solid #1a272e', borderRadius: '10px', padding: '20px' }}>
          <h4 style={{ fontSize: '14px', color: '#f4f7fa', margin: '0 0 4px' }}>Import or Paste Custom Public Opportunity</h4>
          <p style={{ fontSize: '11px', color: '#889ea8', margin: '0 0 16px' }}>
            Bring in any public listing from LinkedIn, Greenhouse, Lever, Ashby, or company career boards.
          </p>

          <div className="field" style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '10px', color: '#68767d', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              PUBLIC JOB LISTING URL
            </label>
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/… or Greenhouse / Lever URL"
              style={{ width: '100%', padding: '9px 12px', fontSize: '11px', background: '#0a1014', borderRadius: '6px', color: '#f4f7fa' }}
            />
          </div>

          <div className="divider" style={{ margin: '14px 0', textAlign: 'center' }}>
            <span style={{ fontSize: '9px', color: '#526169' }}>OR PASTE COMPLETE JOB DESCRIPTION</span>
          </div>

          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={8}
            placeholder="Paste role title, company name, requirements, responsibilities, and remote criteria…"
            style={{ width: '100%', padding: '10px 12px', fontSize: '11px', lineHeight: 1.6, background: '#0a1014', borderRadius: '6px', color: '#c5d2d8' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              className="primary"
              disabled={busy || (!customUrl && !customText.trim())}
              onClick={handleCustomIngestSubmit}
              style={{ padding: '8px 20px', fontSize: '12px' }}
            >
              {busy ? 'Ingesting…' : 'Ingest & Select Canonical Job →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
