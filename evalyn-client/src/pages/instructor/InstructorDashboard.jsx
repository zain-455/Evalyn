import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const formatShortDate = (dateValue) => {
  if (!dateValue) return ''
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
}

function InstructorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [flaggedSessions, setFlaggedSessions] = useState([])
  const [draftExams, setDraftExams] = useState([])
  const [aiDraftQuestions, setAiDraftQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    try {
      const [analyticsRes, examsRes, bankRes] = await Promise.all([
        api.get('/api/analytics/instructor-dashboard'),
        api.get('/api/exams'),
        api.get('/api/question-bank')
      ])

      setFlaggedSessions(analyticsRes.data?.flaggedSessions || [])

      const allExams = Array.isArray(examsRes.data) ? examsRes.data : []
      const drafts = allExams
        .filter(e => (e.status || '').toLowerCase() === 'draft')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6)
      setDraftExams(drafts)

      const bankQuestions = Array.isArray(bankRes.data) ? bankRes.data : []
      const aiDrafts = bankQuestions
        .filter(q => q.isAIGenerated)
        .sort((a, b) => (b.id || 0) - (a.id || 0))
        .slice(0, 6)
      setAiDraftQuestions(aiDrafts)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner" style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const canonicalCardStyle = {
    background: '#333335',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  }

  const nestedPanelStyle = {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px'
  }

  const primaryButtonStyle = {
    background: '#d98f30',
    color: 'white',
    border: 'none',
    borderRadius: '100px',
    padding: '0.75rem 1.8rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'filter 0.2s ease',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
  }

  const secondaryButtonStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    color: 'rgba(255, 255, 255, 0.92)',
    borderRadius: '100px',
    padding: '0.75rem 1.8rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'filter 0.2s ease'
  }

  const listRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.9rem 1rem',
    ...nestedPanelStyle
  }

  const mutedText = { color: 'rgba(255,255,255,0.65)' }

  return (
    <div className="fade-in" style={{ position: 'relative', paddingBottom: '2rem' }}>
      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.2rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="hero-title" style={{ fontSize: '1.7rem', margin: 0, color: 'rgba(255,255,255,0.95)', fontWeight: 800 }}>Welcome back, {user?.fullName?.split(' ')[0] || 'Instructor'}</h2>
            <p className="hero-subtitle" style={{ marginTop: '0.45rem', marginBottom: 0, color: 'rgba(255,255,255,0.75)' }}>Monitor performance, review integrity and manage assessments.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
              onClick={() => navigate('/instructor/exams')}
            >
              Manage Exams
            </button>
            <button
              type="button"
              style={primaryButtonStyle}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
              onClick={() => navigate('/instructor/exams/create')}
            >
              Create Exam
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.35fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Top-left: Draft Exams */}
        <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">Draft Exams Needing Attention</span>
            <span style={{ ...mutedText, fontSize: '0.9rem', fontWeight: 600 }}>{draftExams.length}</span>
          </div>

          {draftExams.length === 0 ? (
            <div style={{ ...mutedText, fontSize: '0.95rem', padding: '0.5rem 0' }}>No drafts right now. Create a new exam when you’re ready.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {draftExams.map(exam => {
                const qCount = exam.questionCount ?? 0
                const needsPool = qCount < 10
                return (
                  <div key={exam.id} style={listRowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 750, fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exam.title}</div>
                        {needsPool && (
                          <>
                            <span style={{ color: '#b55810', margin: '0 0.25rem', fontWeight: 300, fontSize: '0.98rem' }}>|</span>
                            <div style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '0.06em', color: '#b55810', textTransform: 'uppercase' }}>Needs Pool</div>
                          </>
                        )}
                      </div>
                      <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...mutedText, display: 'flex', alignItems: 'center' }}>
                        {qCount} questions <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {exam.isAdaptive ? 'Adaptive' : 'Fixed-form'} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {formatShortDate(exam.createdAt)}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                      onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                      onClick={() => navigate(`/instructor/exams/${exam.id}`)}
                    >
                      Continue
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top-right: Integrity Alerts */}
        <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">Integrity Alerts</span>
            <span style={{ ...mutedText, fontSize: '0.9rem', fontWeight: 600 }}>{flaggedSessions.length}</span>
          </div>

          {flaggedSessions.length === 0 ? (
            <div style={{ ...mutedText, fontSize: '0.95rem', padding: '0.5rem 0' }}>No flagged sessions right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {flaggedSessions.map((s, idx) => (
                <div key={`${s.sessionId || idx}`} style={listRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: s.color || '#f59e0b', flexShrink: 0 }} />
                      <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 750, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studentName}</div>
                    </div>
                    <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      {s.examTitle} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {s.trustScore} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {s.date}
                    </div>
                  </div>

                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                    onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                    onClick={() => {
                      if (s.examId) navigate(`/instructor/analytics/${s.examId}`)
                      else navigate('/instructor/analytics')
                    }}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: AI Draft Questions (full width) */}
        <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem', gridColumn: '1 / -1' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">AI Draft Questions To Review</span>
            <span style={{ ...mutedText, fontSize: '0.9rem', fontWeight: 600 }}>{aiDraftQuestions.length}</span>
          </div>

          {aiDraftQuestions.length === 0 ? (
            <div style={{ ...mutedText, fontSize: '0.95rem', padding: '0.5rem 0' }}>No AI drafts found. Generate questions when you want a starting point.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {aiDraftQuestions.map(q => (
                <div key={q.id} style={listRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.questionText}</div>
                    <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...mutedText, display: 'flex', alignItems: 'center' }}>
                      {q.questionType} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {q.difficultyLabel} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {q.isCalibrated ? 'Calibrated' : 'Not calibrated'}
                    </div>
                  </div>

                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                    onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                    onClick={() => navigate('/instructor/question-bank')}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InstructorDashboard
