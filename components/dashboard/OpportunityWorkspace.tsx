'use client';

export interface SavedJob {
  id: string;
  title?: string;
  company?: string;
  url?: string;
  description?: string;
  match?: any;
  tailored_resume?: any;
  cover_letter?: any;
  created_at?: string;
}

interface OpportunityWorkspaceProps {
  jobs: SavedJob[];
  activeJobId: string | null;
  onSelectJob: (job: SavedJob) => void;
  onNewJob: () => void;
}

export default function OpportunityWorkspace({
  jobs,
  activeJobId,
  onSelectJob,
  onNewJob,
}: OpportunityWorkspaceProps) {
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="opp-bar">
      <span style={{ fontSize: '10px', color: '#667780', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
        OPPORTUNITIES:
      </span>

      {jobs.map((j) => {
        const isActive = j.id === activeJobId;
        const role = j.title || 'Untitled Role';
        const company = j.company || 'Company';
        const hasTailored = !!j.tailored_resume;
        return (
          <button
            key={j.id}
            className={`opp-pill ${isActive ? 'active' : ''}`}
            onClick={() => onSelectJob(j)}
            title={`${role} at ${company}`}
          >
            <span>
              {role.slice(0, 20)}
              {role.length > 20 ? '…' : ''} <small style={{ opacity: 0.7 }}>· {company.slice(0, 14)}</small>
            </span>
            {hasTailored && (
              <span
                style={{
                  background: isActive ? '#1e4b3c' : '#14251f',
                  color: '#9af5cf',
                  padding: '1px 5px',
                  borderRadius: '99px',
                  fontSize: '8px',
                  fontWeight: 700,
                }}
              >
                ATS
              </span>
            )}
          </button>
        );
      })}

      <button className="opp-pill-new" onClick={onNewJob} title="Analyze a new job opportunity">
        ＋ New Role
      </button>
    </div>
  );
}
