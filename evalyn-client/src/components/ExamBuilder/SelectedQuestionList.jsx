import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEB } from './ExamBuilderContext';

export default function SelectedQuestionList() {
  const navigate = useNavigate();
  const { 
    exam, examId, questions, deleteQuestion, canEditExam, 
    getDifficultyBadge, getDifficultyColor 
  } = useEB();
  return (
    <>
      {/* Question List */}
      <div style={{
        background: '#333335',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginTop: '1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              {exam.title}
            </h3>
            <div style={{ color: 'rgba(255, 255, 255, 0.18)' }}>|</div>
            <div style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '1.05rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}>
              Your Exam Questions
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.18)' }}>|</div>
            <button
              className="uiverse"
              disabled={!canEditExam}
              onClick={() => canEditExam && navigate(`/instructor/exams/${examId}/ai`)}
              title={!canEditExam ? "Cannot generate questions for a published exam" : "Generate with AI"}
            >
              <div className="wrapper">
                <span style={{ whiteSpace: 'nowrap' }}>Generate with AI</span>
                <div className="circle circle-1"></div>
                <div className="circle circle-2"></div>
                <div className="circle circle-3"></div>
                <div className="circle circle-4"></div>
                <div className="circle circle-5"></div>
                <div className="circle circle-6"></div>
                <div className="circle circle-7"></div>
                <div className="circle circle-8"></div>
                <div className="circle circle-9"></div>
                <div className="circle circle-10"></div>
                <div className="circle circle-11"></div>
                <div className="circle circle-12"></div>
              </div>
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>No questions yet</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Add at least 10 questions to publish this exam.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.25rem'
          }}>
            {questions.map((q, i) => {
              const diffLabel = getDifficultyBadge(q);
              const diffColor = getDifficultyColor(diffLabel);
              
              return (
                <div key={q.id} 
                  style={{
                    background: 'rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '1.5rem 1.5rem 2.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)'}
                >
                  {canEditExam && (
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      aria-label="Delete question"
                      style={{ 
                        position: 'absolute', 
                        top: '1.25rem', 
                        right: '1.25rem', 
                        background: 'none',
                        border: 'none',
                        color: 'rgba(239, 68, 68, 0.75)', 
                        cursor: 'pointer', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        zIndex: 10,
                        padding: 0
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.color = '#f87171';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.color = 'rgba(239, 68, 68, 0.75)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}

                  {/* Metadata Row - Capsule Style */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.1 }}>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.2)', 
                      fontWeight: 900, 
                      fontSize: '0.92rem', 
                      letterSpacing: '0.05em',
                      fontFamily: "'Poppins', sans-serif",
                      lineHeight: 1
                    }}>
                      #{q.id}
                    </span>
                    <span style={{
                      color: diffColor,
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontFamily: "'Poppins', sans-serif",
                      lineHeight: 1
                    }}>
                      {diffLabel}
                    </span>
                    {q.domainTags && q.domainTags.length > 0 && (
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 500,
                        fontFamily: "'Poppins', sans-serif",
                        lineHeight: 1
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                        <span>{q.domainTags[0].domainName}</span>
                        {q.domainTags[0].subDomain && (
                          <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{q.domainTags[0].subDomain}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    paddingTop: '1.25rem',
                    fontSize: '1.05rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: '1.6',
                    marginBottom: '1rem',
                    flexGrow: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontWeight: 500
                  }}>
                    {q.questionText}
                  </div>

                {/* Fix 2: Option color based purely on isCorrect, no arbitrary idx logic */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.85rem 0.95rem',
                    width: '100%'
                  }}>
                    {q.options.map((o, idx) => (
                      <div key={o.id || idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        minWidth: 0
                      }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                          background: o.isCorrect ? '#22c55e' : '#ef4444',
                          color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          {o.isCorrect ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          )}
                        </div>
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '12px',
                          border: `1px solid ${o.isCorrect ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)'}`,
                          height: '42px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 1rem',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            color: o.isCorrect ? '#4ade80' : 'rgba(255, 255, 255, 0.65)',
                            fontSize: '0.88rem',
                            fontWeight: o.isCorrect ? 700 : 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%'
                          }}>
                            {o.optionText || `Option ${idx + 1}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
