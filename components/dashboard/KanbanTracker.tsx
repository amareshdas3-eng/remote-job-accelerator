'use client';
import { useState, useMemo } from 'react';

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
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onSelectJob: (jobId?: string) => void;
  onAddCurrentOpportunity: () => void;
  hasActiveJob: boolean;
  activeJobTitle?: string;
}

const STAGES = [
  { id: 'saved', label: 'Saved / Target', color: '#68767d' },
  { id: 'applied', label: 'Applied', color: '#7ea4b3' },
  { id: 'screening', label: 'Screening Call', color: '#e6c979' },
  { id: 'interview', label: 'Interviewing', color: '#9af5cf' },
  { id: 'offer', label: 'Offer Received', color: '#a7f3d0' },
];

export default function KanbanTracker({
  applications,
  onUpdateStatus,
  onUpdateNotes,
  onSelectJob,
  onAddCurrentOpportunity,
  hasActiveJob,
  activeJobTitle,
}: KanbanTrackerProps) {
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(
      (a) =>
        (a.company && a.company.toLowerCase().includes(q)) ||
        (a.role && a.role.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q))
    );
  }, [applications, search]);

  const metrics = useMemo(() => {
    const total = applications.length;
    const applied = applications.filter((a) => a.status !== 'saved').length;
    const interviewing = applications.filter(
      (a) => a.status === 'screening' || a.status === 'interview'
    ).length;
    const offers = applications.filter((a) => a.status === 'offer').length;
    const responseRate = applied > 0 ? Math.round(((interviewing + offers) / applied) * 100) : 0;
    return { total, applied, interviewing, offers, responseRate };
  }, [applications]);

  const openNotesModal = (app: Application) => {
    setSelectedApp(app);
    setEditNotes(app.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      await onUpdateNotes(selectedApp.id, editNotes);
      setSelectedApp(null);
    } finally {
      setSaving(false);
    }
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
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Submitted</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#7ea4b3', marginTop: '4px' }}>{metrics.applied}</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>In Interviews</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#9af5cf', marginTop: '4px' }}>{metrics.interviewing}</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Interview Rate</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#e6c979', marginTop: '4px' }}>{metrics.responseRate}%</strong>
        </div>
        <div style={{ background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px', padding: '12px' }}>
          <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase' }}>Offers</span>
          <strong style={{ font: '600 24px "Space Grotesk"', display: 'block', color: '#a7f3d0', marginTop: '4px' }}>{metrics.offers}</strong>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, maxWidth: '420px' }}>
          <input
            type="text"
            placeholder="Filter by company, role, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: '#0a1014', borderRadius: '8px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasActiveJob && (
            <button
              className="primary"
              style={{ padding: '8px 14px', fontSize: '11px' }}
              onClick={onAddCurrentOpportunity}
            >
              ＋ Add Current Role ({activeJobTitle ? activeJobTitle.slice(0, 18) + '…' : 'Active'})
            </button>
          )}
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="kanban-grid">
        {STAGES.map((stage) => {
          const columnApps = filtered.filter((a) => a.status === stage.id);
          return (
            <div key={stage.id} className="kanban-col">
              <div className="kanban-col-header">
                <b>{stage.label}</b>
                <span className="kanban-col-count">{columnApps.length}</span>
              </div>
              <div className="kanban-col-body">
                {columnApps.map((app) => (
                  <div key={app.id} className="kanban-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong className="kanban-card-title">{app.role || 'Target Role'}</strong>
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#66747b', fontSize: '10px' }}
                          title="Open original listing"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    <span className="kanban-card-company">{app.company || 'Company'}</span>

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
                          maxHeight: '60px',
                          overflow: 'hidden',
                        }}
                      >
                        {app.notes}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <select
                        value={app.status}
                        onChange={(e) => onUpdateStatus(app.id, e.target.value)}
                        style={{
                          background: '#090e11',
                          border: '1px solid #1e2a30',
                          color: '#9af5cf',
                          fontSize: '9px',
                          borderRadius: '6px',
                          padding: '3px 6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openNotesModal(app)}
                          style={{
                            background: '#121a1f',
                            border: '1px solid #233139',
                            color: '#95a3a9',
                            borderRadius: '6px',
                            padding: '3px 7px',
                            fontSize: '9px',
                          }}
                          title="Edit application notes"
                        >
                          ✎ Notes
                        </button>
                        {app.job_id && (
                          <button
                            onClick={() => onSelectJob(app.job_id)}
                            style={{
                              background: '#11221b',
                              border: '1px solid #24493a',
                              color: '#9af5cf',
                              borderRadius: '6px',
                              padding: '3px 7px',
                              fontSize: '9px',
                            }}
                            title="Load Dossier (Resume, Match, Interview)"
                          >
                            Workspace →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {columnApps.length === 0 && (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: '#4d5b63', fontSize: '10px' }}>
                    No applications
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes Modal */}
      {selectedApp && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <button className="modal-x" onClick={() => setSelectedApp(null)}>
              ×
            </button>
            <div className="kicker">OPPORTUNITY NOTES</div>
            <h2 style={{ fontSize: '18px', margin: '4px 0 2px' }}>
              {selectedApp.role} · <span style={{ color: '#9af5cf' }}>{selectedApp.company}</span>
            </h2>
            <p style={{ fontSize: '11px', color: '#74838b', marginBottom: '14px' }}>
              Log recruiter touchpoints, salary expectations, interview feedback, and follow-up deadlines.
            </p>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="e.g. Spoke with Sarah (lead recruiter). Salary budgeted at $160k-$180k. Take-home assignment due Friday..."
              style={{ width: '100%', minHeight: '140px', fontSize: '11px', lineHeight: '1.6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button className="secondary" onClick={() => setSelectedApp(null)}>
                Cancel
              </button>
              <button className="primary" onClick={handleSaveNotes} disabled={saving}>
                {saving ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
