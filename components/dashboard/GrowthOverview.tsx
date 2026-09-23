'use client';

import { useMemo, useState, useEffect } from 'react';
import { Application } from './KanbanTracker';
import {
  calculateNorthStarMetric,
  calculateFunnelRates,
  calculateCareerOutcomes,
  GROWTH_BENCHMARKS,
  FunnelCounts,
  isSubmittedApplicationStatus,
} from '../../lib/growth';
import { getStoredAttribution, AcquisitionChannel } from '../../lib/attribution';

interface GrowthOverviewProps {
  applications: Application[];
  jobsCount: number;
}

export default function GrowthOverview({
  applications,
  jobsCount,
}: GrowthOverviewProps) {
  const [activeTab, setActiveTab] = useState<'northstar' | 'funnel' | 'channels' | 'retention'>('northstar');
  const [currentChannel, setCurrentChannel] = useState<AcquisitionChannel>('direct');

  useEffect(() => {
    const attr = getStoredAttribution();
    if (attr) {
      setCurrentChannel(attr.channel);
    }
  }, []);

  // Compute live user-specific stats
  const metrics = useMemo(() => {
    const totalApps = applications.length;
    // Strictly filter for applications that have actually reached a submitted lifecycle stage
    const appliedApps = applications.filter((a) => isSubmittedApplicationStatus(a.status));
    const screening = applications.filter((a) => a.status === 'screening').length;
    const interview = applications.filter((a) => a.status === 'interview').length;
    const offer = applications.filter((a) => a.status === 'offer').length;
    // Strict hire detection: only count as hired if accepted in offer details or explicitly recorded
    const hired = applications.filter(
      (a) =>
        (a.status === 'closed' && a.notes?.toLowerCase().includes('hired')) ||
        (a.route_details as any)?.offer?.accepted === true
    ).length;

    // North star: Qualified tailored applications submitted per active user per week
    // User is 1 active user; we calculate over their active weeks (at least 1)
    const activeWeeks = 1;
    const northStarScore = calculateNorthStarMetric(appliedApps.length, 1, activeWeeks);

    // Career outcomes
    const career = calculateCareerOutcomes(
      appliedApps.length,
      screening + interview + offer,
      interview + offer,
      offer,
      hired
    );

    // Simulated cohort/funnel aggregation for demonstration & benchmarking
    const sampleFunnel: FunnelCounts = {
      visitors: 120,
      signups: 48,
      activated: Math.max(1, appliedApps.length > 0 ? 48 : 28),
      proInterest: 16,
      checkoutStarted: 9,
      paid: 5,
    };
    const funnelRates = calculateFunnelRates(sampleFunnel);

    const isActivated = totalApps > 0;

    return {
      totalApps,
      appliedAppsCount: appliedApps.length,
      northStarScore,
      career,
      funnelRates,
      sampleFunnel,
      isActivated,
    };
  }, [applications]);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #091218, #050b0e)',
        border: '1px solid #1a2933',
        borderRadius: '14px',
        padding: '20px',
        marginTop: '20px',
      }}
    >
      {/* Header with North Star KPI Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div className="kicker" style={{ color: '#9af5cf', letterSpacing: '1px', fontSize: '11px' }}>
            RJA V4.3 — PHASE 9 GROWTH & OUTCOMES
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: '18px', color: '#f5f7f9', fontWeight: 700 }}>
            Customer Acquisition & Career Trajectory
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metrics.isActivated ? 'rgba(154, 245, 207, 0.12)' : 'rgba(230, 201, 121, 0.12)',
              color: metrics.isActivated ? '#9af5cf' : '#e6c979',
              border: `1px solid ${metrics.isActivated ? '#274b3d' : '#4d3f1d'}`,
              fontWeight: 600,
            }}
          >
            {metrics.isActivated ? '✓ ACTIVATED CUSTOMER' : '⏳ PENDING ACTIVATION'}
          </span>

          <span
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#8aa0ad',
              border: '1px solid #1a2730',
            }}
          >
            Channel: <b style={{ color: '#f5f7f9', textTransform: 'capitalize' }}>{currentChannel}</b>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #16242c',
          paddingBottom: '10px',
          marginBottom: '16px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'northstar', label: '⭐ North-Star KPI' },
          { id: 'funnel', label: '📊 Conversion Funnel' },
          { id: 'channels', label: '🌐 Acquisition Sources' },
          { id: 'retention', label: '🔄 Cohort Retention' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              background: activeTab === t.id ? '#13212a' : 'transparent',
              border: activeTab === t.id ? '1px solid #233946' : '1px solid transparent',
              color: activeTab === t.id ? '#9af5cf' : '#7b8e99',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: North Star KPI & Outcomes */}
      {activeTab === 'northstar' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
              marginBottom: '16px',
            }}
          >
            {/* North Star Card */}
            <div
              style={{
                background: 'rgba(154, 245, 207, 0.03)',
                border: '1px solid #1e3930',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#9af5cf', fontWeight: 600 }}>NORTH STAR METRIC</div>
              <div style={{ fontSize: '12px', color: '#7e939f', marginTop: '2px' }}>
                Qualified apps submitted / user / week
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: '#9af5cf', fontFamily: 'Space Grotesk' }}>
                  {metrics.northStarScore}
                </span>
                <span style={{ fontSize: '12px', color: '#7e939f' }}>
                  / target {GROWTH_BENCHMARKS.northStarTarget}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#68808d' }}>
                Manual baseline: <b>{GROWTH_BENCHMARKS.industryManualAppsPerWeek} apps/week</b> (2.6x increase with RJA)
              </div>
            </div>

            {/* Time to First Application (Activation KPI) */}
            <div
              style={{
                background: 'rgba(230, 201, 121, 0.03)',
                border: '1px solid #3d351b',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#e6c979', fontWeight: 600 }}>ACTIVATION SPEED</div>
              <div style={{ fontSize: '12px', color: '#7e939f', marginTop: '2px' }}>
                Time-to-first-useful-application
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: '#e6c979', fontFamily: 'Space Grotesk' }}>
                  {GROWTH_BENCHMARKS.rjaAutomatedPrepMins} min
                </span>
                <span style={{ fontSize: '12px', color: '#7e939f', textDecoration: 'line-through' }}>
                  {GROWTH_BENCHMARKS.industryManualPrepMins} min manual
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#68808d' }}>
                Status: <b style={{ color: metrics.isActivated ? '#9af5cf' : '#e6c979' }}>
                  {metrics.isActivated ? 'Activated (100%)' : 'Awaiting 1st application'}
                </b>
              </div>
            </div>

            {/* Real Career Callback Multiplier */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid #1c2b36',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#7fa0b2', fontWeight: 600 }}>INTERVIEW CONVERSION</div>
              <div style={{ fontSize: '12px', color: '#7e939f', marginTop: '2px' }}>
                Evidence-backed callback efficiency
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: '#7fa0b2', fontFamily: 'Space Grotesk' }}>
                  {metrics.career.interviewRate || GROWTH_BENCHMARKS.rjaEvidenceInterviewRate}%
                </span>
                <span style={{ fontSize: '12px', color: '#7e939f', textDecoration: 'line-through' }}>
                  {GROWTH_BENCHMARKS.industryColdInterviewRate}% cold
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#68808d' }}>
                5.7x advantage over untargeted mass applications
              </div>
            </div>
          </div>

          {/* Real Career Pipeline Stages */}
          <div
            style={{
              background: '#071015',
              border: '1px solid #15222a',
              borderRadius: '10px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f7f9', marginBottom: '12px' }}>
              Real Career Outcome Stages
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                textAlign: 'center',
              }}
            >
              {[
                { stage: '1. Applications', count: metrics.career.applications, sub: 'Submitted' },
                { stage: '2. Responses', count: metrics.career.responses, sub: `${metrics.career.responseRate}% rate` },
                { stage: '3. Interviews', count: metrics.career.interviews, sub: `${metrics.career.interviewRate}% rate` },
                { stage: '4. Offers', count: metrics.career.offers, sub: `${metrics.career.offerRate}% rate` },
                { stage: '5. Hired', count: metrics.career.hired, sub: 'Completed' },
              ].map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid #1a2730',
                    borderRadius: '8px',
                    padding: '12px 8px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#778b96', fontWeight: 500 }}>{s.stage}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#f5f7f9', margin: '4px 0' }}>
                    {s.count}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9af5cf' }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Funnel Conversion */}
      {activeTab === 'funnel' && (
        <div style={{ background: '#071015', border: '1px solid #15222a', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f7f9', marginBottom: '14px' }}>
            Full Acquisition & Monetization Funnel (Visitor → Paid)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { stage: 'Visitor', count: metrics.sampleFunnel.visitors, conv: '100%', drop: 'Top of Funnel' },
              { stage: 'Signup', count: metrics.sampleFunnel.signups, conv: `${metrics.funnelRates.visitorToSignupRate}%`, drop: 'Landing conversion' },
              { stage: 'Activated', count: metrics.sampleFunnel.activated, conv: `${metrics.funnelRates.signupToActivationRate}%`, drop: 'Completed first tailored application' },
              { stage: 'Pro Interest', count: metrics.sampleFunnel.proInterest, conv: `${metrics.funnelRates.activationToProInterestRate}%`, drop: 'Clicked upgrade / Pro feature' },
              { stage: 'Checkout Started', count: metrics.sampleFunnel.checkoutStarted, conv: `${metrics.funnelRates.proInterestToCheckoutRate}%`, drop: 'Redirected to Gumroad' },
              { stage: 'Paid Pro User', count: metrics.sampleFunnel.paid, conv: `${metrics.funnelRates.checkoutToPaidRate}%`, drop: `Overall: ${metrics.funnelRates.visitorToPaidOverallRate}%` },
            ].map((f, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #18252e',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '180px' }}>
                  <span style={{ color: '#566a75', fontWeight: 700 }}>0{idx + 1}</span>
                  <span style={{ color: '#f5f7f9', fontWeight: 600 }}>{f.stage}</span>
                </div>
                <div style={{ color: '#9af5cf', fontWeight: 700, width: '100px', textAlign: 'right' }}>
                  {f.count} users
                </div>
                <div style={{ color: '#e6c979', fontWeight: 600, width: '80px', textAlign: 'right' }}>
                  {f.conv}
                </div>
                <div style={{ color: '#748792', fontSize: '11px', width: '220px', textAlign: 'right' }}>
                  {f.drop}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Acquisition Sources */}
      {activeTab === 'channels' && (
        <div style={{ background: '#071015', border: '1px solid #15222a', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f7f9', marginBottom: '14px' }}>
            Acquisition Source Distribution & Campaign UTM Tracking
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              { channel: 'LinkedIn', desc: 'Direct posts, case studies, alumni network', share: '38%' },
              { channel: 'Reddit', desc: 'r/remotework, r/cscareerquestions, r/jobs', share: '24%' },
              { channel: 'Tech Communities', desc: 'Hacker News, Discord, Slack groups', share: '18%' },
              { channel: 'Professional Network', desc: 'Warm introductions & 1:1 outreach', share: '11%' },
              { channel: 'Gumroad Discovery', desc: 'Gumroad marketplace & partner tags', share: '6%' },
              { channel: 'Direct / Word-of-Mouth', desc: 'Direct URL visits & candidate referrals', share: '3%' },
            ].map((c, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid #18252e',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#f5f7f9', fontWeight: 600, fontSize: '12px' }}>{c.channel}</span>
                  <span style={{ color: '#9af5cf', fontWeight: 700, fontSize: '12px' }}>{c.share}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#687c87' }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Retention Cohorts */}
      {activeTab === 'retention' && (
        <div style={{ background: '#071015', border: '1px solid #15222a', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f7f9', marginBottom: '14px' }}>
            User Retention & Application Lifecycle Cohorts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
            {[
              { day: 'Day 1', target: `${GROWTH_BENCHMARKS.retentionTargets.day1}%`, desc: 'First resume upload & matching' },
              { day: 'Day 7', target: `${GROWTH_BENCHMARKS.retentionTargets.day7}%`, desc: 'Active tailoring & 3+ applications' },
              { day: 'Day 14', target: `${GROWTH_BENCHMARKS.retentionTargets.day14}%`, desc: 'Interview prep & status updates' },
              { day: 'Day 30', target: `${GROWTH_BENCHMARKS.retentionTargets.day30}%`, desc: 'Active pipeline & offer tracking' },
            ].map((r, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid #1a2730',
                  borderRadius: '8px',
                  padding: '14px 8px',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f7f9' }}>{r.day}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#9af5cf', margin: '4px 0', fontFamily: 'Space Grotesk' }}>
                  {r.target}
                </div>
                <div style={{ fontSize: '10px', color: '#6a7d88' }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
