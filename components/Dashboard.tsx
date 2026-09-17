'use client';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import KanbanTracker, { Application } from './dashboard/KanbanTracker';
import JobDiscovery from './dashboard/JobDiscovery';
import OpportunityWorkspace, { SavedJob } from './dashboard/OpportunityWorkspace';
import AnalyticsOverview from './dashboard/AnalyticsOverview';
import StructuredProfile from './dashboard/StructuredProfile';
import UnifiedJobWorkspace from './dashboard/UnifiedJobWorkspace';

const MAIN_STEPS = [
  'Profile',
  'Job Discovery',
  'Job Workspace',
  'Pipeline & Apply',
];

export default function Dashboard({ email }: { email: string }) {
  const [step, setStep] = useState('Profile');
  const [workspaceTab, setWorkspaceTab] = useState('overview');
  const [resume, setResume] = useState('');
  const [fileName, setFileName] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);

  // CANONICAL BACKBONE: Stored Jobs and active job_id
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pro, setPro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  // Load initial workspace state from database
  useEffect(() => {
    fetch('/api/workflow')
      .then(async (r) => {
        const x = await r.json();
        if (r.ok) {
          setPro(!!x.entitled);
          setUserProfile(x.profile || { email });
          setResume(x.profile?.resume_text || '');
          setFileName(x.profile?.resume_filename || '');
          const loadedJobs: SavedJob[] = x.jobs || [];
          setJobs(loadedJobs);
          setApps(x.applications || []);
          setInterviews(x.interviews || []);

          // Automatically set first job as canonical active job if available
          if (loadedJobs.length > 0) {
            setActiveJobId(loadedJobs[0].id);
          }

          if (!x.entitled) setShowPaywall(true);
        }
      })
      .catch(() => setNotice('Could not load your workspace. Refresh to retry.'));
  }, [email]);

  // CANONICAL ACTIVE JOB RECORD: Single source of truth for all job-specific workflows
  const activeJob: SavedJob | null = useMemo(() => {
    if (!activeJobId && jobs.length > 0) return jobs[0];
    return jobs.find((j) => j.id === activeJobId) || null;
  }, [jobs, activeJobId]);

  const activeInterview = useMemo(() => {
    if (!activeJob) return null;
    return interviews.find((i) => i.job_id === activeJob.id) || null;
  }, [interviews, activeJob]);

  const activeApp = useMemo(() => {
    if (!activeJob) return null;
    return apps.find((a) => a.job_id === activeJob.id) || null;
  }, [apps, activeJob]);

  // Keyboard shortcut listener for fast navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        setShowSettings(false);
        setShowPaywall(false);
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= MAIN_STEPS.length) {
        setStep(MAIN_STEPS[num - 1]);
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

  const saveEvidence = async (newText?: string) => {
    const textToSave = typeof newText === 'string' ? newText : resume;
    if (typeof newText === 'string') setResume(newText);
    const j = await call('/api/resume/upload', {
      text: textToSave,
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

  // 1-Click Select Job: Anchors job_id as the backbone
  const selectOpportunity = (j: SavedJob, advanceToWorkspace = false) => {
    setActiveJobId(j.id);
    setJobs((prev) => {
      const exists = prev.some((x) => x.id === j.id);
      return exists ? prev.map((x) => (x.id === j.id ? { ...x, ...j } : x)) : [j, ...prev];
    });

    if (advanceToWorkspace) {
      setStep('Job Workspace');
      setWorkspaceTab('overview');
    }
    setNotice(`Canonical job set to "${j.title} at ${j.company}". Carrying forward into Unified Workspace.`);
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

  // Run AI Fit Match Analysis against canonical active job
  const runMatch = async () => {
    if (!activeJob) {
      setNotice('Please select an active job first.');
      return false;
    }
    const j = await call('/api/ai/job-match', {
      job: activeJob.description,
      resume,
      url: activeJob.url,
      job_id: activeJob.id,
      title: activeJob.title,
      company: activeJob.company,
    });
    if (!j) return false;

    // Mutate canonical job record in state
    setJobs((prev) =>
      prev.map((x) => (x.id === activeJob.id ? { ...x, match: j } : x))
    );
    setNotice('Fit intelligence analysis complete.');
    return true;
  };

  // Run AI Resume Tailoring against canonical active job
  const runTailor = async () => {
    if (!activeJob) {
      setNotice('Please select an active job first.');
      return false;
    }
    const j = await call('/api/ai/resume-tailor', {
      job: activeJob.description,
      resume,
      job_id: activeJob.id,
    });
    if (!j) return false;

    setJobs((prev) =>
      prev.map((x) => (x.id === activeJob.id ? { ...x, tailored_resume: j } : x))
    );
    setNotice('100% ATS-ready resume generated for this exact canonical role!');
    return true;
  };

  // Run AI Cover Letter against canonical active job
  const runCover = async () => {
    if (!activeJob) {
      setNotice('Please select an active job first.');
      return false;
    }
    const j = await call('/api/ai/cover-letter', {
      job: activeJob.description,
      resume,
      job_id: activeJob.id,
      tailored_resume: activeJob.tailored_resume,
    });
    if (!j) return false;

    setJobs((prev) =>
      prev.map((x) => (x.id === activeJob.id ? { ...x, cover_letter: j } : x))
    );
    setNotice('Role-aligned cover letter and email pitch created!');
    return true;
  };

  // Run AI Interview Simulator against canonical active job
  const runInterview = async () => {
    if (!activeJob) {
      setNotice('Please select an active job first.');
      return false;
    }
    const j = await call('/api/ai/interview', {
      job: activeJob.description,
      resume,
      job_id: activeJob.id,
    });
    if (!j) return false;

    setInterviews((prev) => [
      { job_id: activeJob.id, plan: j },
      ...prev.filter((i) => i.job_id !== activeJob.id),
    ]);
    setNotice('Interview rehearsal coach prepared for this position!');
    return true;
  };

  // Save/Update opportunity in Pipeline
  const addApp = async (statusOverride = 'ready_to_apply') => {
    if (!activeJob) return;
    const r = await call('/api/applications', {
      company: activeJob.company || 'Target company',
      role: activeJob.title || 'Target role',
      job_url: activeJob.url || '',
      status: statusOverride,
      job_id: activeJob.id,
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
      selectOpportunity(target, true);
    } else {
      setStep('Job Discovery');
    }
  };

  const signout = async () => {
    const s = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await s.auth.signOut();
    location.href = '/login';
  };

  const saved = resume.length >= 80;

  // Step progression helpers
  const currentStepIndex = MAIN_STEPS.indexOf(step);
  const canGoBack = currentStepIndex > 0;
  const canGoNext = currentStepIndex < MAIN_STEPS.length - 1;

  const goPrevious = () => {
    if (canGoBack) setStep(MAIN_STEPS[currentStepIndex - 1]);
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
      if (!activeJob) {
        setNotice('Please click "Select Job" on an opportunity to activate the Job Workspace.');
        return;
      }
      setStep('Job Workspace');
      setWorkspaceTab('overview');
    } else if (step === 'Job Workspace') {
      await addApp('ready_to_apply');
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
        
        {/* Top-Level 4-Phase Guided Journey */}
        {MAIN_STEPS.map((s, i) => {
          const isDone = MAIN_STEPS.indexOf(step) > i;
          const isCurrent = step === s;
          return (
            <button
              key={s}
              className={isCurrent ? 'nav active' : 'nav'}
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

        {/* Canonical Active Job Workspace Sub-Navigation (Visible when job is active) */}
        {activeJob && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #142028', paddingTop: '12px' }}>
            <div style={{ fontSize: '9px', color: '#687882', textTransform: 'uppercase', fontWeight: 800, padding: '0 12px 6px', letterSpacing: '.06em' }}>
              ACTIVE JOB WORKSPACE
            </div>
            {[
              { id: 'overview', label: 'Role Overview', icon: '📋' },
              { id: 'match', label: 'Match Intelligence', icon: '🎯' },
              { id: 'resume', label: '100% ATS Resume', icon: '📄' },
              { id: 'qc', label: 'ATS QC Engine', icon: '🛡️' },
              { id: 'cover', label: 'Cover Letter & Pitch', icon: '✉️' },
              { id: 'interview', label: 'STAR Interview Coach', icon: '🎙️' },
              { id: 'package', label: 'Application Package', icon: '📦' },
            ].map((sub) => {
              const isSubActive = step === 'Job Workspace' && workspaceTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => {
                    setStep('Job Workspace');
                    setWorkspaceTab(sub.id);
                    setMobileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isSubActive ? '#0e2433' : 'transparent',
                    border: 'none',
                    color: isSubActive ? '#38bdf8' : '#889ea8',
                    padding: '6px 12px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontWeight: isSubActive ? 700 : 400,
                  }}
                >
                  <span style={{ fontSize: '10px' }}>{sub.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

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
              Profile Evidence → Automated Remote Discovery → 1-Click Select Job → Canonical Job Workspace → Pipeline CRM.
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
          onNewJob={() => {
            setStep('Job Discovery');
            setNotice('Explore curated remote roles or import a new opportunity.');
          }}
        />

        {/* Interactive Stepper Progress Bar */}
        <div className="progress">
          {MAIN_STEPS.map((s, i) => {
            const isDone = MAIN_STEPS.indexOf(step) > i;
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
            <StructuredProfile
              resumeText={resume}
              fileName={fileName}
              busy={busy}
              onSaveEvidence={async (newText) => {
                const ok = await saveEvidence(newText);
                return !!ok;
              }}
              onUploadFile={async (file) => {
                await uploadFile(file);
                return true;
              }}
              onNotice={setNotice}
              onContinueToDiscovery={() => setStep('Job Discovery')}
            />
          </Card>
        )}

        {/* STEP 2: Profile-Populated Remote Job Discovery */}
        {step === 'Job Discovery' && (
          <Card
            title="Remote Job Discovery — Relevant Curated Opportunities"
            sub="Automatically matched against your Master Evidence Vault. Click 'Select Job' once to carry that canonical record into the Job Workspace."
          >
            <JobDiscovery
              onSelectJob={(j) => selectOpportunity(j, true)}
              activeJobId={activeJobId}
              busy={busy}
              onNotice={setNotice}
              onCustomIngest={handleCustomIngest}
              resumeText={resume}
              userProfile={userProfile}
            />
            
            <div className="actionbar" style={{ marginTop: '16px' }}>
              <div className="micro">
                {activeJob ? `Active selection: ${activeJob.title} at ${activeJob.company}` : 'Click "Select Job" on any opportunity to carry forward'}
              </div>
              <div className="button-group">
                <button className="secondary" onClick={() => setStep('Profile')}>
                  ← Back to Profile
                </button>
                <button
                  className="primary"
                  disabled={!activeJob}
                  onClick={() => {
                    setStep('Job Workspace');
                    setWorkspaceTab('overview');
                  }}
                >
                  Enter Job Workspace →
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* STEP 3: Unified Job Workspace (Overview · Match · Resume Studio · ATS QC · Cover Letter · Interview · Package) */}
        {step === 'Job Workspace' && (
          <Card
            title={`Unified Job Workspace: ${activeJob?.title || 'No Job Selected'}`}
            sub={`Single source of truth: All matching, ATS tailoring, quality audits, cover letters, and interview coaching are anchored to canonical job ID ${activeJob?.id.slice(0, 8) || 'pending'}…`}
          >
            {activeJob ? (
              <UnifiedJobWorkspace
                activeJob={activeJob}
                activeInterview={activeInterview}
                activeApp={activeApp}
                resume={resume}
                busy={busy}
                pro={pro}
                onRunMatch={runMatch}
                onRunTailor={runTailor}
                onRunCover={runCover}
                onRunInterview={runInterview}
                onSaveToPipeline={addApp}
                onNotice={setNotice}
                onSwitchJob={() => setStep('Job Discovery')}
                onNavigateToPipeline={() => setStep('Pipeline & Apply')}
                activeSubTab={workspaceTab}
                onSubTabChange={setWorkspaceTab}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: '#070b0e', border: '1px dashed #1a272e', borderRadius: '10px' }}>
                <p style={{ fontSize: '13px', color: '#889ea8', marginBottom: '14px' }}>
                  No opportunity is currently active. Select a verified remote role from Discovery to activate this workspace.
                </p>
                <button className="primary" onClick={() => setStep('Job Discovery')}>
                  Explore Remote Opportunities →
                </button>
              </div>
            )}
          </Card>
        )}

        {/* STEP 4: Application Pipeline & CRM */}
        {step === 'Pipeline & Apply' && (
          <Card
            title="Application Command Center & Pipeline CRM"
            sub="Track all selected opportunities through their 8-stage lifecycle. Open complete dossiers, use 1-click Quick-Fill web apply, or send verified direct email applications."
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
              hasActiveJob={!!activeJob}
              activeJobTitle={activeJob?.title}
            />
            <AnalyticsOverview
              applications={apps}
              jobsCount={jobs.length}
              evidenceLength={resume.length}
            />
            <div className="actionbar" style={{ marginTop: '16px' }}>
              <div className="micro">Executive application lifecycle & verified direct application routes</div>
              <div className="button-group">
                <button
                  className="secondary"
                  onClick={() => {
                    setStep('Job Workspace');
                    setWorkspaceTab('package');
                  }}
                >
                  ← Back to Job Workspace
                </button>
                <button className="primary" onClick={() => setStep('Job Discovery')}>
                  ＋ Discover More Remote Roles
                </button>
              </div>
            </div>
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
            ← Previous: {canGoBack ? MAIN_STEPS[currentStepIndex - 1] : 'Start'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9px', color: '#68767d', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block' }}>
              PHASE {currentStepIndex + 1} OF {MAIN_STEPS.length}
            </span>
            <strong style={{ fontSize: '12px', color: '#9af5cf' }}>{step}</strong>
            {activeJob?.title && <small style={{ color: '#8898a0', marginLeft: '6px' }}>· {activeJob.title} at {activeJob.company}</small>}
          </div>

          <button
            className="primary"
            disabled={busy}
            onClick={goNext}
            style={{ fontSize: '11px', padding: '8px 16px' }}
          >
            {canGoNext ? `Continue to ${MAIN_STEPS[currentStepIndex + 1]} →` : 'View Tracked Applications →'}
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
