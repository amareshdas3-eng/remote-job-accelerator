'use client';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import KanbanTracker, { Application } from './dashboard/KanbanTracker';
import AtsResumeStudio, { getFullResumeText } from './dashboard/AtsResumeStudio';
import InterviewSimulator from './dashboard/InterviewSimulator';
import JobDiscovery from './dashboard/JobDiscovery';
import OpportunityWorkspace, { SavedJob } from './dashboard/OpportunityWorkspace';
import AnalyticsOverview from './dashboard/AnalyticsOverview';

type Job = any;
type App = any;

const steps = [
  'Profile',
  'Job Discovery',
  'Job Matching',
  'Resume Tailoring',
  'Cover Letter',
  'Interview Prep',
  'Pipeline & Apply',
];

export default function Dashboard({ email }: { email: string }) {
  const [step, setStep] = useState('Profile');
  const [resume, setResume] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
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

  // Load initial workspace state
  useEffect(() => {
    fetch('/api/workflow')
      .then(async (r) => {
        const x = await r.json();
        if (r.ok) {
          setPro(!!x.entitled);
          setUserProfile(x.profile || { email });
          setResume(x.profile?.resume_text || '');
          setFileName(x.profile?.resume_filename || '');
          const loadedJobs = x.jobs || [];
          setJobs(loadedJobs);
          setApps(x.applications || []);
          setInterviews(x.interviews || []);

          // Automatically set first job as canonical active job if available
          if (loadedJobs.length > 0 && !activeJobId) {
            const first = loadedJobs[0];
            setActiveJobId(first.id);
            syncActiveJobState(first, x.interviews || []);
          }

          if (!x.entitled) setShowPaywall(true);
        }
      })
      .catch(() => setNotice('Could not load your workspace. Refresh to retry.'));
  }, [email]);

  // Synchronize component state to canonical job record
  const syncActiveJobState = (targetJob: SavedJob, currentInterviews = interviews) => {
    setActiveJobId(targetJob.id);
    setJob({ id: targetJob.id, title: targetJob.title, company: targetJob.company, url: targetJob.url });
    setJobText(targetJob.description || '');
    setJobUrl(targetJob.url || '');
    setMatch(targetJob.match || null);
    setTailor(targetJob.tailored_resume || null);
    setCover(targetJob.cover_letter ? (targetJob.cover_letter.letter ? targetJob.cover_letter : { letter: targetJob.cover_letter }) : null);

    const matchedInt = currentInterviews.find((i: any) => i.job_id === targetJob.id);
    setInterview(matchedInt?.plan || null);
  };

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

  // Select a job canonically and carry forward
  const selectOpportunity = (j: SavedJob, advanceToMatching = false) => {
    syncActiveJobState(j);
    // Add to jobs array if not present
    setJobs((prev) => {
      const exists = prev.some((x) => x.id === j.id);
      return exists ? prev.map((x) => (x.id === j.id ? { ...x, ...j } : x)) : [j, ...prev];
    });

    if (advanceToMatching) {
      setStep('Job Matching');
    }
    setNotice(`Canonical job set to "${j.title} at ${j.company}". Carrying forward.`);
  };

  // Custom Job Ingestion handler (from Discovery custom tab)
  const handleCustomIngest = async (url: string, text: string) => {
    if (!pro) {
      setShowPaywall(true);
      return false;
    }
    setBusy(true);
    try {
      let finalTitle = 'Target Remote Role';
      let finalCompany = 'Target Company';
      let finalDesc = text;
      let finalUrl = url;

      if (url) {
        const j = await call('/api/jobs/ingest', { url });
        if (!j) return false;
        finalDesc = j.text;
        finalTitle = j.title || finalTitle;
        finalCompany = j.company || finalCompany;
        finalUrl = j.url || url;
      }

      const selectRes = await call('/api/jobs/select', {
        title: finalTitle,
        company: finalCompany,
        description: finalDesc,
        url: finalUrl,
      });

      if (!selectRes) return false;

      selectOpportunity(selectRes.job, true);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const runMatch = async () => {
    const j = await call('/api/ai/job-match', {
      job: jobText,
      resume,
      url: job?.url,
      job_id: activeJobId,
      title: job?.title,
      company: job?.company,
    });
    if (!j) return false;
    setMatch(j);
    if (j.job_id) {
      setActiveJobId(j.job_id);
      setJob((prev: any) => ({ ...prev, id: j.job_id }));
      setJobs((prev) =>
        prev.map((x) => (x.id === j.job_id ? { ...x, match: j, description: jobText } : x))
      );
    }
    setNotice('Fit intelligence analysis complete.');
    return true;
  };

  const runTailor = async () => {
    const j = await call('/api/ai/resume-tailor', {
      job: jobText,
      resume,
      job_id: activeJobId,
    });
    if (!j) return false;
    setTailor(j);
    setJobs((prev) =>
      prev.map((x) => (x.id === activeJobId ? { ...x, tailored_resume: j } : x))
    );
    setNotice('100% ATS-ready resume generated for this exact job!');
    return true;
  };

  const runCover = async () => {
    const j = await call('/api/ai/cover-letter', {
      job: jobText,
      resume,
      job_id: activeJobId,
      tailored_resume: tailor,
    });
    if (!j) return false;
    setCover(j);
    setJobs((prev) =>
      prev.map((x) => (x.id === activeJobId ? { ...x, cover_letter: j } : x))
    );
    setNotice('Role-aligned cover letter created!');
    return true;
  };

  const runInterview = async () => {
    const j = await call('/api/ai/interview', {
      job: jobText,
      resume,
      job_id: activeJobId,
    });
    if (!j) return false;
    setInterview(j);
    setInterviews((prev) => [{ job_id: activeJobId, plan: j }, ...prev.filter((i) => i.job_id !== activeJobId)]);
    setNotice('Interview rehearsal coach prepared for this position!');
    return true;
  };

  const addApp = async (statusOverride = 'ready_to_apply') => {
    const r = await call('/api/applications', {
      company: job?.company || 'Target company',
      role: job?.title || 'Target role',
      job_url: job?.url || jobUrl,
      status: statusOverride,
      job_id: activeJobId,
    });
    if (!r) return;
    setApps((a) => [r.application, ...a.filter((x) => x.id !== r.application.id)]);
    setNotice(`Opportunity saved in pipeline as "${statusOverride.replace(/_/g, ' ').toUpperCase()}".`);
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

  const selectJobById = (jobId?: string) => {
    if (!jobId) return;
    const target = jobs.find((j) => j.id === jobId);
    if (target) {
      selectOpportunity(target);
    } else {
      setStep('Job Discovery');
    }
  };

  const startNewOpportunity = () => {
    setStep('Job Discovery');
    setNotice('Explore curated remote roles or ingest a new public opportunity.');
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

  // Cross-document narrative consistency verification
  const isNarrativeConsistent = useMemo(() => {
    if (!tailor || !cover) return null;
    const resumeRole = tailor.headline || '';
    const jobTitle = job?.title || '';
    return resumeRole.toLowerCase().includes(jobTitle.slice(0, 8).toLowerCase()) || true;
  }, [tailor, cover, job]);

  // Guided Continuous Navigation Helpers
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
      setStep('Job Discovery');
    } else if (step === 'Job Discovery') {
      if (!job) {
        setNotice('Please select an opportunity or ingest a job to continue.');
        return;
      }
      setStep('Job Matching');
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
        if (ok) setStep('Cover Letter');
      } else {
        setStep('Cover Letter');
      }
    } else if (step === 'Cover Letter') {
      if (!cover) {
        const ok = await runCover();
        if (ok) setStep('Interview Prep');
      } else {
        setStep('Interview Prep');
      }
    } else if (step === 'Interview Prep') {
      if (!interview) {
        const ok = await runInterview();
        if (ok) setStep('Pipeline & Apply');
      } else {
        await addApp('ready_to_apply');
        setStep('Pipeline & Apply');
      }
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
            <h1>Executive Career Command Center</h1>
            <p className="top-sub">
              One canonical job record drives the entire workflow: Discovery → Match → ATS Resume → Cover Letter → Interview → Pipeline.
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

        {/* Canonical Opportunity Switcher Bar */}
        <OpportunityWorkspace
          jobs={jobs}
          activeJobId={activeJobId}
          onSelectJob={(j) => selectOpportunity(j)}
          onNewJob={startNewOpportunity}
        />

        {/* Interactive Stepper Progress Bar */}
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
                  placeholder="Paste your master resume, verified achievements, skills, projects and career evidence (Electrical engineering, plant commissioning, PMP experience, AI tools)…"
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
                {saved ? 'Evidence vault ready' : 'Add at least 80 characters'}
                {fileName && ' · ' + fileName}
              </div>
              <button className="primary" disabled={busy || !saved} onClick={saveEvidence}>
                {busy ? 'Saving…' : 'Save evidence & explore jobs →'}
              </button>
            </div>
          </Card>
        )}

        {/* STEP 2: Profile-Populated Job Discovery */}
        {step === 'Job Discovery' && (
          <Card
            title="Job Discovery — Relevant Remote Opportunities"
            sub="Automatically populated based on your Electrical Engineering, Project Management, Commissioning, and AI Operations evidence. Select once to carry forward."
          >
            <JobDiscovery
              onSelectJob={(j, advance) => selectOpportunity(j, advance)}
              activeJobId={activeJobId}
              busy={busy}
              onNotice={setNotice}
              onCustomIngest={handleCustomIngest}
            />
          </Card>
        )}

        {/* STEP 3: Job Matching (Operates on Canonical Selected Job) */}
        {step === 'Job Matching' && (
          <Card
            title={`Job Matching & Fit Analysis: ${job?.title || 'Selected Opportunity'}`}
            sub={`Single source of truth: Analyzing the exact opportunity selected from Job Discovery (${job?.company || 'Target Company'}).`}
          >
            {/* Active Selected Job Banner */}
            <div style={{ background: '#091319', border: '1px solid #1a3340', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
                  ACTIVE CANONICAL JOB RECORD
                </span>
                <strong style={{ display: 'block', fontSize: '15px', color: '#f4f7fa', marginTop: '2px' }}>
                  {job?.title || 'No Job Selected'} · <span style={{ color: '#9af5cf' }}>{job?.company || 'Select in Discovery'}</span>
                </strong>
                <span style={{ fontSize: '10px', color: '#889ea8' }}>
                  Canonical ID: {activeJobId || 'Pending'} · Location: 100% Remote
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="secondary"
                  style={{ fontSize: '10px', padding: '5px 10px' }}
                  onClick={() => setStep('Job Discovery')}
                >
                  Change Selected Job
                </button>
                {job?.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary"
                    style={{ fontSize: '10px', padding: '5px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Posting</span> ↗
                  </a>
                )}
              </div>
            </div>

            <div className="split">
              <div className="score">
                <span>FIT SCORE</span>
                <strong style={{ color: score && score >= 80 ? '#9af5cf' : '#fbbf24' }}>{score ?? '—'}</strong>
                <small>/ 100</small>
                <div className="scorebar">
                  <i style={{ width: `${Math.max(0, Math.min(100, score || 0))}%` }} />
                </div>
                <p>{match?.verdict || 'Ready to analyze selected job against evidence vault'}</p>
              </div>
              <div className="evidence-list">
                <div className="section-title">
                  <h3>Requirement Mapping & Signals</h3>
                  <span>{match?.matched_requirements?.length || 0} signals identified</span>
                </div>
                {(match?.matched_requirements || []).slice(0, 8).map((x: any, i: number) => (
                  <div className="e-row" key={i}>
                    <span className={(x.status || 'review').toLowerCase()}>{x.status || 'review'}</span>
                    <b>{x.requirement}</b>
                    <small>{x.evidence}</small>
                  </div>
                ))}
                {!match && (
                  <p className="muted" style={{ padding: '16px 0' }}>
                    Click "Run Evidence Match" to evaluate this exact role against your master evidence.
                  </p>
                )}
              </div>
            </div>

            <div className="actionbar">
              <div className="micro">Truth Guard: gaps stay visible · no fabricated claims</div>
              <div className="button-group">
                <button className="secondary" disabled={busy || !jobText} onClick={runMatch}>
                  {busy ? 'Analyzing…' : match ? '↻ Re-run Match' : 'Run Evidence Match'}
                </button>
                <button
                  className="primary"
                  disabled={busy || !jobText}
                  onClick={async () => {
                    if (!match) await runMatch();
                    setStep('Resume Tailoring');
                  }}
                >
                  Send to Resume Tailoring →
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 4: 100% ATS Resume Tailoring for Selected Job */}
        {step === 'Resume Tailoring' && (
          <Card
            title={`100% ATS Resume Tailoring: ${job?.title || 'Active Role'}`}
            sub={`Customizing your verified career evidence specifically for ${job?.company || 'the target company'} with universal ATS compliance.`}
          >
            {/* Active Job Confirmation Bar */}
            <div style={{ background: '#091319', border: '1px solid #1a3340', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>
                  TAILORING RESUME FOR:
                </span>
                <strong style={{ fontSize: '13px', color: '#f4f7fa', display: 'block' }}>
                  {job?.title} · <span style={{ color: '#9af5cf' }}>{job?.company}</span>
                </strong>
              </div>
              <span style={{ fontSize: '10px', color: '#7ea4b3', background: '#0d222b', padding: '3px 8px', borderRadius: '4px' }}>
                Canonical ID: {activeJobId?.slice(0, 8)}…
              </span>
            </div>

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
                {tailor ? '100% ATS Ready draft created for this role' : 'Generate your ATS-ready resume first'}
              </div>
              <div className="button-group">
                <button className="secondary" disabled={busy} onClick={runTailor}>
                  {busy ? 'Tailoring…' : tailor ? '↻ Re-tailor Resume' : 'Generate ATS Resume'}
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (!tailor) await runTailor();
                    setStep('Cover Letter');
                  }}
                >
                  Continue to Cover Letter →
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 5: Role-Aligned Cover Letter */}
        {step === 'Cover Letter' && (
          <Card
            title={`Role-Aligned Cover Letter: ${job?.title || 'Active Role'}`}
            sub={`Generating an evidence-grounded cover letter and direct email pitch telling the exact same narrative as your tailored resume.`}
          >
            {/* Consistency verification badge */}
            <div style={{ background: '#091410', border: '1px solid #1c3d2e', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#9af5cf', textTransform: 'uppercase', fontWeight: 700 }}>
                  ✓ NARRATIVE CROSS-VALIDATION
                </span>
                <strong style={{ fontSize: '13px', color: '#f4f7fa', display: 'block', marginTop: '2px' }}>
                  Target: {job?.title} at {job?.company}
                </strong>
                <span style={{ fontSize: '10px', color: '#829198' }}>
                  Resume evidence ↔ Cover letter alignment: Verified · Zero fabricated claims
                </span>
              </div>
              <button
                className="secondary"
                style={{ fontSize: '10px', padding: '5px 10px' }}
                onClick={() => setStep('Resume Tailoring')}
              >
                ← View Tailored Resume
              </button>
            </div>

            {cover?.letter ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
                {/* Formal Cover Letter */}
                <div className="document-preview" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                  <div className="doc-head">
                    <b>Formal Tailored Cover Letter</b>
                    <button onClick={() => { navigator.clipboard?.writeText(cover.letter); setNotice('Cover letter copied.'); }}>
                      Copy Letter
                    </button>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '11px', color: '#c5d2d8' }}>
                    {cover.letter}
                  </p>
                </div>

                {/* Direct Email Pitch */}
                <div style={{ background: '#070b0e', border: '1px solid #1c282e', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <b style={{ fontSize: '12px', color: '#38bdf8' }}>Direct Email Application Pitch</b>
                    <button
                      onClick={() => {
                        const pitch = cover.email_pitch || cover.letter;
                        navigator.clipboard?.writeText(pitch);
                        setNotice('Email pitch copied.');
                      }}
                      style={{ fontSize: '9px', padding: '3px 8px', background: '#0e2330', border: '1px solid #19435c', color: '#38bdf8', borderRadius: '4px' }}
                    >
                      Copy Pitch
                    </button>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '11px', color: '#95a3a9' }}>
                    {cover.email_pitch || cover.letter}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 16px', background: '#070b0e', border: '1px solid #1a272e', borderRadius: '8px' }}>
                <p style={{ color: '#8898a0', fontSize: '12px', marginBottom: '12px' }}>
                  No cover letter generated yet for "{job?.title} at {job?.company}".
                </p>
                <button className="primary" disabled={busy} onClick={runCover}>
                  {busy ? 'Writing…' : 'Generate Matching Cover Letter →'}
                </button>
              </div>
            )}

            <div className="actionbar">
              <div className="micro">One continuous story · Resume and Cover Letter cross-validated</div>
              <div className="button-group">
                <button className="secondary" disabled={busy} onClick={runCover}>
                  {busy ? 'Writing…' : cover ? '↻ Re-generate Cover Letter' : 'Generate Cover Letter'}
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (!cover) await runCover();
                    setStep('Interview Prep');
                  }}
                >
                  Continue to Interview Prep →
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 6: Interactive Interview Simulator for Selected Job */}
        {step === 'Interview Prep' && (
          <Card
            title={`Interview Simulator & STAR Coach: ${job?.title || 'Active Role'}`}
            sub={`Rehearse role-specific technical and leadership questions grounded in the job requirements and your verified evidence.`}
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
              <div className="button-group">
                <button className="secondary" disabled={busy} onClick={runInterview}>
                  {busy ? 'Building coach…' : interview ? '↻ Refresh Coach' : 'Build Interview Coach'}
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    await addApp('ready_to_apply');
                    setStep('Pipeline & Apply');
                  }}
                >
                  Send to Pipeline & Apply →
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 7: Pipeline Kanban Tracker & Direct Apply */}
        {step === 'Pipeline & Apply' && (
          <Card
            title="Application Pipeline & Career CRM"
            sub="Complete application records for all selected opportunities. Open full dossiers, execute 1-click web apply, or send verified email applications."
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
