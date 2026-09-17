'use client';
import { useState, useMemo } from 'react';
import { SavedJob } from './OpportunityWorkspace';
import { getFullResumeText } from './AtsResumeStudio';

export interface Application {
  id: string;
  company: string;
  role: string;
  job_url?: string;
  status: string;
  notes?: string;
  job_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface KanbanTrackerProps {
  applications: Application[];
  jobs?: SavedJob[];
  interviews?: any[];
  userProfile?: any;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onSelectJob: (jobId?: string) => void;
  onAddCurrentOpportunity: () => void;
  hasActiveJob: boolean;
  activeJobTitle?: string;
}

export const STAGES = [
  { id: 'selected', label: 'Selected / Target', color: '#68767d', bg: '#10171a' },
  { id: 'in_progress', label: 'In Progress', color: '#a78bfa', bg: '#1c142e' },
  { id: 'ready_to_apply', label: 'Application Ready', color: '#38bdf8', bg: '#082f49' },
  { id: 'applied', label: 'Applied', color: '#818cf8', bg: '#1e1b4b' },
  { id: 'follow_up', label: 'Follow-Up Needed', color: '#fbbf24', bg: '#451a03' },
  { id: 'interview', label: 'Interviewing', color: '#34d399', bg: '#064e3b' },
  { id: 'offer', label: 'Offer Received', color: '#a7f3d0', bg: '#065f46' },
  { id: 'closed', label: 'Closed / Archived', color: '#475569', bg: '#0f172a' },
];

export default function KanbanTracker({
  applications,
  jobs = [],
  interviews = [],
  userProfile,
  onUpdateStatus,
  onUpdateNotes,
  onSelectJob,
  onAddCurrentOpportunity,
  hasActiveJob,
  activeJobTitle,
}: KanbanTrackerProps) {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [dossierTab, setDossierTab] = useState<'overview' | 'resume' | 'cover' | 'apply' | 'email' | 'interview' | 'timeline'>('overview');
  const [editNotes, setEditNotes] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Link each application with its full SavedJob and Interview record
  const enrichedApps = useMemo(() => {
    return applications.map((app) => {
      const linkedJob = jobs.find((j) => j.id === app.job_id);
      const linkedInterview = interviews.find((i) => i.job_id === app.job_id);
      
      // Standardize status
      let mappedStatus = app.status;
      if (mappedStatus === 'saved') mappedStatus = 'selected';
      if (mappedStatus === 'screening') mappedStatus = 'interview';
      if (!STAGES.some((s) => s.id === mappedStatus)) mappedStatus = 'selected';

      return {
        ...app,
        displayStatus: mappedStatus,
        jobData: linkedJob,
        interviewData: linkedInterview,
        matchScore: linkedJob?.match?.score ?? null,
        hasTailoredResume: !!linkedJob?.tailored_resume,
        hasCoverLetter: !!linkedJob?.cover_letter,
        hasInterviewPlan: !!linkedInterview?.plan,
      };
    });
  }, [applications, jobs, interviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedApps;
    return enrichedApps.filter(
      (a) =>
        (a.company && a.company.toLowerCase().includes(q)) ||
        (a.role && a.role.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q))
    );
  }, [enrichedApps, search]);

  const metrics = useMemo(() => {
    const total = enrichedApps.length;
    const ready = enrichedApps.filter((a) => a.displayStatus === 'ready_to_apply').length;
    const applied = enrichedApps.filter((a) => a.displayStatus === 'applied' || a.displayStatus === 'follow_up' || a.displayStatus === 'interview' || a.displayStatus === 'offer').length;
    const interviewing = enrichedApps.filter((a) => a.displayStatus === 'interview').length;
    const offers = enrichedApps.filter((a) => a.displayStatus === 'offer').length;
    const responseRate = applied > 0 ? Math.round(((interviewing + offers) / applied) * 100) : 0;
    return { total, ready, applied, interviewing, offers, responseRate };
  }, [enrichedApps]);

  const activeDossierApp = useMemo(() => {
    if (!selectedApp) return null;
    return enrichedApps.find((a) => a.id === selectedApp.id) || selectedApp;
  }, [selectedApp, enrichedApps]);

  const openDossier = (app: Application, tab: 'overview' | 'resume' | 'cover' | 'apply' | 'email' | 'interview' | 'timeline' = 'overview') => {
    setSelectedApp(app);
    setDossierTab(tab);
    setEditNotes(app.notes || '');
  };

  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      await onUpdateNotes(selectedApp.id, editNotes);
    } finally {
      setSaving(false);
    }
  };

  const markAppliedToday = async () => {
    if (!selectedApp) return;
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const logEntry = `\n[${timestamp}] Applied to position via company application portal.`;
    const updatedNotes = (selectedApp.notes || '') + logEntry;
    setSaving(true);
    try {
      await onUpdateStatus(selectedApp.id, 'applied');
      await onUpdateNotes(selectedApp.id, updatedNotes);
      setEditNotes(updatedNotes);
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="kanban-container">
      {/* Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Tracked Pipeline</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#f4f7fa', marginTop: '4px' }}>{metrics.total}</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Ready to Apply</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#38bdf8', marginTop: '4px' }}>{metrics.ready}</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Submitted</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#818cf8', marginTop: '4px' }}>{metrics.applied}</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>In Interviews</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#34d399', marginTop: '4px' }}>{metrics.interviewing}</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Conversion Rate</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#fbbf24', marginTop: '4px' }}>{metrics.responseRate}%</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Offers</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#a7f3d0', marginTop: '4px' }}>{metrics.offers}</strong>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, maxWidth: '440px' }}>
          <input
            type="text"
            placeholder="Search selected companies, roles, skills, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', fontSize: '11px', background: '#0a1014', borderRadius: '8px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasActiveJob && (
            <button
              className="primary"
              style={{ padding: '8px 14px', fontSize: '11px' }}
              onClick={onAddCurrentOpportunity}
            >
              ＋ Add Current Role to Pipeline ({activeJobTitle ? activeJobTitle.slice(0, 20) + '…' : 'Active'})
            </button>
          )}
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="kanban-grid" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(260px, 1fr))` }}>
        {STAGES.map((stage) => {
          const columnApps = filtered.filter((a) => a.displayStatus === stage.id);
          return (
            <div key={stage.id} className="kanban-col">
              <div className="kanban-col-header" style={{ borderTop: `3px solid ${stage.color}` }}>
                <b>{stage.label}</b>
                <span className="kanban-col-count">{columnApps.length}</span>
              </div>
              <div className="kanban-col-body">
                {columnApps.map((app) => {
                  const job = (app as any).jobData;
                  const matchScore = (app as any).matchScore;
                  const hasTailored = (app as any).hasTailoredResume;
                  const hasCover = (app as any).hasCoverLetter;

                  return (
                    <div key={app.id} className="kanban-card">
                      {/* Card Header: Role & Job URL */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                        <strong className="kanban-card-title">{app.role || 'Target Role'}</strong>
                        {app.job_url && (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#66747b', fontSize: '11px', textDecoration: 'none' }}
                            title="Open external job posting"
                          >
                            ↗
                          </a>
                        )}
                      </div>

                      {/* Company Name & Match Score */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                        <span className="kanban-card-company">{app.company || 'Company'}</span>
                        {typeof matchScore === 'number' && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: matchScore >= 80 ? '#11291d' : matchScore >= 60 ? '#2a220a' : '#261214',
                              color: matchScore >= 80 ? '#9af5cf' : matchScore >= 60 ? '#fde047' : '#f87171',
                              border: `1px solid ${matchScore >= 80 ? '#22553c' : matchScore >= 60 ? '#634f18' : '#571c23'}`,
                            }}
                          >
                            {matchScore}% Fit
                          </span>
                        )}
                      </div>

                      {/* Document Readiness Badges */}
                      <div style={{ display: 'flex', gap: '4px', margin: '8px 0 6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '8px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: hasTailored ? '#102e21' : '#141c21',
                            color: hasTailored ? '#9af5cf' : '#556670',
                            border: `1px solid ${hasTailored ? '#1e543c' : '#1c2830'}`,
                          }}
                        >
                          {hasTailored ? '✓ ATS Resume' : '○ Resume Pending'}
                        </span>
                        <span
                          style={{
                            fontSize: '8px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: hasCover ? '#1e1f3d' : '#141c21',
                            color: hasCover ? '#a5b4fc' : '#556670',
                            border: `1px solid ${hasCover ? '#31336a' : '#1c2830'}`,
                          }}
                        >
                          {hasCover ? '✓ Cover Letter' : '○ Cover Pending'}
                        </span>
                      </div>

                      {/* Notes snippet */}
                      {app.notes && (
                        <p
                          style={{
                            fontSize: '10px',
                            color: '#829198',
                            margin: '4px 0 8px',
                            lineHeight: 1.4,
                            background: '#070b0e',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '48px',
                            overflow: 'hidden',
                          }}
                        >
                          {app.notes}
                        </p>
                      )}

                      {/* Stage Selector Dropdown */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <select
                          value={(app as any).displayStatus}
                          onChange={(e) => onUpdateStatus(app.id, e.target.value)}
                          style={{
                            background: '#090e11',
                            border: '1px solid #1e2a30',
                            color: stage.color,
                            fontSize: '9px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            padding: '4px 6px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => openDossier(app, 'apply')}
                            style={{
                              background: '#11291d',
                              border: '1px solid #22553c',
                              color: '#9af5cf',
                              borderRadius: '6px',
                              padding: '3px 7px',
                              fontSize: '9px',
                              fontWeight: 700,
                            }}
                            title="Direct Application & Quick-Fill Assistant"
                          >
                            Apply ↗
                          </button>
                          <button
                            onClick={() => openDossier(app, 'overview')}
                            style={{
                              background: '#121a1f',
                              border: '1px solid #233139',
                              color: '#95a3a9',
                              borderRadius: '6px',
                              padding: '3px 7px',
                              fontSize: '9px',
                            }}
                            title="Open full company application dossier"
                          >
                            Dossier 📋
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {columnApps.length === 0 && (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: '#4d5b63', fontSize: '10px' }}>
                    No applications in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FULL APPLICATION RECORD DOSSIER MODAL */}
      {selectedApp && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '840px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button className="modal-x" onClick={() => setSelectedApp(null)}>
              ×
            </button>

            {/* Dossier Header */}
            <div style={{ borderBottom: '1px solid #1c282e', paddingBottom: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div className="kicker">COMPLETE APPLICATION DOSSIER · PIPELINE RECORD</div>
                  <h2 style={{ fontSize: '20px', margin: '2px 0 4px', color: '#f4f7fa' }}>
                    {selectedApp.role} · <span style={{ color: '#9af5cf' }}>{selectedApp.company}</span>
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={(activeDossierApp as any)?.displayStatus || selectedApp.status}
                    onChange={(e) => onUpdateStatus(selectedApp.id, e.target.value)}
                    style={{
                      background: '#0e161a',
                      border: '1px solid #273842',
                      color: '#9af5cf',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      padding: '5px 10px',
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        Stage: {s.label}
                      </option>
                    ))}
                  </select>
                  {selectedApp.job_url && (
                    <a
                      href={selectedApp.job_url}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary"
                      style={{ padding: '5px 10px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>Job Posting</span> ↗
                    </a>
                  )}
                  {selectedApp.job_id && (
                    <button
                      className="primary"
                      style={{ padding: '5px 10px', fontSize: '11px' }}
                      onClick={() => {
                        onSelectJob(selectedApp.job_id);
                        setSelectedApp(null);
                      }}
                      title="Switch active workspace to this role"
                    >
                      Open in Studio →
                    </button>
                  )}
                </div>
              </div>

              {/* Dossier Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '14px', borderBottom: '1px solid #162228', paddingBottom: '2px', overflowX: 'auto' }}>
                {[
                  { id: 'overview', label: '1. Role & Match' },
                  { id: 'resume', label: '2. ATS Resume' },
                  { id: 'cover', label: '3. Cover Letter' },
                  { id: 'apply', label: '4. Direct Web Apply' },
                  { id: 'email', label: '5. Apply by Email' },
                  { id: 'interview', label: '6. Interview Prep' },
                  { id: 'timeline', label: '7. Notes & Timeline' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDossierTab(t.id as any)}
                    style={{
                      background: dossierTab === t.id ? '#14251f' : 'transparent',
                      border: 'none',
                      borderBottom: dossierTab === t.id ? '2px solid #9af5cf' : '2px solid transparent',
                      color: dossierTab === t.id ? '#9af5cf' : '#728189',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: dossierTab === t.id ? 700 : 500,
                      cursor: 'pointer',
                      borderRadius: '4px 4px 0 0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dossier Body Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {/* TAB 1: Role & Match */}
              {dossierTab === 'overview' && (
                <div>
                  {/* Application Readiness Validation Checklist (Section 24) */}
                  <div style={{ background: '#0a141b', border: '1px solid #1c394d', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <b style={{ fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Application Package Readiness Checklist
                      </b>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: (activeDossierApp as any)?.hasTailoredResume && (activeDossierApp as any)?.hasCoverLetter ? '#0e2b1f' : '#2b1b08',
                          color: (activeDossierApp as any)?.hasTailoredResume && (activeDossierApp as any)?.hasCoverLetter ? '#9af5cf' : '#fbbf24',
                        }}
                      >
                        {(activeDossierApp as any)?.hasTailoredResume && (activeDossierApp as any)?.hasCoverLetter ? 'Ready to Apply' : 'Incomplete'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', fontSize: '10px', color: '#cbd5e1' }}>
                      <div>{selectedApp.role ? '☑' : '☐'} Job title verified</div>
                      <div>{selectedApp.company ? '☑' : '☐'} Company verified</div>
                      <div>{(activeDossierApp as any)?.jobData?.description ? '☑' : '☐'} Job description recorded</div>
                      <div>{(activeDossierApp as any)?.jobData?.match ? '☑' : '☐'} Match analysis completed</div>
                      <div>{(activeDossierApp as any)?.hasTailoredResume ? '☑' : '☐'} 100% ATS resume generated</div>
                      <div>{(activeDossierApp as any)?.hasCoverLetter ? '☑' : '☐'} Role-aligned cover letter</div>
                      <div>{selectedApp.job_url ? '☑' : '☐'} Application portal identified</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                      {selectedApp.job_url && (
                        <a
                          href={selectedApp.job_url}
                          target="_blank"
                          rel="noreferrer"
                          className="primary"
                          style={{ fontSize: '10px', padding: '5px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>Apply Now on Portal</span> ↗
                        </a>
                      )}
                      <button
                        className="secondary"
                        style={{ fontSize: '10px', padding: '5px 10px' }}
                        onClick={() => setDossierTab('apply')}
                      >
                        Open Quick-Fill Helper →
                      </button>
                    </div>
                  </div>

                  {/* Fit score & verdict banner */}
                  <div style={{ display: 'flex', gap: '16px', background: '#090e11', border: '1px solid #1c282e', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', minWidth: '90px' }}>
                      <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase', letterSpacing: '.08em' }}>Fit Score</span>
                      <strong style={{ display: 'block', font: '700 32px "Space Grotesk"', color: (activeDossierApp as any)?.matchScore >= 80 ? '#9af5cf' : '#fbbf24' }}>
                        {(activeDossierApp as any)?.matchScore ?? '—'}
                      </strong>
                      <small style={{ color: '#68767d', fontSize: '9px' }}>/ 100</small>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '10px', color: '#9af5cf', fontWeight: 600, textTransform: 'uppercase' }}>Analyst Verdict</span>
                      <p style={{ fontSize: '12px', color: '#c5d1d6', margin: '4px 0 6px', lineHeight: 1.5 }}>
                        {(activeDossierApp as any)?.jobData?.match?.verdict || 'Match analysis ready to be reviewed.'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '9px', background: '#101a15', border: '1px solid #1c3529', color: '#9af5cf', padding: '2px 6px', borderRadius: '4px' }}>
                          ✓ Evidence-First Verified
                        </span>
                        <span style={{ fontSize: '9px', background: '#0e171c', border: '1px solid #1a2a33', color: '#7ea4b3', padding: '2px 6px', borderRadius: '4px' }}>
                          100% Remote Opportunity
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Matched Requirements Map */}
                  <div style={{ marginBottom: '16px' }}>
                    <div className="section-title">
                      <h3>Requirement Mapping & Signals</h3>
                      <span>{((activeDossierApp as any)?.jobData?.match?.matched_requirements || []).length} criteria mapped</span>
                    </div>
                    <div className="evidence-list" style={{ marginTop: '8px' }}>
                      {((activeDossierApp as any)?.jobData?.match?.matched_requirements || []).map((req: any, idx: number) => (
                        <div className="e-row" key={idx} style={{ padding: '8px 10px' }}>
                          <span className={(req.status || 'review').toLowerCase()} style={{ textTransform: 'uppercase', fontSize: '8px' }}>
                            {req.status || 'matched'}
                          </span>
                          <b style={{ fontSize: '11px' }}>{req.requirement}</b>
                          <small style={{ fontSize: '10px', color: '#8898a0' }}>{req.evidence || 'Supported by candidate career evidence'}</small>
                        </div>
                      ))}
                      {(!((activeDossierApp as any)?.jobData?.match?.matched_requirements) || ((activeDossierApp as any)?.jobData?.match?.matched_requirements.length === 0)) && (
                        <p style={{ color: '#68767d', fontSize: '11px' }}>Full requirement mapping will be displayed once fit match is run.</p>
                      )}
                    </div>
                  </div>

                  {/* Original Job Description */}
                  <div>
                    <h3 style={{ fontSize: '12px', color: '#a0b1ba', textTransform: 'uppercase', marginBottom: '6px' }}>Original Job Description</h3>
                    <div style={{ background: '#060a0d', border: '1px solid #151f24', borderRadius: '8px', padding: '12px', fontSize: '11px', lineHeight: 1.6, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: '#95a4ad' }}>
                      {(activeDossierApp as any)?.jobData?.description || 'No raw job description recorded.'}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Tailored ATS Resume */}
              {dossierTab === 'resume' && (
                <div>
                  {(activeDossierApp as any)?.jobData?.tailored_resume ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <b style={{ fontSize: '13px', color: '#f4f7fa' }}>Professionally Tailored ATS Resume</b>
                          <span style={{ display: 'block', fontSize: '10px', color: '#9af5cf' }}>✓ Single-column ATS format · Universal headers · Truth Guard verified</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="secondary"
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={() => {
                              const text = getFullResumeText((activeDossierApp as any).jobData.tailored_resume);
                              copyToClipboard(text, 'resume_text');
                            }}
                          >
                            {copiedField === 'resume_text' ? '✓ Copied' : '📋 Copy Text'}
                          </button>
                          <button
                            className="secondary"
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={() => {
                              const text = getFullResumeText((activeDossierApp as any).jobData.tailored_resume);
                              downloadFile(`${selectedApp.company}-${selectedApp.role}-ATS-Resume.txt`.replace(/\s+/g, '_'), text, 'text/plain');
                            }}
                          >
                            ⇩ .TXT
                          </button>
                          <button
                            className="secondary"
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={() => window.print()}
                          >
                            🖨️ Print / PDF
                          </button>
                        </div>
                      </div>

                      {/* Formatted Resume Preview */}
                      <div style={{ background: '#070b0e', border: '1px solid #1c282e', borderRadius: '8px', padding: '18px', fontSize: '11px', lineHeight: 1.6, color: '#d1dce2', fontFamily: 'monospace' }}>
                        <div style={{ textAlign: 'center', borderBottom: '1px solid #233139', paddingBottom: '12px', marginBottom: '14px' }}>
                          <h1 style={{ fontSize: '18px', margin: '0 0 4px', color: '#f4f7fa' }}>
                            {(activeDossierApp as any).jobData.tailored_resume.contact_info?.name || userProfile?.full_name || 'Candidate'}
                          </h1>
                          <p style={{ margin: 0, color: '#8898a0', fontSize: '10px' }}>
                            {[(activeDossierApp as any).jobData.tailored_resume.contact_info?.email, (activeDossierApp as any).jobData.tailored_resume.contact_info?.phone, (activeDossierApp as any).jobData.tailored_resume.contact_info?.location].filter(Boolean).join(' | ')}
                          </p>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                          <strong style={{ color: '#9af5cf', display: 'block', borderBottom: '1px solid #1a2c23', paddingBottom: '2px', marginBottom: '6px' }}>PROFESSIONAL SUMMARY</strong>
                          <p style={{ margin: 0, color: '#aab8be' }}>{(activeDossierApp as any).jobData.tailored_resume.summary}</p>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                          <strong style={{ color: '#9af5cf', display: 'block', borderBottom: '1px solid #1a2c23', paddingBottom: '2px', marginBottom: '6px' }}>CORE COMPETENCIES & SKILLS</strong>
                          <p style={{ margin: 0, color: '#aab8be' }}>
                            {((activeDossierApp as any).jobData.tailored_resume.skills || []).join(' • ')}
                          </p>
                        </div>

                        <div>
                          <strong style={{ color: '#9af5cf', display: 'block', borderBottom: '1px solid #1a2c23', paddingBottom: '2px', marginBottom: '6px' }}>PROFESSIONAL EXPERIENCE</strong>
                          {((activeDossierApp as any).jobData.tailored_resume.experience || []).map((exp: any, i: number) => (
                            <div key={i} style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#f4f7fa' }}>
                                <span>{exp.role} — {exp.company}</span>
                                <span style={{ color: '#8898a0', fontSize: '10px' }}>{exp.period}</span>
                              </div>
                              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                {(exp.bullets || []).map((b: string, bi: number) => (
                                  <li key={bi} style={{ color: '#aab8be', marginBottom: '2px' }}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                      <p style={{ color: '#74838b', fontSize: '12px' }}>No tailored resume generated yet for this opportunity.</p>
                      <button
                        className="primary"
                        onClick={() => {
                          onSelectJob(selectedApp.job_id);
                          setSelectedApp(null);
                        }}
                      >
                        Generate 100% ATS Resume →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Tailored Cover Letter */}
              {dossierTab === 'cover' && (
                <div>
                  {(activeDossierApp as any)?.jobData?.cover_letter ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <b style={{ fontSize: '13px', color: '#f4f7fa' }}>Targeted Executive Cover Letter</b>
                          <span style={{ display: 'block', fontSize: '10px', color: '#9af5cf' }}>✓ Aligned with ATS Resume narrative · Truth Guard certified</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="secondary"
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={() => {
                              const letter = (activeDossierApp as any).jobData.cover_letter.letter || JSON.stringify((activeDossierApp as any).jobData.cover_letter);
                              copyToClipboard(letter, 'cover_letter');
                            }}
                          >
                            {copiedField === 'cover_letter' ? '✓ Copied' : '📋 Copy Letter'}
                          </button>
                          <button
                            className="secondary"
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={() => {
                              const letter = (activeDossierApp as any).jobData.cover_letter.letter || '';
                              downloadFile(`${selectedApp.company}-${selectedApp.role}-Cover-Letter.txt`.replace(/\s+/g, '_'), letter, 'text/plain');
                            }}
                          >
                            ⇩ Download
                          </button>
                        </div>
                      </div>

                      <div style={{ background: '#070b0e', border: '1px solid #1c282e', borderRadius: '8px', padding: '18px', fontSize: '11px', lineHeight: 1.7, color: '#c5d2d8', whiteSpace: 'pre-wrap' }}>
                        {(activeDossierApp as any).jobData.cover_letter.letter || JSON.stringify((activeDossierApp as any).jobData.cover_letter, null, 2)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                      <p style={{ color: '#74838b', fontSize: '12px' }}>No cover letter created yet for this opportunity.</p>
                      <button
                        className="primary"
                        onClick={() => {
                          onSelectJob(selectedApp.job_id);
                          setSelectedApp(null);
                        }}
                      >
                        Create Aligned Cover Letter →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Direct Web Apply & Quick-Fill Assistant */}
              {dossierTab === 'apply' && (
                <div>
                  <div style={{ background: '#091319', border: '1px solid #1a3340', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <b style={{ fontSize: '13px', color: '#38bdf8' }}>Official Application Route</b>
                        <p style={{ fontSize: '11px', color: '#90a4ae', margin: '2px 0 0' }}>
                          Open the company portal directly. Use the 1-Click Quick-Fill helper below to paste answers instantly.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {selectedApp.job_url ? (
                          <a
                            href={selectedApp.job_url}
                            target="_blank"
                            rel="noreferrer"
                            className="primary"
                            style={{ padding: '8px 16px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span>Open Application Page</span> ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#74838b' }}>No application URL recorded</span>
                        )}
                        <button
                          className="secondary"
                          style={{ padding: '8px 14px', fontSize: '11px', color: '#9af5cf', borderColor: '#22553c' }}
                          onClick={markAppliedToday}
                          disabled={saving}
                        >
                          {saving ? 'Updating…' : '✓ Mark Applied Today'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Quick-Fill Assistant Drawer */}
                  <h3 style={{ fontSize: '12px', color: '#a0b1ba', textTransform: 'uppercase', marginBottom: '8px' }}>
                    1-Click Application Form Quick-Fill Helper
                  </h3>
                  <p style={{ fontSize: '10px', color: '#68767d', marginBottom: '12px' }}>
                    Click any field to copy it directly to your clipboard for rapid pasting into Greenhouse, Lever, Workday, or Ashby form fields.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    {/* Full Name */}
                    <div style={{ background: '#090e11', border: '1px solid #1c282e', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>Full Name</span>
                        <button
                          onClick={() => copyToClipboard((activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.name || userProfile?.full_name || 'Candidate', 'qf_name')}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                        >
                          {copiedField === 'qf_name' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <strong style={{ fontSize: '11px', color: '#f4f7fa', display: 'block', marginTop: '4px' }}>
                        {(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.name || userProfile?.full_name || 'Candidate'}
                      </strong>
                    </div>

                    {/* Email */}
                    <div style={{ background: '#090e11', border: '1px solid #1c282e', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>Email</span>
                        <button
                          onClick={() => copyToClipboard((activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.email || userProfile?.email || '', 'qf_email')}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                        >
                          {copiedField === 'qf_email' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <strong style={{ fontSize: '11px', color: '#f4f7fa', display: 'block', marginTop: '4px' }}>
                        {(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.email || userProfile?.email || '—'}
                      </strong>
                    </div>

                    {/* Phone */}
                    <div style={{ background: '#090e11', border: '1px solid #1c282e', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>Phone</span>
                        <button
                          onClick={() => copyToClipboard((activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.phone || '', 'qf_phone')}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                        >
                          {copiedField === 'qf_phone' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <strong style={{ fontSize: '11px', color: '#f4f7fa', display: 'block', marginTop: '4px' }}>
                        {(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.phone || '—'}
                      </strong>
                    </div>

                    {/* Location / Remote */}
                    <div style={{ background: '#090e11', border: '1px solid #1c282e', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>Work Location / Authorization</span>
                        <button
                          onClick={() => copyToClipboard('Authorized to work remotely in the United States / Globally without visa sponsorship.', 'qf_auth')}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                        >
                          {copiedField === 'qf_auth' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <strong style={{ fontSize: '11px', color: '#f4f7fa', display: 'block', marginTop: '4px' }}>
                        100% Remote / Eligible
                      </strong>
                    </div>

                    {/* Professional Summary */}
                    <div style={{ gridColumn: '1 / -1', background: '#090e11', border: '1px solid #1c282e', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>Tailored Summary / "Elevator Pitch"</span>
                        <button
                          onClick={() => copyToClipboard((activeDossierApp as any)?.jobData?.tailored_resume?.summary || '', 'qf_summary')}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                        >
                          {copiedField === 'qf_summary' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: '#c5d2d8', margin: '4px 0 0', lineHeight: 1.5 }}>
                        {(activeDossierApp as any)?.jobData?.tailored_resume?.summary || 'Tailored resume summary ready to copy.'}
                      </p>
                    </div>

                    {/* Plain Text Resume */}
                    <div style={{ gridColumn: '1 / -1', background: '#090e11', border: '1px solid #1c282e', borderRadius: '6px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>Plain-Text ATS Resume (for application text boxes)</span>
                        <button
                          onClick={() => {
                            if ((activeDossierApp as any)?.jobData?.tailored_resume) {
                              const text = getFullResumeText((activeDossierApp as any).jobData.tailored_resume);
                              copyToClipboard(text, 'qf_plain_resume');
                            }
                          }}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                        >
                          {copiedField === 'qf_plain_resume' ? '✓ Copied Full Text' : 'Copy Full Text'}
                        </button>
                      </div>
                      <span style={{ fontSize: '10px', color: '#8898a0', display: 'block', marginTop: '4px' }}>
                        1-click copy of the entire ATS single-column resume ready for pasting into portals that reject file uploads.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Apply by Email Workflow */}
              {dossierTab === 'email' && (
                <div>
                  <div style={{ background: '#090e11', border: '1px solid #1c282e', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <b style={{ fontSize: '13px', color: '#f4f7fa', display: 'block' }}>Direct Recruiter Email Application</b>
                    <p style={{ fontSize: '11px', color: '#8898a0', margin: '2px 0 12px' }}>
                      Where jobs accept applications via email, launch a pre-filled email directly from your verified client.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                          RECIPIENT (Recruiter or Careers Email)
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. careers@company.com or recruiter@company.com"
                          value={recruiterEmail}
                          onChange={(e) => setRecruiterEmail(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '11px', background: '#060a0d', border: '1px solid #1c282e', borderRadius: '6px', color: '#f4f7fa' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>SUBJECT LINE</label>
                          <button
                            onClick={() => {
                              const sub = `Application: ${selectedApp.role} – ${(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.name || userProfile?.full_name || 'Candidate'}`;
                              copyToClipboard(sub, 'email_sub');
                            }}
                            style={{ fontSize: '8px', padding: '1px 5px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                          >
                            {copiedField === 'email_sub' ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <input
                          readOnly
                          value={`Application: ${selectedApp.role} – ${(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.name || userProfile?.full_name || 'Candidate'}`}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '11px', background: '#060a0d', border: '1px solid #1c282e', borderRadius: '6px', color: '#9af5cf' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase' }}>PERSONALIZED APPLICATION EMAIL BODY</label>
                          <button
                            onClick={() => {
                              const body = (activeDossierApp as any)?.jobData?.cover_letter?.email_pitch || (activeDossierApp as any)?.jobData?.cover_letter?.letter || '';
                              copyToClipboard(body, 'email_body');
                            }}
                            style={{ fontSize: '8px', padding: '1px 5px', background: '#121e18', border: '1px solid #1e3d2f', color: '#9af5cf', borderRadius: '4px' }}
                          >
                            {copiedField === 'email_body' ? '✓ Copied' : 'Copy Body'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          rows={8}
                          value={
                            (activeDossierApp as any)?.jobData?.cover_letter?.email_pitch ||
                            (activeDossierApp as any)?.jobData?.cover_letter?.letter ||
                            `Dear Hiring Team at ${selectedApp.company},\n\nI am writing to express my strong interest in the ${selectedApp.role} opportunity. Based on my proven background, I am confident in my ability to deliver immediate value to your engineering and product goals.\n\nAttached please find my tailored ATS-formatted resume and cover letter detailing my verified experience.\n\nBest regards,\n${(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.name || userProfile?.full_name || 'Candidate'}`
                          }
                          style={{ width: '100%', padding: '8px 10px', fontSize: '11px', lineHeight: 1.6, background: '#060a0d', border: '1px solid #1c282e', borderRadius: '6px', color: '#c5d2d8' }}
                        />
                      </div>

                      {/* Attachments checklist */}
                      <div style={{ background: '#070b0e', border: '1px dashed #1c282e', borderRadius: '6px', padding: '10px' }}>
                        <span style={{ fontSize: '9px', color: '#9af5cf', fontWeight: 600, textTransform: 'uppercase' }}>Attachment Checklist</span>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                          <label style={{ fontSize: '10px', color: '#8898a0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="checkbox" defaultChecked /> Tailored ATS Resume (.txt / .pdf)
                          </label>
                          <label style={{ fontSize: '10px', color: '#8898a0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="checkbox" defaultChecked /> Role-Aligned Cover Letter
                          </label>
                        </div>
                      </div>

                      {/* Launch Mailto Action */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                        <a
                          href={`mailto:${encodeURIComponent(recruiterEmail)}?subject=${encodeURIComponent(
                            `Application: ${selectedApp.role} – ${(activeDossierApp as any)?.jobData?.tailored_resume?.contact_info?.name || userProfile?.full_name || 'Candidate'}`
                          )}&body=${encodeURIComponent(
                            (activeDossierApp as any)?.jobData?.cover_letter?.email_pitch ||
                            (activeDossierApp as any)?.jobData?.cover_letter?.letter ||
                            ''
                          )}`}
                          className="primary"
                          style={{ padding: '8px 16px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span>✉ Open in Email Client</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Interview Prep */}
              {dossierTab === 'interview' && (
                <div>
                  {(activeDossierApp as any)?.interviewData?.plan ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <b style={{ fontSize: '13px', color: '#f4f7fa' }}>Role-Specific Interview Rehearsal Questions</b>
                          <span style={{ display: 'block', fontSize: '10px', color: '#9af5cf' }}>Ground your responses in verified evidence and the STAR method</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(((activeDossierApp as any).interviewData.plan.questions || [])).map((q: any, qi: number) => (
                          <div key={qi} style={{ background: '#070b0e', border: '1px solid #1c282e', borderRadius: '8px', padding: '12px' }}>
                            <span style={{ fontSize: '9px', color: '#9af5cf', fontWeight: 700, textTransform: 'uppercase' }}>
                              Question {qi + 1} · {q.type || 'Behavioral / STAR'}
                            </span>
                            <strong style={{ display: 'block', fontSize: '12px', color: '#f4f7fa', margin: '4px 0 6px' }}>
                              {q.question}
                            </strong>
                            <p style={{ fontSize: '10px', color: '#8898a0', margin: 0 }}>
                              <strong>Target Signal:</strong> {q.signal || q.rationale || 'Demonstrates technical competence and remote autonomy.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                      <p style={{ color: '#74838b', fontSize: '12px' }}>No interview coach built yet for this opportunity.</p>
                      <button
                        className="primary"
                        onClick={() => {
                          onSelectJob(selectedApp.job_id);
                          setSelectedApp(null);
                        }}
                      >
                        Build Interview Coach →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: Notes & Timeline */}
              {dossierTab === 'timeline' && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      OPPORTUNITY CRM & RECRUITER NOTES
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="e.g. Recruiter call scheduled for Tuesday at 2pm EST. Salary range discussed: $155k - $175k..."
                      style={{ width: '100%', minHeight: '140px', fontSize: '11px', lineHeight: 1.6, background: '#060a0d', border: '1px solid #1c282e', borderRadius: '6px', color: '#c5d2d8' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button className="primary" onClick={handleSaveNotes} disabled={saving} style={{ fontSize: '11px', padding: '6px 12px' }}>
                        {saving ? 'Saving…' : 'Save Notes'}
                      </button>
                    </div>
                  </div>

                  {/* Activity Timeline */}
                  <div>
                    <h3 style={{ fontSize: '11px', color: '#a0b1ba', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Application Lifecycle Activity
                    </h3>
                    <div style={{ borderLeft: '2px solid #1c282e', marginLeft: '6px', paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '-19px', top: '3px', width: '8px', height: '8px', borderRadius: '50%', background: '#9af5cf' }} />
                        <span style={{ fontSize: '9px', color: '#68767d' }}>
                          {selectedApp.created_at ? new Date(selectedApp.created_at).toLocaleDateString() : 'Recently'}
                        </span>
                        <strong style={{ display: 'block', fontSize: '11px', color: '#f4f7fa' }}>Opportunity Added to Pipeline</strong>
                      </div>
                      {(activeDossierApp as any)?.hasTailoredResume && (
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-19px', top: '3px', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                          <span style={{ fontSize: '9px', color: '#68767d' }}>Completed</span>
                          <strong style={{ display: 'block', fontSize: '11px', color: '#f4f7fa' }}>100% ATS Resume & Cover Letter Tailored</strong>
                        </div>
                      )}
                      {(activeDossierApp as any)?.displayStatus === 'applied' && (
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-19px', top: '3px', width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8' }} />
                          <span style={{ fontSize: '9px', color: '#68767d' }}>Submitted</span>
                          <strong style={{ display: 'block', fontSize: '11px', color: '#f4f7fa' }}>Application Form Completed & Submitted</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dossier Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1c282e', paddingTop: '12px', marginTop: '14px' }}>
              <span style={{ fontSize: '10px', color: '#68767d' }}>
                ID: {selectedApp.id.slice(0, 8)} · Updated: {selectedApp.updated_at ? new Date(selectedApp.updated_at).toLocaleDateString() : 'Today'}
              </span>
              <button className="secondary" onClick={() => setSelectedApp(null)} style={{ padding: '6px 14px', fontSize: '11px' }}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
