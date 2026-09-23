'use client';
import { useState, useMemo } from 'react';
import { trackEvent } from '../../lib/analytics';

interface OnboardingGuideProps {
  hasResume: boolean;
  jobsCount: number;
  hasActiveJob: boolean;
  hasApplication: boolean;
  onNavigateTab: (tab: string) => void;
}

export default function OnboardingGuide({
  hasResume,
  jobsCount,
  hasActiveJob,
  hasApplication,
  onNavigateTab,
}: OnboardingGuideProps) {
  const [dismissed, setDismissed] = useState(false);

  const steps = useMemo(() => {
    return [
      {
        id: 'profile',
        title: '1. Profile & Evidence',
        desc: 'Upload your master resume or enter skills',
        completed: hasResume,
        tab: 'Profile',
      },
      {
        id: 'discovery',
        title: '2. Curated Roles',
        desc: 'Browse discovered remote jobs matching your background',
        completed: jobsCount > 0,
        tab: 'Job Discovery',
      },
      {
        id: 'select',
        title: '3. Select Canonical Job',
        desc: '1-Click select a role to evaluate fit & positioning',
        completed: hasActiveJob,
        tab: 'Job Workspace',
      },
      {
        id: 'apply',
        title: '4. Tailor & Submit',
        desc: 'Audit ATS fidelity, generate cover letter, and submit',
        completed: hasApplication,
        tab: 'Job Workspace',
      },
    ];
  }, [hasResume, jobsCount, hasActiveJob, hasApplication]);

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (dismissed || (completedCount === steps.length && hasApplication)) {
    return null;
  }

  const nextStep = steps.find((s) => !s.completed) || steps[0];

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(10, 25, 20, 0.95), rgba(15, 20, 25, 0.95))',
        border: '1px solid rgba(154, 245, 207, 0.3)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f5f7f9', letterSpacing: '0.02em' }}>
              FAST-TRACK: YOUR FIRST TAILORED APPLICATION
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#9baab3' }}>
              Target: Reach your first high-conviction submission in under 10 minutes.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#9af5cf' }}>
            {completedCount} of 4 completed ({progressPercent}%)
          </span>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#657780',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
            }}
            title="Dismiss guide"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div
        style={{
          height: '6px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #9af5cf, #62dca5)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* 4 Steps Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
        }}
      >
        {steps.map((s, idx) => (
          <div
            key={s.id}
            onClick={() => {
              trackEvent('why_match_opened', { step: s.id });
              onNavigateTab(s.tab);
            }}
            style={{
              background: s.completed ? 'rgba(154, 245, 207, 0.06)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${s.completed ? 'rgba(154, 245, 207, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '8px',
              padding: '10px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: s.completed ? '#9af5cf' : '#d2d9dc' }}>
                {s.title}
              </span>
              <span>{s.completed ? '✅' : '○'}</span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#8898a0', lineHeight: 1.3 }}>
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Action Prompt */}
      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            trackEvent('application_started', { nextStep: nextStep.id });
            onNavigateTab(nextStep.tab);
          }}
          style={{
            background: '#9af5cf',
            color: '#06130e',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Proceed to: {nextStep.title} →
        </button>
      </div>
    </div>
  );
}
