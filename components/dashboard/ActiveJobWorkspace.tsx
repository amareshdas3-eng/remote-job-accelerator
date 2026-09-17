'use client';
import { useState } from 'react';

interface ActiveJobWorkspaceProps {
  activeJobId: string | null;
  job: {
    id?: string;
    title?: string;
    company?: string;
    url?: string;
    application_url?: string;
    website?: string;
    industry?: string;
    location?: string;
    source?: string;
  } | null;
  jobDescription?: string;
  currentStep: string;
  onNavigateStep: (step: string) => void;
  onChangeSelectedJob: () => void;
  hasMatch: boolean;
  hasTailoredResume: boolean;
  hasCoverLetter: boolean;
  hasInterviewPlan: boolean;
  hasApplication: boolean;
}

const WORKFLOW_STAGES = [
  { id: 'Job Matching', label: 'Match', num: '①' },
  { id: 'Resume Tailoring', label: 'Resume', num: '②' },
  { id: 'Cover Letter', label: 'Cover Letter', num: '③' },
  { id: 'Interview Prep', label: 'Interview', num: '④' },
  { id: 'Pipeline & Apply', label: 'Application & Pipeline', num: '⑤' },
];

export default function ActiveJobWorkspace({
  activeJobId,
  job,
  jobDescription,
  currentStep,
  onNavigateStep,
  onChangeSelectedJob,
  hasMatch,
  hasTailoredResume,
  hasCoverLetter,
  hasInterviewPlan,
  hasApplication,
}: ActiveJobWorkspaceProps) {
  const [showDrawer, setShowDrawer] = useState(false);

  if (!activeJobId && !job?.title) {
    return (
      <div
        style={{
          background: '#0a1014',
          border: '1px dashed #1e2c33',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: '#68767d', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
            JOB WORKSPACE · NO ACTIVE OPPORTUNITY
          </span>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Select a verified remote opportunity in Job Discovery to activate this workspace.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => onNavigateStep('Job Discovery')}
          style={{ fontSize: '11px', padding: '6px 14px' }}
        >
          Explore Remote Jobs →
        </button>
      </div>
    );
  }

  // Calculate readiness score
  const readinessItems = [
    { label: 'Job Verified', done: true },
    { label: 'Match Analyzed', done: hasMatch },
    { label: 'ATS Resume Tailored', done: hasTailoredResume },
    { label: 'Cover Letter Aligned', done: hasCoverLetter },
    { label: 'Interview Prep', done: hasInterviewPlan },
    { label: 'Pipeline Dossier', done: hasApplication },
  ];
  const completedCount = readinessItems.filter((i) => i.done).length;
  const isReadyToApply = completedCount >= 4;

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #0a131a 0%, #070d12 100%)',
        border: '1px solid #1c3545',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #142733',
          paddingBottom: '10px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '9px',
                color: '#38bdf8',
                background: '#0b2636',
                border: '1px solid #1b4b66',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 800,
                letterSpacing: '.07em',
              }}
            >
              CANONICAL JOB WORKSPACE
            </span>
            <span style={{ fontSize: '10px', color: '#9af5cf', background: '#0e241c', padding: '2px 7px', borderRadius: '4px' }}>
              ● 100% Remote Verified
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              ID: <code style={{ color: '#7ea4b3' }}>{activeJobId ? activeJobId.slice(0, 8) + '…' : '—'}</code>
            </span>
          </div>

          <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', color: '#f8fafc', fontWeight: 700 }}>
            {job?.title || 'Selected Opportunity'} ·{' '}
            <span style={{ color: '#9af5cf' }}>{job?.company || 'Target Company'}</span>
          </h3>

          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#829198', flexWrap: 'wrap' }}>
            <span>🏢 {job?.industry || 'Energy & Infrastructure Systems'}</span>
            <span>📍 {job?.location || '100% Remote (Global / US)'}</span>
            <span>🌐 {job?.source || 'Verified Direct Employer Listing'}</span>
            {job?.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', textDecoration: 'none' }}
              >
                Official Job URL ↗
              </a>
            )}
            {job?.application_url && (
              <a
                href={job.application_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#9af5cf', textDecoration: 'none', fontWeight: 600 }}
              >
                Direct Application Portal ↗
              </a>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowDrawer((v) => !v)}
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              background: showDrawer ? '#1c3d4f' : '#0e1e28',
              border: '1px solid #1c3e52',
              color: '#38bdf8',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showDrawer ? '▲ Hide Description' : '📄 Inspect Full Description'}
          </button>
          <button
            onClick={onChangeSelectedJob}
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              background: '#09151c',
              border: '1px solid #172a36',
              color: '#8898a0',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Switch Role
          </button>
        </div>
      </div>

      {/* Expandable Job Description Drawer */}
      {showDrawer && (
        <div
          style={{
            marginTop: '12px',
            background: '#050a0d',
            border: '1px solid #1b303d',
            borderRadius: '8px',
            padding: '14px 16px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong style={{ fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase' }}>
              Complete Source Job Description & Requirements
            </strong>
            <button
              onClick={() => {
                if (jobDescription) {
                  navigator.clipboard?.writeText(jobDescription);
                  alert('Full job description copied.');
                }
              }}
              style={{ fontSize: '9px', padding: '2px 8px', background: '#0e2330', border: '1px solid #19435c', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer' }}
            >
              Copy Description
            </button>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '11px', color: '#cbd5e1', margin: 0, fontFamily: 'monospace' }}>
            {jobDescription || 'No detailed description captured for this opportunity.'}
          </p>
        </div>
      )}

      {/* Workflow Stage Tracker & Application Readiness Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '10px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {/* Stages Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#68767d', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
            STAGE:
          </span>
          {WORKFLOW_STAGES.map((st, i) => {
            const isCurrent = currentStep === st.id;
            let isComplete = false;
            if (st.id === 'Job Matching' && hasMatch) isComplete = true;
            if (st.id === 'Resume Tailoring' && hasTailoredResume) isComplete = true;
            if (st.id === 'Cover Letter' && hasCoverLetter) isComplete = true;
            if (st.id === 'Interview Prep' && hasInterviewPlan) isComplete = true;
            if (st.id === 'Pipeline & Apply' && hasApplication) isComplete = true;

            return (
              <button
                key={st.id}
                onClick={() => onNavigateStep(st.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: isCurrent ? 700 : 500,
                  cursor: 'pointer',
                  background: isCurrent ? '#194154' : isComplete ? '#0e231b' : 'transparent',
                  color: isCurrent ? '#38bdf8' : isComplete ? '#9af5cf' : '#8898a0',
                  border: isCurrent ? '1px solid #286482' : isComplete ? '1px solid #1d4434' : '1px solid transparent',
                }}
              >
                <span>{isComplete ? '✓' : st.num}</span>
                <span>{st.label}</span>
                {i < WORKFLOW_STAGES.length - 1 && <span style={{ color: '#273842', marginLeft: '4px' }}>→</span>}
              </button>
            );
          })}
        </div>

        {/* Readiness Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            Application Readiness:
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '3px 9px',
              borderRadius: '99px',
              fontWeight: 700,
              background: isReadyToApply ? '#0c3123' : '#2b1b08',
              color: isReadyToApply ? '#9af5cf' : '#fbbf24',
              border: isReadyToApply ? '1px solid #1a573f' : '1px solid #4a300d',
            }}
          >
            {isReadyToApply ? '🟢 100% READY TO APPLY' : `🟡 IN PROGRESS (${completedCount}/6)`}
          </span>
        </div>
      </div>
    </div>
  );
}
