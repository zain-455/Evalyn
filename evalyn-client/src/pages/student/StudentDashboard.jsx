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

function StudentDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [exams, setExams] = useState([])
  const [history, setHistory] = useState([])
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    let examsData = []
    let historyData = []
    try {
      try {
        const examsRes = await api.get('/api/exams')
        examsData = examsRes.data || []
      } catch (err) {
        console.error('Failed to load exams:', err)
      }

      try {
        const historyRes = await api.get('/api/testsessions/my')
        historyData = historyRes.data || []
      } catch (err) {
        console.error('Failed to load history:', err)
      }

      setExams(examsData)
      setHistory(historyData)

      // Try to load performance profile for skill snapshot
      try {
        const profileRes = await api.get('/api/analytics/student-profile')
        setProfileData(profileRes.data)
      } catch {
        // Fallback — skill data simply won't render
      }
    } catch (err) {
      console.error('Failed to load data:', err)
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

  const completedSessions = history.filter(h => h.status === 'Completed')
  const completedCount = completedSessions.length
  const avgScore = completedCount > 0
    ? Math.round(completedSessions.reduce((sum, h) => sum + h.percentileRank, 0) / completedCount)
    : 0
  const bestScore = completedCount > 0
    ? Math.max(...completedSessions.map(h => h.percentileRank))
    : 0

  // Latest 3 completed results for trend
  const recentResults = completedSessions
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 3)
    .reverse()

  const availableExams = exams.filter(e => !e.sessionStatus)
  const resumableExams = exams.filter(e => {
    if (e.sessionStatus !== 'InProgress') return false
    if (!e.sessionStartedAt) return false
    const startedMs = new Date(e.sessionStartedAt).getTime()
    if (Number.isNaN(startedMs)) return false
    const durationMinutes = Number(e.durationMinutes || 0)
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
    const remainingSeconds = Math.max(0, durationMinutes * 60 - elapsedSeconds)
    if (remainingSeconds <= 0) return false
    if (e.endsAtUtc) {
      const endsMs = new Date(e.endsAtUtc).getTime()
      if (!Number.isNaN(endsMs) && Date.now() > endsMs) return false
    }
    return true
  })
    .sort((a, b) => new Date(b.sessionStartedAt).getTime() - new Date(a.sessionStartedAt).getTime())
    .slice(0, 1)

  // Near Deadline widget must be deadline-driven only:
  // - show the nearest-deadline exam that is not started
  // - never show resumable/in-progress exams
  // - if none with a valid upcoming deadline, show empty state
  const nowMs = Date.now()
  const nearDeadlineCandidates = availableExams.filter(e => {
    if (!e.endsAtUtc) return false
    const endsMs = new Date(e.endsAtUtc).getTime()
    if (Number.isNaN(endsMs)) return false
    return endsMs > nowMs
  })

  const nextExam = [...nearDeadlineCandidates]
    .sort((a, b) => new Date(a.endsAtUtc).getTime() - new Date(b.endsAtUtc).getTime())[0] ?? null

  // Skill snapshot from profile data
  const topDomain = profileData?.radarStats
    ? [...profileData.radarStats].sort((a, b) => b.A - a.A)[0]
    : null
  const focusDomain = profileData?.radarStats
    ? [...profileData.radarStats].sort((a, b) => a.A - b.A)[0]
    : null

  // ── Design Tokens (matched to InstructorDashboard exactly) ──
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
      {/* ── Hero Welcome Card ── */}
      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.2rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="hero-title" style={{ fontSize: '1.7rem', margin: 0, color: 'rgba(255,255,255,0.95)', fontWeight: 800 }}>
              Welcome back, {user?.fullName?.split(' ')[0] || 'Student'}
            </h2>
            <p className="hero-subtitle" style={{ marginTop: '0.45rem', marginBottom: 0, color: 'rgba(255,255,255,0.75)' }}>
              Track your progress, review results and prepare for upcoming assessments.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
              onClick={() => navigate('/performance')}
            >
              My Performance
            </button>
            <button
              type="button"
              style={primaryButtonStyle}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
              onClick={() => navigate('/assessments')}
            >
              View Assessments
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-Column Grid ── */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.35fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left: Next Assessment + Recent Performance ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Next Assessment Card */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
              <span className="dash-card-title">Near Deadline Assessment</span>
            </div>

            {!nextExam ? (
              <div style={{ ...mutedText, fontSize: '0.95rem', padding: '0.5rem 0' }}>No upcoming assessments are currently nearing their deadline. Check back later.</div>
            ) : (
              <div style={{ ...listRowStyle, padding: '1.05rem 1.15rem', gap: '1.2rem', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.98rem', lineHeight: 1.4 }}>{nextExam.title}</div>
                    {nextExam.isAdaptive && (
                      <>
                        <div style={{ width: '1px', height: '0.95rem', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#d98f30', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Adaptive</div>
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: '0.45rem', fontSize: '0.9rem', ...mutedText, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    {nextExam.questionCount} questions <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {nextExam.durationMinutes ? `${nextExam.durationMinutes} min` : 'Untimed'} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> Ready to start
                  </div>
                </div>

                <button
                  type="button"
                  style={{ ...primaryButtonStyle, flexShrink: 0 }}
                  onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                  onClick={() => navigate(`/exam/${nextExam.id}`)}
                >
                  Start Now
                </button>
              </div>
            )}

          </div>

          {/* Latest 3 Performance */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="dash-card-title">Latest 3 Performance</span>
              </div>
            </div>

            {recentResults.length === 0 ? (
              <div style={{ ...mutedText, fontSize: '0.95rem', padding: '0.5rem 0' }}>Complete your first assessment to see your performance trend.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentResults.map(h => (
                  <div key={h.id} style={listRowStyle}>
                    <div style={{ minWidth: 0, flex: '1 1 60%', paddingRight: '0.75rem' }}>
                      <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.35, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{h.examTitle}</div>
                      <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...mutedText, display: 'flex', alignItems: 'center' }}>
                        {formatShortDate(h.startedAt)} <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {h.status}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '1px', height: '2rem', background: 'transparent' }} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: h.percentileRank >= 70 ? '#34d399' : h.percentileRank >= 50 ? '#fbbf24' : '#f87171' }}>{h.percentileRank}%</div>
                        <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase' }}>Score</div>
                      </div>
                      <div style={{ width: '1px', height: '2rem', background: 'transparent' }} />
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                        onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                        onClick={() => navigate(`/result/${h.id}`)}
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Quick Stats + Skill Snapshot ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quick Stats */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
              <span className="dash-card-title">Quick Stats</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ ...nestedPanelStyle, padding: '1.1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d98f30' }}>{completedCount}</div>
                <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase', marginTop: '0.3rem', letterSpacing: '0.04em', fontWeight: 600 }}>Completed</div>
              </div>
              <div style={{ ...nestedPanelStyle, padding: '1.1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)' }}>{availableExams.length}</div>
                <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase', marginTop: '0.3rem', letterSpacing: '0.04em', fontWeight: 600 }}>Available</div>
              </div>
              <div style={{ ...nestedPanelStyle, padding: '1.1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{avgScore}%</div>
                <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase', marginTop: '0.3rem', letterSpacing: '0.04em', fontWeight: 600 }}>Avg Score</div>
              </div>
              <div style={{ ...nestedPanelStyle, padding: '1.1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{bestScore}%</div>
                <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase', marginTop: '0.3rem', letterSpacing: '0.04em', fontWeight: 600 }}>Best Score</div>
              </div>
            </div>
          </div>

          {/* Resumable Assessments */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div className="dash-card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dash-card-title">Resumable Assessment</span>
            </div>

            {resumableExams.length === 0 ? (
              <div style={{ ...mutedText, fontSize: '0.95rem', padding: '0.5rem 0' }}>No resumable assessment right now.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {resumableExams.map(exam => (
                  <div key={exam.id} style={listRowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exam.title}</div>
                      <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...mutedText, display: 'flex', alignItems: 'center' }}>
                        {exam.questionCount} questions <span style={{ margin: '0 0.6rem', opacity: 0.4 }}>•</span> {exam.durationMinutes ? `${exam.durationMinutes} min` : 'Untimed'}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                      onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                      onClick={() => navigate(`/exam/${exam.id}`)}
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
