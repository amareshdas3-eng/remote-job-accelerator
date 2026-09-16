'use client';
import { useState } from 'react';

interface InterviewSimulatorProps {
  interview: any;
  jobText: string;
  resume: string;
  busy: boolean;
  onRunInterview: () => void;
  onNotice: (msg: string) => void;
}

export default function InterviewSimulator({
  interview,
  jobText,
  resume,
  busy,
  onRunInterview,
  onNotice,
}: InterviewSimulatorProps) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  const questions: any[] = interview?.questions || [];

  const handleStartPractice = (q: any) => {
    const qText = typeof q === 'string' ? q : q.question || JSON.stringify(q);
    setActiveQuestion(qText);
    setPracticeAnswer('');
    setFeedback(null);
  };

  const handleEvaluate = async () => {
    if (!activeQuestion || !practiceAnswer.trim()) {
      onNotice('Please write a practice answer to evaluate.');
      return;
    }
    setEvaluating(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/ai/interview/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: activeQuestion,
          answer: practiceAnswer,
          job: jobText,
          resume,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Evaluation failed');
      }
      setFeedback(data);
      onNotice('STAR coaching evaluation complete!');
    } catch (e: any) {
      onNotice(e.message || 'Could not evaluate answer.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div>
      {/* Coach Mode Strip */}
      <div className="coach-strip">
        <div>
          <span>COACH MODE</span>
          <b>Evidence-led STAR Rehearsal</b>
        </div>
        <div>
          <span>QUESTIONS</span>
          <b>{questions.length || '—'}</b>
        </div>
        <div>
          <span>EVALUATION</span>
          <b>Real-time STAR Coach</b>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="question-grid">
        {questions.slice(0, 8).map((q: any, i: number) => {
          const qText = typeof q === 'string' ? q : q.question || JSON.stringify(q);
          const isSelected = activeQuestion === qText;
          return (
            <div
              className={`q-card ${isSelected ? 'selected' : ''}`}
              key={i}
              style={{
                borderColor: isSelected ? '#9af5cf' : undefined,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
              onClick={() => handleStartPractice(q)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9af5cf', fontSize: '9px' }}>Q{i + 1} · STAR PROOF</span>
                <span
                  style={{
                    fontSize: '9px',
                    color: isSelected ? '#9af5cf' : '#68777e',
                    background: isSelected ? '#12251e' : '#10161b',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {isSelected ? 'Practicing' : 'Click to practice'}
                </span>
              </div>
              <b style={{ fontSize: '12px', lineHeight: '1.45', margin: '8px 0', display: 'block' }}>{qText}</b>
              <small style={{ color: '#66747b', fontSize: '9px' }}>Answer using a concrete situation from your verified evidence.</small>
            </div>
          );
        })}
        {!interview && (
          <div className="empty">
            Build your role-specific interview coach to generate targeted behavioral, technical, and remote collaboration questions.
          </div>
        )}
      </div>

      {/* Interactive Practice Workspace */}
      {activeQuestion && (
        <div className="feedback-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div className="kicker" style={{ color: '#9af5cf' }}>ACTIVE PRACTICE ARENA</div>
              <b style={{ fontSize: '13px', color: '#f5f7f8' }}>{activeQuestion}</b>
            </div>
            <button
              style={{ background: 'transparent', border: 0, color: '#68777e', fontSize: '16px', cursor: 'pointer' }}
              onClick={() => setActiveQuestion(null)}
            >
              ×
            </button>
          </div>

          <textarea
            value={practiceAnswer}
            onChange={(e) => setPracticeAnswer(e.target.value)}
            placeholder="Type or paste your answer here. Focus on the Situation, Task, personal Actions you took, and measurable Results..."
            style={{ width: '100%', minHeight: '120px', fontSize: '11px', lineHeight: '1.6', background: '#070b0e' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              className="primary"
              onClick={handleEvaluate}
              disabled={evaluating || !practiceAnswer.trim()}
              style={{ fontSize: '11px', padding: '8px 16px' }}
            >
              {evaluating ? 'Analyzing with STAR Coach…' : 'Evaluate My Answer (STAR) →'}
            </button>
          </div>

          {/* Feedback Display */}
          {feedback && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #1c332a', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <b style={{ color: '#9af5cf', fontSize: '12px' }}>STAR COACHING EVALUATION</b>
                <span style={{ background: '#16362b', color: '#9af5cf', padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                  {feedback.score || 85} / 100 Score
                </span>
              </div>

              {/* STAR Quadrants */}
              {feedback.star_analysis && (
                <div className="star-grid">
                  {['situation', 'task', 'action', 'result'].map((part) => {
                    const item = feedback.star_analysis[part];
                    const isPresent = item?.present;
                    return (
                      <div key={part} className={`star-item ${isPresent ? 'active' : 'inactive'}`}>
                        <b>
                          {isPresent ? '✓' : '⚠'} {part.toUpperCase()}
                        </b>
                        <span>{item?.feedback || (isPresent ? 'Present' : 'Needs more detail')}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Strengths & Improvements */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '12px 0' }}>
                <div style={{ background: '#0a1210', border: '1px solid #193126', borderRadius: '8px', padding: '10px' }}>
                  <b style={{ color: '#9af5cf', fontSize: '10px', display: 'block', marginBottom: '4px' }}>STRENGTHS</b>
                  {(feedback.strengths || []).map((s: string, idx: number) => (
                    <div key={idx} style={{ fontSize: '10px', color: '#b2c1c6', marginBottom: '2px' }}>• {s}</div>
                  ))}
                </div>
                <div style={{ background: '#14120c', border: '1px solid #332718', borderRadius: '8px', padding: '10px' }}>
                  <b style={{ color: '#e6c979', fontSize: '10px', display: 'block', marginBottom: '4px' }}>AREAS TO SHARPEN</b>
                  {(feedback.improvements || []).map((imp: string, idx: number) => (
                    <div key={idx} style={{ fontSize: '10px', color: '#c4b595', marginBottom: '2px' }}>• {imp}</div>
                  ))}
                </div>
              </div>

              {/* Improved Rewrite */}
              {feedback.improved_answer && (
                <div style={{ background: '#070c0f', border: '1px solid #1c2b33', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <b style={{ fontSize: '10px', color: '#8fa2aa', letterSpacing: '.08em' }}>EXECUTIVE STAR REWRITE</b>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(feedback.improved_answer);
                        onNotice('Improved rewrite copied.');
                      }}
                      style={{ background: 'transparent', border: 0, color: '#9af5cf', fontSize: '10px', cursor: 'pointer' }}
                    >
                      Copy Rewrite
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#d8e1e5', lineHeight: '1.6', margin: 0 }}>
                    {feedback.improved_answer}
                  </p>
                </div>
              )}

              {feedback.remote_signal && (
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#7a9199' }}>
                  <b style={{ color: '#9af5cf' }}>Remote Signal:</b> {feedback.remote_signal}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
