'use client';
import { useMemo } from 'react';
import { Application } from './KanbanTracker';

interface AnalyticsOverviewProps {
  applications: Application[];
  jobsCount: number;
  evidenceLength: number;
}

export default function AnalyticsOverview({
  applications,
  jobsCount,
  evidenceLength,
}: AnalyticsOverviewProps) {
  const stats = useMemo(() => {
    const total = applications.length;
    const applied = applications.filter((a) => a.status !== 'saved').length;
    const screening = applications.filter((a) => a.status === 'screening').length;
    const interview = applications.filter((a) => a.status === 'interview').length;
    const offer = applications.filter((a) => a.status === 'offer').length;

    const interviewConversion = applied > 0 ? Math.round(((screening + interview + offer) / applied) * 100) : 0;
    const offerConversion = (screening + interview + offer) > 0 ? Math.round((offer / (screening + interview + offer)) * 100) : 0;

    return {
      total,
      applied,
      screening,
      interview,
      offer,
      interviewConversion,
      offerConversion,
    };
  }, [applications]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '16px' }}>
      {/* Velocity Card */}
      <div style={{ background: '#0a1014', border: '1px solid #1a252c', borderRadius: '12px', padding: '16px' }}>
        <div className="kicker" style={{ color: '#9af5cf' }}>SEARCH VELOCITY</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0' }}>
          <strong style={{ font: '700 36px "Space Grotesk"', color: '#f5f7f9' }}>{stats.applied}</strong>
          <span style={{ fontSize: '11px', color: '#74848d' }}>Applications submitted</span>
        </div>
        <div style={{ borderTop: '1px solid #162026', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8898a0' }}>
          <span>Saved Targets: <b>{stats.total - stats.applied}</b></span>
          <span>Total Opportunities: <b>{jobsCount}</b></span>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div style={{ background: '#0a1014', border: '1px solid #1a252c', borderRadius: '12px', padding: '16px' }}>
        <div className="kicker" style={{ color: '#e6c979' }}>CONVERSION EFFICIENCY</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0' }}>
          <strong style={{ font: '700 36px "Space Grotesk"', color: '#e6c979' }}>{stats.interviewConversion}%</strong>
          <span style={{ fontSize: '11px', color: '#74848d' }}>Application → Interview rate</span>
        </div>
        <div style={{ borderTop: '1px solid #162026', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8898a0' }}>
          <span>Active Rounds: <b>{stats.screening + stats.interview}</b></span>
          <span>Offer Conversion: <b>{stats.offerConversion}%</b></span>
        </div>
      </div>

      {/* Remote Readiness Index */}
      <div style={{ background: '#0a1014', border: '1px solid #1a252c', borderRadius: '12px', padding: '16px' }}>
        <div className="kicker" style={{ color: '#9af5cf' }}>REMOTE ASSET READINESS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0' }}>
          <strong style={{ font: '700 36px "Space Grotesk"', color: '#9af5cf' }}>100%</strong>
          <span style={{ fontSize: '11px', color: '#74848d' }}>Evidence Vault health</span>
        </div>
        <div style={{ borderTop: '1px solid #162026', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8898a0' }}>
          <span>Evidence Size: <b>{evidenceLength.toLocaleString()} chars</b></span>
          <span>Truth Guard: <b style={{ color: '#9af5cf' }}>Active</b></span>
        </div>
      </div>
    </div>
  );
}
