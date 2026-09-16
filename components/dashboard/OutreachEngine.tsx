'use client';
import { useState } from 'react';

interface OutreachEngineProps {
  job: any;
  jobText: string;
  resume: string;
  onNotice: (msg: string) => void;
}

export default function OutreachEngine({
  job,
  jobText,
  resume,
  onNotice,
}: OutreachEngineProps) {
  const [recipient, setRecipient] = useState<'recruiter' | 'hiring_manager' | 'peer'>('recruiter');
  const [loading, setLoading] = useState(false);
  const [outreach, setOutreach] = useState<any>(null);

  const role = job?.title || 'Target Role';
  const company = job?.company || 'Target Company';

  const generateOutreach = async () => {
    if (!jobText && !resume) {
      onNotice('Please make sure you have saved evidence and an active job.');
      return;
    }
    setLoading(true);
    setOutreach(null);
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: role,
          company,
          job_description: jobText,
          resume,
          recipient_type: recipient,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate outreach');
      setOutreach(data);
      onNotice('Cold networking messages generated!');
    } catch (e: any) {
      onNotice(e.message || 'Could not generate outreach.');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    onNotice(`${label} copied to clipboard.`);
  };

  return (
    <div>
      {/* Configuration Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <b style={{ fontSize: '14px', color: '#f5f7f9', display: 'block' }}>
            Target: {role} <span style={{ color: '#9af5cf' }}>· {company}</span>
          </b>
          <span style={{ fontSize: '11px', color: '#718189' }}>
            Generate high-conversion messages grounded in your verified evidence.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="tab-row">
            <button
              className={`tab-btn ${recipient === 'recruiter' ? 'active' : ''}`}
              onClick={() => setRecipient('recruiter')}
            >
              Recruiter
            </button>
            <button
              className={`tab-btn ${recipient === 'hiring_manager' ? 'active' : ''}`}
              onClick={() => setRecipient('hiring_manager')}
            >
              Hiring Manager
            </button>
            <button
              className={`tab-btn ${recipient === 'peer' ? 'active' : ''}`}
              onClick={() => setRecipient('peer')}
            >
              Peer Lead
            </button>
          </div>

          <button
            className="primary"
            onClick={generateOutreach}
            disabled={loading}
            style={{ padding: '7px 14px', fontSize: '11px' }}
          >
            {loading ? 'Crafting Pitches…' : 'Generate Outreach →'}
          </button>
        </div>
      </div>

      {/* Generated Content */}
      {outreach && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {/* Card 1: LinkedIn Connection Note */}
          <div className="outreach-card">
            <div className="outreach-header">
              <div>
                <b>1. LinkedIn Connection Request</b>
                <small style={{ display: 'block', color: '#6e7e86', fontSize: '9px' }}>
                  Strict &lt; 300 character limit for instant acceptance
                </small>
              </div>
              <span
                style={{
                  fontSize: '9px',
                  color: (outreach.linkedin_invite?.length || 0) <= 300 ? '#9af5cf' : '#e69f70',
                  background: '#101c18',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {outreach.linkedin_invite?.length || 0} / 300 chars
              </span>
            </div>
            <div className="outreach-body">{outreach.linkedin_invite}</div>
            <button
              className="secondary"
              style={{ width: '100%', fontSize: '10px', padding: '6px' }}
              onClick={() => copy(outreach.linkedin_invite, 'LinkedIn note')}
            >
              📋 Copy LinkedIn Note
            </button>
          </div>

          {/* Card 2: Full InMail / Cold Email */}
          <div className="outreach-card">
            <div className="outreach-header">
              <div>
                <b>2. Executive InMail / Direct Email Pitch</b>
                <small style={{ display: 'block', color: '#6e7e86', fontSize: '9px' }}>
                  Hook, 2 verified proof points, low-friction ask
                </small>
              </div>
            </div>
            {Array.isArray(outreach.inmail_or_email_pitch?.subject_lines) && (
              <div style={{ marginBottom: '8px', fontSize: '10px', color: '#8898a0' }}>
                <b style={{ color: '#d9e0e3' }}>Subject Line:</b>{' '}
                {outreach.inmail_or_email_pitch.subject_lines[0]}
              </div>
            )}
            <div className="outreach-body">{outreach.inmail_or_email_pitch?.body}</div>
            <button
              className="secondary"
              style={{ width: '100%', fontSize: '10px', padding: '6px' }}
              onClick={() => copy(outreach.inmail_or_email_pitch?.body, 'Email pitch')}
            >
              📋 Copy Email Pitch
            </button>
          </div>

          {/* Card 3: 5-Day Follow-Up */}
          <div className="outreach-card">
            <div className="outreach-header">
              <div>
                <b>3. Strategic 5-Day Follow-Up</b>
                <small style={{ display: 'block', color: '#6e7e86', fontSize: '9px' }}>
                  Value-add follow up without being pushy
                </small>
              </div>
            </div>
            <div className="outreach-body">{outreach.follow_up_nudge}</div>
            <button
              className="secondary"
              style={{ width: '100%', fontSize: '10px', padding: '6px' }}
              onClick={() => copy(outreach.follow_up_nudge, 'Follow-up message')}
            >
              📋 Copy Follow-Up
            </button>
          </div>
        </div>
      )}

      {!outreach && (
        <div className="empty">
          Click <b>Generate Outreach →</b> to create bespoke cold networking pitches tailored for recruiters and hiring managers.
        </div>
      )}
    </div>
  );
}
