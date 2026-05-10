import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const sectionPanelStyle = {
  background: '#333335',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px',
  padding: '1.6rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

/* ── Shared card accent colors (cycle per card) ─────── */
const cardAccents = [
  { bar: '#d98f30', badge: 'rgba(217,143,48,0.15)', badgeText: '#d98f30' },
  { bar: '#8b5cf6', badge: 'rgba(139,92,246,0.15)', badgeText: '#a78bfa' },
  { bar: '#06b6d4', badge: 'rgba(6,182,212,0.15)', badgeText: '#22d3ee' },
  { bar: '#ec4899', badge: 'rgba(236,72,153,0.15)', badgeText: '#f472b6' },
  { bar: '#10b981', badge: 'rgba(16,185,129,0.15)', badgeText: '#34d399' },
]

const canResumeExam = (exam) => {
  if (!exam) return false
  if (exam.sessionStatus !== 'InProgress' && exam.sessionStatus !== 'Abandoned') return false
  if (!exam.sessionStartedAt) return false

  const startedMs = new Date(exam.sessionStartedAt).getTime()
  if (Number.isNaN(startedMs)) return false

  // Deadline check (separate from duration). If deadline passed, do not allow resume.
  if (exam.endsAtUtc) {
    const endsMs = new Date(exam.endsAtUtc).getTime()
    if (!Number.isNaN(endsMs) && Date.now() > endsMs) return false
  }

  // Duration remaining check (this is the key requirement)
  const durationMinutes = exam.durationMinutes == null ? null : Number(exam.durationMinutes)
  if (durationMinutes == null || Number.isNaN(durationMinutes) || durationMinutes <= 0) {
    // Untimed assessments can be resumed as long as deadline hasn't passed.
    return true
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
  const remainingSeconds = durationMinutes * 60 - elapsedSeconds
  return remainingSeconds > 0
}

/* ── Section Header Component ───────────────────────── */
const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <div>
      <div>
        <h2 style={{
          margin: 0,
          fontSize: '1.6rem',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.95)',
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          {title}
        </h2>
        <p style={{
          margin: '0.4rem 0 0',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.9rem',
          fontWeight: 400,
        }}>
          {subtitle}
        </p>
      </div>
    </div>
    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '1.5rem' }} />
  </div>
)

/* ── Empty State Component ──────────────────────────── */
const EmptyState = ({ message, compact = false }) => (
  <div style={{
    padding: compact ? '0.75rem 0.25rem' : '1rem 0 2rem 0',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '1.05rem'
  }}>
    {message}
  </div>
)

const formatDeadline = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/* ── Available Assessment Card ──────────────────────── */
const AvailableCard = ({ exam, index, onStart }) => {
  const accent = cardAccents[index % cardAccents.length]
  const deadlineText = formatDeadline(exam.endsAtUtc)
  return (
    <div
      style={{
        background: '#29292c',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '1.5rem 1.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease',
      }}
      onMouseOver={e => {
        e.currentTarget.style.filter = 'brightness(1.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.filter = 'brightness(1)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{
            margin: 0, fontSize: '1.25rem', fontWeight: 800,
            color: 'white', fontFamily: "'Poppins', sans-serif"
          }}>
            {exam.title}
          </h3>
          <div style={{ width: '1.5px', height: '1rem', background: 'rgba(255,255,255,0.2)' }} />
          <span style={{
            color: accent.bar, fontWeight: 750, fontSize: '0.9rem',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            {exam.isAdaptive ? 'Adaptive Engine' : 'Linear Engine'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', fontWeight: 500
        }}>
          <span>Questions : {exam.questionCount}</span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span>Duration : {exam.durationMinutes ? `${exam.durationMinutes}min` : 'Untimed'}</span>
          {deadlineText && (
            <>
              <span style={{ opacity: 0.5 }}>•</span>
              <span style={{ color: '#f87171', fontWeight: 600 }}>Deadline : {deadlineText}</span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={() => onStart(exam.id)}
        style={{
          background: '#d98f30', color: 'white', border: 'none',
          borderRadius: '100px', padding: '0.75rem 2rem',
          fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
          transition: 'filter 0.2s ease',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)', whiteSpace: 'nowrap'
        }}
        onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
        onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
      >
        Start Assessment
      </button>
    </div>
  )
}

/* ── Completed Assessment Card ──────────────────────── */
const CompletedCard = ({ exam, index, onView }) => {
  const accent = cardAccents[index % cardAccents.length]
  const score = exam.totalCorrect != null && exam.totalQuestions
    ? Math.round((exam.totalCorrect / exam.totalQuestions) * 100)
    : null
  const completedDate = exam.completedAt
    ? new Date(exam.completedAt)
    : null
  const timeLabel = completedDate
    ? completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
      completedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  return (
    <div
      style={{
        background: '#29292c',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '1.5rem 1.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease',
      }}
      onMouseOver={e => {
        e.currentTarget.style.filter = 'brightness(1.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.filter = 'brightness(1)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{
            margin: 0, fontSize: '1.25rem', fontWeight: 800,
            color: 'white', fontFamily: "'Poppins', sans-serif"
          }}>
            {exam.title}
          </h3>
          <div style={{ width: '1.5px', height: '1rem', background: 'rgba(255,255,255,0.2)' }} />
          <span style={{
            color: accent.bar, fontWeight: 750, fontSize: '0.9rem',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            {exam.isAdaptive ? 'Adaptive Engine' : 'Linear Engine'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', fontWeight: 500
        }}>
          {score !== null && (
            <>
              <span style={{ color: score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                Score : {score}%
              </span>
              <span style={{ opacity: 0.5 }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Correct : {exam.totalCorrect}/{exam.totalQuestions}
              </div>
              {timeLabel && (
                <>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Time : {timeLabel}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <button
        onClick={() => onView(exam.sessionId)}
        style={{
          background: '#d98f30', color: 'white', border: 'none',
          borderRadius: '100px', padding: '0.75rem 2rem',
          fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
          transition: 'filter 0.2s ease',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
          whiteSpace: 'nowrap'
        }}
        onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
        onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
      >
        View Results
      </button>
    </div>
  )
}

/* ── Missed / Resumable Assessment Card ─────────────── */
const MissedOrResumableCard = ({ exam, index, onResume }) => {
  const accent = cardAccents[index % cardAccents.length]
  const resumable = canResumeExam(exam)
  return (
    <div
      style={{
        background: '#29292c',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '1.5rem 1.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        opacity: resumable ? 1 : 0.7,
        transition: 'box-shadow 0.2s ease, opacity 0.2s ease, filter 0.2s ease, border-color 0.2s ease',
      }}
      onMouseOver={e => {
        e.currentTarget.style.opacity = resumable ? '1' : '0.85'
        e.currentTarget.style.filter = 'brightness(1.03)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.opacity = resumable ? '1' : '0.7'
        e.currentTarget.style.filter = 'brightness(1)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{
            margin: 0, fontSize: '1.25rem', fontWeight: 800,
            color: resumable ? 'white' : 'rgba(255,255,255,0.7)', fontFamily: "'Poppins', sans-serif"
          }}>
            {exam.title}
          </h3>
          <div style={{ width: '1.5px', height: '1rem', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{
            color: accent.bar, fontWeight: 750, fontSize: '0.9rem',
            textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7
          }}>
            {exam.isAdaptive ? 'Adaptive Engine' : 'Linear Engine'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', fontWeight: 500
        }}>
          <span>Questions : {exam.questionCount}</span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span>Time : {exam.durationMinutes ? `${exam.durationMinutes}min` : 'Untimed'}</span>
        </div>
      </div>
      {resumable ? (
        <button
          type="button"
          onClick={() => onResume?.(exam.id)}
          style={{
            background: '#d98f30', color: 'white', border: 'none',
            borderRadius: '100px', padding: '0.75rem 2rem',
            fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            transition: 'filter 0.2s ease',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
          onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
        >
          Resume
        </button>
      ) : (
        <div
          style={{
            background: '#9e2d42',
            color: 'white',
            border: 'none',
            borderRadius: '100px',
            padding: '0.75rem 1.8rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'default',
            transition: 'filter 0.2s ease',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap'
          }}
        >
          Missed
        </div>
      )}
    </div>
  )
}

/* ── Main Assessments Page ──────────────────────────── */
function Assessments() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadExams() }, [])

  const loadExams = async () => {
    try {
      const res = await api.get('/api/exams')
      setExams(res.data || [])
    } catch (err) {
      console.error('Failed to load exams:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  // Categorize exams based on session status
  const available = exams.filter(e => !e.sessionStatus)
  const completed = exams.filter(e => e.sessionStatus === 'Completed')
  const missedOrResumable = exams
    .filter(e => e.sessionStatus === 'InProgress' || e.sessionStatus === 'Abandoned')
    .sort((a, b) => {
      const aRes = canResumeExam(a)
      const bRes = canResumeExam(b)
      if (aRes !== bRes) return aRes ? -1 : 1
      const aMs = a?.sessionStartedAt ? new Date(a.sessionStartedAt).getTime() : 0
      const bMs = b?.sessionStartedAt ? new Date(b.sessionStartedAt).getTime() : 0
      return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs)
    })

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>

      {/* ── Available Assessments Section ─────────────── */}
      <div style={{ marginBottom: '2.0rem' }}>
        <div style={sectionPanelStyle}>
          <SectionHeader
            title="Available Assessments"
            subtitle="Review and begin your assigned assessments."
          />
          {available.length === 0 ? (
            <EmptyState message="No assessments are currently available." compact />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {available.map((exam, i) => (
                <AvailableCard key={exam.id} exam={exam} index={i} onStart={id => navigate(`/exam/${id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Missed / Resumable Assessments Section ───── */}
      <div style={{ marginBottom: '2.0rem' }}>
        <div style={sectionPanelStyle}>
          <SectionHeader
            title="Missed / Resumable Assessments"
            subtitle="Resume ongoing assessments and see the assessments you have missed."
          />
          {missedOrResumable.length === 0 ? (
            <EmptyState message="No missed or resumable assessments right now." compact />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {missedOrResumable.map((exam, i) => (
                <MissedOrResumableCard key={exam.id} exam={exam} index={i} onResume={id => navigate(`/exam/${id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Completed Assessments Section ────────────── */}
      <div style={{ marginBottom: '2.0rem' }}>
        <div style={sectionPanelStyle}>
          <SectionHeader
            title="Completed Assessments"
            subtitle="View your results and performance breakdowns."
          />
          {completed.length === 0 ? (
            <EmptyState message="No completed assessments yet. Start one above!" compact />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {completed.map((exam, i) => (
                <CompletedCard key={exam.id} exam={exam} index={i} onView={sessionId => navigate(`/result/${sessionId}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default Assessments
