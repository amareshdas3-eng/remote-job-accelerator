'use client';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import KanbanTracker, { Application } from './dashboard/KanbanTracker';
import AtsResumeStudio, { getFullResumeText } from './dashboard/AtsResumeStudio';
import InterviewSimulator from './dashboard/InterviewSimulator';
import OutreachEngine from './dashboard/OutreachEngine';
import OpportunityWorkspace, { SavedJob } from './dashboard/OpportunityWorkspace';
import AnalyticsOverview from './dashboard/AnalyticsOverview';

type Job = any;
type App = any;

const steps = [
  'Profile',
  'Job Search',
  'Job Matching',
  'Resume Tailoring',
  'Interview Prep',
  'Outreach',
  'Pipeline & Apply',
];

export default function Dashboard({ email }: { email: string }) {
  const [step, setStep] = useState('Profile');
  const [resume, setResume] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [tailor, setTailor] = useState<any>(null);
  const [cover, setCover] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pro, setPro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [fileName, setFileName] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    fetch('/api/workflow')
      .then(async (r) => {
        const x = await r.json();
        if (r.ok) {
          setPro(!!x.entitled);
          setUserProfile(x.profile || { email });
          setResume(x.profile?.resume_text || '');
          setFileName(x.profile?.resume_filename || '');
          setApps(x.applications || []);
          setJobs(x.jobs || []);
          setInterviews(x.interviews || []);
          if (!x.entitled) setShowPaywall(true);
        }
      })
      .catch(() => setNotice('Could not load your workspace. Refresh to retry.'));
  }, [email]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setShowSettings(false);
        setShowPaywall(false);
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= steps.length) {
        setStep(steps[num - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const call = async (path: string, body: any) => {
    setBusy(true);
    setNotice('');
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 402) {
          setShowPaywall(true);
          setNotice('Pro access is required for this action.');
          return null;
        }
        setNotice(j.error || 'Something went wrong');
        return null;
      }
      return j;
    } catch (e: any) {
      setNotice(e.message || 'Request failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveEvidence = async () => {
    const j = await call('/api/resume/upload', {
      text: resume,
      filename: fileName || 'master-resume.txt',
      mime: 'text/plain',
    });
    if (!j) return false;
    setNotice('Evidence Vault saved. Your verified source of truth is ready.');
    return true;
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setNotice('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/resume/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Resume upload failed');
      setResume(j.text);
      setFileName(file.name);
      setNotice('Resume imported and extracted successfully. Review it before saving.');
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ingest = async () => {
    if (!pro) {
      setShowPaywall(true);
      return false;
    }
    if (jobUrl) {
      const j = await call('/api/jobs/ingest', { url: jobUrl });
      if (!j) return false;
      setJobText(j.text);
      setJob({ url: j.url, title: j.title, company: j.company, id: j.job_id || null });
    } else if (jobText.trim()) {
      setJob({ url: null, title: 'Target Role', company: 'Target Company', id: null });
    } else {
      setNotice('Please enter a job URL or paste the job description.');
      return false;
    }
    setNotice('Job listing captured and ready for fit matching.');
    return true;
  };

  const runMatch = async () => {
    const j = await call('/api/ai/job-match', { job: jobText, resume, url: job?.url });
    if (!j) return false;
    setMatch(j);
    if (j.job_id) {
      setJob((prev: any) => ({ ...prev, id: j.job_id }));
      // Automatically refresh saved jobs
      const newJobRecord: SavedJob = {
        id: j.job_id,
        title: job?.title || 'Target Role',
        company: job?.company || 'Target Company',
        url: job?.url || jobUrl,
        description: jobText,
        match: j,
        created_at: new Date().toISOString(),
      };
      setJobs((prev) => [newJobRecord, ...prev.filter((x) => x.id !== j.job_id)]);
    }
    return true;
  };

  const runTailor = async () => {
    const j = await call('/api/ai/resume-tailor', { job: jobText, resume, job_id: match?.job_id || job?.id });
    if (!j) return false;
    setTailor(j);
    setNotice('100% ATS-ready resume generated!');
    return true;
  };

  const runCover = async () => {
    const j = await call('/api/ai/cover-letter', {
      job: jobText,
      resume,
      job_id: match?.job_id || job?.id,
      tailored_resume: tailor,
    });
    if (!j) return false;
    setCover(j);
    setNotice('Role-aligned cover letter created!');
    return true;
  };

  const runInterview = async () => {
    const j = await call('/api/ai/interview', { job: jobText, resume, job_id: match?.job_id || job?.id });
    if (!j) return false;
    setInterview(j);
    setNotice('Interview rehearsal coach prepared!');
    return true;
  };

  const addApp = async (statusOverride = 'ready_to_apply') => {
    const r = await call('/api/applications', {
      company: job?.company || 'Target company',
      role: job?.title || 'Target role',
      job_url: job?.url || jobUrl,
      status: statusOverride,
      job_id: match?.job_id || job?.id,
    });
    if (!r) return;
    setApps((a) => [r.application, ...a.filter((x) => x.id !== r.application.id)]);
    setNotice(`Added to application pipeline as "${statusOverride.replace(/_/g, ' ').toUpperCase()}".`);
  };

  const updateAppStatus = async (id: string, status: string) => {
    try {
      const r = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Update failed');
      setApps((a) => a.map((x) => (x.id === id ? j.application : x)));
    } catch (e: any) {
      setNotice(e.message);
    }
  };

  const updateAppNotes = async (id: string, notes: string) => {
    try {
      const r = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Notes update failed');
      setApps((a) => a.map((x) => (x.id === id ? j.application : x)));
      setNotice('Application notes saved.');
    } catch (e: any) {
      setNotice(e.message);
    }
  };

  const selectOpportunity = (j: SavedJob) => {
    setJob({ url: j.url, title: j.title, company: j.company, id: j.id });
    setJobText(j.description || '');
    setJobUrl(j.url || '');
    setMatch(j.match || null);
    setTailor(j.tailored_resume || null);
    setCover(j.cover_letter ? (j.cover_letter.letter ? j.cover_letter : { letter: j.cover_letter }) : null);
    const matchedInt = interviews.find((int: any) => int.job_id === j.id);
    setInterview(matchedInt?.plan || null);
    setStep(j.tailored_resume ? 'Resume Tailoring' : j.match ? 'Job Matching' : 'Job Search');
    setNotice(`Switched active workspace to ${j.title || 'selected opportunity'}.`);
  };

  const selectJobById = (jobId?: string) => {
    if (!jobId) return;
    const target = jobs.find((j) => j.id === jobId);
    if (target) {
      selectOpportunity(target);
    } else {
      setStep('Job Search');
    }
  };

  const startNewOpportunity = () => {
    setJob(null);
    setJobText('');
    setJobUrl('');
    setMatch(null);
    setTailor(null);
    setCover(null);
    setInterview(null);
    setStep('Job Search');
    setNotice('Ready to analyze a new target role.');
  };

  const signout = async () => {
    const s = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await s.auth.signOut();
    location.href = '/login';
  };

  const score = useMemo(() => (typeof match?.score === 'number' ? match.score : null), [match]);
  const saved = resume.length >= 80;

  // Continuous Guided Workflow Navigation Helpers
  const currentStepIndex = steps.indexOf(step);
  const canGoBack = currentStepIndex > 0;
  const canGoNext = currentStepIndex < steps.length - 1;

  const goPrevious = () => {
    if (canGoBack) setStep(steps[currentStepIndex - 1]);
  };

  const goNext = async () => {
    if (step === 'Profile') {
      if (!saved) {
        setNotice('Please paste or upload your resume evidence before proceeding.');
        return;
      }
      await saveEvidence();
      setStep('Job Search');
    } else if (step === 'Job Search') {
      if (!jobText.trim() && !jobUrl.trim()) {
        setNotice('Please enter a job URL or paste the job description.');
        return;
      }
      if (!job) {
        const ok = await ingest();
        if (ok) setStep('Job Matching');
      } else {
        setStep('Job Matching');
      }
    } else if (step === 'Job Matching') {
      if (!match) {
        const ok = await runMatch();
        if (ok) setStep('Resume Tailoring');
      } else {
        setStep('Resume Tailoring');
      }
    } else if (step === 'Resume Tailoring') {
      if (!tailor) {
        const ok = await runTailor();
        if (ok) setStep('Interview Prep');
      } else {
        setStep('Interview Prep');
      }
    } else if (step === 'Interview Prep') {
      if (!interview) {
        const ok = await runInterview();
        if (ok) setStep('Outreach');
      } else {
        setStep('Outreach');
      }
    } else if (step === 'Outreach') {
      setStep('Pipeline & Apply');
    }
  };

  return (
    <main className="shell">
      {/* Sidebar Navigation */}
      <aside className={'sidebar ' + (mobileMenu ? 'open' : '')}>
        <div className="brand">
          <span className="brandmark">R</span>
          <div>
            <b>Remote Job</b>
            <small>ACCELERATOR PRO</small>
          </div>
        </div>
        <div className="workspace-label">CAREER OPERATING SYSTEM</div>
        {steps.map((s, i) => {
          const isDone = steps.indexOf(step) > i;
          return (
            <button
              key={s}
              className={step === s ? 'nav active' : 'nav'}
              onClick={() => {
                setStep(s);
                setMobileMenu(false);
              }}
            >
              <span>{isDone ? '✓' : String(i + 1).padStart(2, '0')}</span>
              {s}
            </button>
          );
        })}
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{email[0]?.toUpperCase()}</div>
            <div>
              <b>{email}</b>
              <small>{pro ? 'Pro Executive Workspace' : 'Free Workspace'}</small>
            </div>
          </div>
          <button className="logout" onClick={() => setShowSettings(true)}>
            Settings
          </button>
          <button className="logout" onClick={signout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileMenu((v) => !v)}>
            ☰
          </button>
          <div>
            <div className="kicker">REMOTE JOB ACCELERATOR · V4.3 PRO</div>
            <h1>Executive Command Center</h1>
            <p className="top-sub">
              Profile → Job Discovery → Fit Matching → ATS Resume & Cover Letter → Interview Rehearsal → Direct Apply.
            </p>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings (Esc to close)">
              ⚙
            </button>
            <div className="status">
              <span className="dot" /> Evidence-first AI <strong>{pro ? 'PRO' : 'FREE'}</strong>
            </div>
          </div>
        </header>

        {!pro && (
          <div className="trial-banner">
            <div>
              <b>Unlock the World-Class Workflow</b>
              <span>Pro unlocks fit analysis, 100% ATS resumes, interview simulation, cold outreach pitches, and pipeline analytics.</span>
            </div>
            <a href={process.env.NEXT_PUBLIC_GUMROAD_URL || 'https://4217411968942.gumroad.com/l/remote-job-complete'}>
              Get Pro Access →
            </a>
          </div>
        )}

        {/* Opportunity Switcher Bar */}
        <OpportunityWorkspace
          jobs={jobs}
          activeJobId={job?.id || null}
          onSelectJob={selectOpportunity}
          onNewJob={startNewOpportunity}
        />

        {/* Interactive Guided Stepper Progress Bar */}
        <div className="progress">
          {steps.map((s, i) => {
            const isDone = steps.indexOf(step) > i;
            const isCurrent = step === s;
            return (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={(isDone ? 'done ' : '') + (isCurrent ? 'current' : '')}
                title={`Jump to ${s}`}
              >
                <span>{isDone ? '✓' : i + 1}</span>
                <label>{s}</label>
              </button>
            );
          })}
        </div>

        {notice && (
          <div className="notice">
            <span>!</span>
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}

        {/* STEP 1: Profile & Evidence Vault */}
        {step === 'Profile' && (
          <Card
            title="Profile & Master Evidence Vault"
            sub="Your verified career evidence is the only source RJA uses for factual claims. Keep this master record richer than any single resume."
          >
            <div className="vault-grid">
              <div>
                <div className="upload-drop">
                  <input
                    id="resume-file"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                  />
                  <label htmlFor="resume-file">
                    <b>↑ Import PDF, DOCX or TXT</b>
                    <span>{busy ? 'Extracting…' : 'Up to 5 MB · text is extracted locally on the server'}</span>
                  </label>
                </div>
                <textarea
                  className="large"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Paste your master resume, verified achievements, skills, projects and career evidence…"
                />
              </div>
              <div className="side-note">
                <div className="metric">
                  <strong>{resume.length.toLocaleString()}</strong>
                  <span>characters captured</span>
                </div>
                <div className="check">✓ Evidence-first generation</div>
                <div className="check">✓ No fabricated claims</div>
                <div className="check">✓ Reusable across applications</div>
                <div className="check">✓ Export/delete controls</div>
              </div>
            </div>
            <div className="actionbar">
              <div className="micro">
                {saved ? 'Ready to use' : 'Add at least 80 characters'}
                {fileName && ' · ' + fileName}
              </div>
              <button className="primary" disabled={busy || !saved} onClick={saveEvidence}>
                {busy ? 'Saving…' : 'Save evidence & continue →'}
              </button>
            </div>
          </Card>
        )}

        {/* STEP 2: Job Search & Discovery */}
        {step === 'Job Search' && (
          <Card
            title="Job Search & Ingestion"
            sub="Paste a job description or import a public listing. RJA preserves the original posting so every analysis and resume decision remains auditable."
          >
            <div className="job-source-cards">
              <button className="source-card" onClick={() => document.getElementById('job-url')?.focus()}>
                <b>🔗 Public URL</b>
                <span>LinkedIn · Greenhouse · Lever · Ashby</span>
              </button>
              <button className="source-card" onClick={() => document.getElementById('job-text')?.focus()}>
                <b>✎ Paste description</b>
                <span>Best for portals, PDFs, and internal job boards</span>
              </button>
              <div className="source-card">
                <b>▣ Browser Extension</b>
                <span>Capture jobs from any web page</span>
              </div>
            </div>
            <div className="field">
              <label>JOB URL</label>
              <input
                id="job-url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/… or Greenhouse / Lever URL"
              />
            </div>
            <div className="divider">
              <span>OR PASTE JOB DESCRIPTION</span>
            </div>
            <textarea
              id="job-text"
              className="large short"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the role title, responsibilities, technical requirements, remote location parameters, and compensation info…"
            />
            <div className="actionbar">
              <div className="micro">
                {job?.title ? `Target: ${job.title} · ${job.company}` : 'Supported: LinkedIn · Greenhouse · Lever · Ashby'}
              </div>
              <button className="primary" disabled={busy || (!jobUrl && !jobText)} onClick={ingest}>
                {busy ? 'Reading job…' : 'Analyze opportunity →'}
              </button>
            </div>
          </Card>
        )}

        {/* STEP 3: Fit Intelligence & Matching */}
        {step === 'Job Matching' && (
          <Card
            title="Fit Intelligence & Gap Analysis"
            sub="Understand exactly how your verified evidence matches the role requirements: signals, evidence mappings, confidence, and gaps."
          >
            <div className="split">
              <div className="score">
                <span>FIT SCORE</span>
                <strong>{score ?? '—'}</strong>
                <small>/ 100</small>
                <div className="scorebar">
                  <i style={{ width: `${Math.max(0, Math.min(100, score || 0))}%` }} />
                </div>
                <p>{match?.verdict || 'Ready to analyze'}</p>
              </div>
              <div className="evidence-list">
                <div className="section-title">
                  <h3>Requirement map</h3>
                  <span>{match?.matched_requirements?.length || 0} signals</span>
                </div>
                {(match?.matched_requirements || []).slice(0, 8).map((x: any, i: number) => (
                  <div className="e-row" key={i}>
                    <span className={(x.status || 'review').toLowerCase()}>{x.status || 'review'}</span>
                    <b>{x.requirement}</b>
                    <small>{x.evidence}</small>
                  </div>
                ))}
                {!match && <p className="muted">Run the analysis to map the role against your verified evidence.</p>}
              </div>
            </div>
            <div className="actionbar">
              <div className="micro">No fabrication · gaps stay visible</div>
              <button className="primary" disabled={busy || !jobText} onClick={runMatch}>
                {busy ? 'Analyzing…' : 'Run evidence match →'}
              </button>
            </div>
          </Card>
        )}

        {/* STEP 4: 100% ATS Resume & Cover Letter Studio */}
        {step === 'Resume Tailoring' && (
          <Card
            title="100% ATS Ready Resume & Cover Letter Studio"
            sub="Create a role-aligned, ATS-optimized resume and matching cover letter preserving every verified factual claim. Universal parser compatibility guaranteed."
          >
            <AtsResumeStudio
              tailor={tailor}
              cover={cover}
              busy={busy}
              onRunTailor={runTailor}
              onRunCover={runCover}
              onNotice={setNotice}
              onSaveToPipeline={() => addApp('ready_to_apply')}
            />
            <div className="actionbar">
              <div className="micro">
                {tailor ? '100% ATS Ready draft created' : 'Generate your ATS-ready resume first'}
              </div>
              <div className="button-group">
                <button className="secondary" disabled={busy || !tailor} onClick={runCover}>
                  {busy ? 'Writing…' : '＋ Tailored Cover Letter'}
                </button>
                <button className="primary" disabled={busy} onClick={runTailor}>
                  {busy ? 'Tailoring…' : 'Generate ATS tailored resume →'}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 5: Interactive Interview Simulator */}
        {step === 'Interview Prep' && (
          <Card
            title="Interview Simulator & STAR Answer Coach"
            sub="Practice role-specific questions grounded in the job requirements and your evidence. Receive real-time STAR coaching on your practice answers."
          >
            <InterviewSimulator
              interview={interview}
              jobText={jobText}
              resume={resume}
              busy={busy}
              onRunInterview={runInterview}
              onNotice={setNotice}
            />
            <div className="actionbar">
              <div className="micro">Role-specific · evidence grounded · STAR framework</div>
              <button className="primary" disabled={busy} onClick={runInterview}>
                {busy ? 'Building coach…' : 'Build interview coach →'}
              </button>
            </div>
          </Card>
        )}

        {/* STEP 6: Cold Outreach Engine */}
        {step === 'Outreach' && (
          <Card
            title="Remote Networking & Cold Outreach Engine"
            sub="Bypass the applicant black hole. Generate high-converting, personalized messages for recruiters, hiring managers, and peer engineers."
          >
            <OutreachEngine
              job={job}
              jobText={jobText}
              resume={resume}
              onNotice={setNotice}
            />
          </Card>
        )}

        {/* STEP 7: Pipeline Kanban Tracker & Direct Apply */}
        {step === 'Pipeline & Apply' && (
          <Card
            title="Application Pipeline & Career CRM"
            sub="Track every application across stages from Selected to Offer. Open complete company dossiers, execute 1-click web apply, or send verified email applications."
          >
            <KanbanTracker
              applications={apps}
              jobs={jobs}
              interviews={interviews}
              userProfile={userProfile}
              onUpdateStatus={updateAppStatus}
              onUpdateNotes={updateAppNotes}
              onSelectJob={selectJobById}
              onAddCurrentOpportunity={() => addApp('selected')}
              hasActiveJob={!!jobText}
              activeJobTitle={job?.title}
            />
            <AnalyticsOverview
              applications={apps}
              jobsCount={jobs.length}
              evidenceLength={resume.length}
            />
          </Card>
        )}

        {/* Continuous Guided Journey Bar */}
        <div className="journey-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '14px 18px', background: '#0a1014', border: '1px solid #1c282e', borderRadius: '10px' }}>
          <button
            className="secondary"
            disabled={!canGoBack || busy}
            onClick={goPrevious}
            style={{ fontSize: '11px', padding: '8px 16px' }}
          >
            ← Previous: {canGoBack ? steps[currentStepIndex - 1] : 'Start'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block' }}>
              STEP {currentStepIndex + 1} OF {steps.length}
            </span>
            <strong style={{ fontSize: '12px', color: '#9af5cf' }}>{step}</strong>
            {job?.title && <small style={{ color: '#8898a0', marginLeft: '6px' }}>· {job.title} at {job.company}</small>}
          </div>

          <button
            className="primary"
            disabled={busy}
            onClick={goNext}
            style={{ fontSize: '11px', padding: '8px 16px' }}
          >
            {canGoNext ? `Continue to ${steps[currentStepIndex + 1]} →` : 'View Tracked Applications →'}
          </button>
        </div>

        <footer>Private workspace · Evidence remains yours · AI proposes, you decide · v4.3 PRO</footer>
      </section>

      {/* Settings Modal */}
      {showSettings && (
        <Settings email={email} onClose={() => setShowSettings(false)} onSignout={signout} />
      )}

      {/* Paywall Modal */}
      {showPaywall && <Paywall onClose={() => setShowPaywall(false)} />}
    </main>
  );
}

function Card({ title, sub, children }: { title: string; sub: string; children: any }) {
  return (
    <div className="card-panel">
      <div className="card-head">
        <div>
          <div className="kicker">WORKFLOW STEP</div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
        <span className="secure">● ENCRYPTED WORKSPACE</span>
      </div>
      {children}
    </div>
  );
}

function Paywall({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal paywall">
        <button className="modal-x" onClick={onClose}>
          ×
        </button>
        <div className="pay-icon">✦</div>
        <div className="kicker">PRO WORKFLOW</div>
        <h2>Turn every job into a stronger application</h2>
        <p>Unlock the complete evidence-first workflow built for serious remote job searches.</p>
        <div className="feature-list">
          <div>✓ Fit score + requirement evidence</div>
          <div>✓ 100% ATS-ready resume + cover letter</div>
          <div>✓ STAR interview rehearsal coach & answer feedback</div>
          <div>✓ Recruiter & hiring manager outreach engine</div>
          <div>✓ Interactive Kanban application pipeline</div>
          <div>✓ Multi-opportunity workspace dossier</div>
        </div>
        <a
          className="primary wide"
          href={process.env.NEXT_PUBLIC_GUMROAD_URL || 'https://4217411968942.gumroad.com/l/remote-job-complete'}
        >
          Unlock Pro access →
        </a>
        <small>Secure checkout · Activate with the same email you use for RJA</small>
      </div>
    </div>
  );
}

function Settings({ email, onClose, onSignout }: { email: string; onClose: () => void; onSignout: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const exportData = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/account/export');
      const j = await r.json();
      const blob = new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rja-account-export.json';
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg('Export downloaded.');
    } catch {
      setMsg('Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm('Delete your RJA account and stored workflow data? This cannot be undone.')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!r.ok) throw new Error();
      location.href = '/';
    } catch {
      setMsg('Deletion failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal settings">
        <button className="modal-x" onClick={onClose}>
          ×
        </button>
        <div className="kicker">ACCOUNT</div>
        <h2>Workspace settings</h2>
        <p className="email-line">{email}</p>
        <div className="settings-list">
          <button onClick={exportData} disabled={busy}>
            ⇩ Export my data <span>JSON</span>
          </button>
          <button onClick={() => alert('Browser extension setup is included in the /extension folder of the launch package.')}>
            ▣ Browser extension <span>v4.3</span>
          </button>
          <button className="danger" onClick={del} disabled={busy}>
            Delete account <span>Permanent</span>
          </button>
        </div>
        {msg && <div className="notice">{msg}</div>}
        <button className="logout wide" onClick={onSignout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
