import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { ExamStatuses } from '../../constants/appConstants'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'

// Inject modal animation styles once (kept local to this page)
if (typeof document !== 'undefined') {
  const existing = document.getElementById('examlist-modal-styles')
  if (!existing) {
    const tag = document.createElement('style')
    tag.id = 'examlist-modal-styles'
    tag.textContent = `
      @keyframes examOverlayIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes examModalPopIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .examlist-modal-overlay {
        animation: examOverlayIn 120ms ease-out;
        animation-fill-mode: both;
      }

      .examlist-modal-card {
        animation: examModalPopIn 140ms ease-out;
        animation-fill-mode: both;
        will-change: opacity;
      }

      @media (prefers-reduced-motion: reduce) {
        .examlist-modal-overlay,
        .examlist-modal-card {
          animation: none !important;
        }
      }
    `
    document.head.appendChild(tag)
  }
}

const getApiErrorMessage = (err, fallback) => {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  )
}

const Icons = {
  Document: () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
  Folder: () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
  Layers: () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>,
  Layout: () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>,
  Box: () => <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
}

function ExamList() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [examPendingDelete, setExamPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  const canonicalCardStyle = {
    background: '#333335',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  }

  const parseIsoDate = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  const getTimedState = (exam) => {
    const start = parseIsoDate(exam?.startsAtUtc)
    const end = parseIsoDate(exam?.endsAtUtc)
    if (!start || !end) return null

    const now = Date.now()
    if (now >= start.getTime() && now <= end.getTime()) return 'IN_PROGRESS'
    if (now > end.getTime()) return 'OVER'
    return null
  }

  const formatLocalDateTime = (iso) => {
    const d = parseIsoDate(iso)
    if (!d) return null
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d)
  }

  useEffect(() => { loadExams() }, [])

  useEffect(() => {
    if (!confirmDeleteOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConfirmDeleteOpen(false)
        setExamPendingDelete(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmDeleteOpen])

  useEffect(() => {
    if (!confirmDeleteOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [confirmDeleteOpen])

  const loadExams = async () => {
    try {
      const res = await api.get('/api/exams')
      setExams(res.data)
    } catch (err) {
      console.error('Failed to load exams:', err)
    } finally {
      setLoading(false)
    }
  }

  const requestDeleteExam = (exam) => {
    setExamPendingDelete(exam)
    setConfirmDeleteOpen(true)
  }

  const confirmDeleteExam = async () => {
    if (!examPendingDelete?.id) return
    setDeleting(true)
    try {
      await api.delete(`/api/exams/${examPendingDelete.id}`)
      setExams(prev => prev.filter(e => e.id !== examPendingDelete.id))
      toast.success('Exam deleted')
      setConfirmDeleteOpen(false)
      setExamPendingDelete(null)
    } catch (err) {
      console.error(err)
      toast.error(getApiErrorMessage(err, 'Failed to delete exam'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="loading-spinner" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>

  return (
    <div className="fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 180px)' }}>
      {confirmDeleteOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="examlist-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.48)',
            backdropFilter: 'blur(16px) saturate(1.05)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.25rem'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setConfirmDeleteOpen(false)
              setExamPendingDelete(null)
            }
          }}
        >
          <div
            className="examlist-modal-card"
            style={{
              ...canonicalCardStyle,
              width: '100%',
              maxWidth: '560px',
              padding: '1.5rem 1.6rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 750, color: 'white', marginBottom: '0.35rem' }}>
                  Delete exam?
                </div>
                <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
                  This will permanently remove <span style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 650 }}>
                    {examPendingDelete?.title || 'this exam'}
                  </span> from the database.
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '1.15rem 0 1.25rem' }} />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setConfirmDeleteOpen(false); setExamPendingDelete(null) }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '100px',
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => { if (!deleting) e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseOut={(e) => { if (!deleting) e.currentTarget.style.filter = 'brightness(1)' }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteExam}
                style={{
                  background: '#9e2d42',
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.8 : 1,
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => { if (!deleting) e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseOut={(e) => { if (!deleting) e.currentTarget.style.filter = 'brightness(1)' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="dash-card" style={{ ...canonicalCardStyle, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '1.7rem', color: 'rgba(255,255,255,0.95)', fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>Assessment Library</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginTop: '0.45rem', marginBottom: 0 }}>Organize and manage your assessment modules.</p>
        </div>
        <button 
          type="button"
          style={{ 
            padding: '0.75rem 1.8rem', 
            fontSize: '0.95rem',
            fontWeight: 700,
            borderRadius: '100px',
            background: '#d98f30',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
            transition: 'filter 0.2s ease',
            height: 'fit-content'
          }}
          onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)' }
          onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)' }
          onClick={() => navigate('/instructor/exams/create')}
        >
          Create New Exam
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {exams.map((exam, index) => {
          const IconComponents = [
            Icons.Document,
            Icons.Folder,
            Icons.Layers,
            Icons.Layout,
            Icons.Box
          ];
          const IconList = IconComponents[index % IconComponents.length];
          const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981'];
          const color = colors[index % colors.length];

          const timedState = getTimedState(exam)
          const showTimedIndicator = Boolean(timedState)

          const scheduleStartText = formatLocalDateTime(exam?.startsAtUtc)
          const scheduleEndText = formatLocalDateTime(exam?.endsAtUtc)
          const showScheduleLine = Boolean(scheduleStartText && scheduleEndText)
          
          return (
          <div key={exam.id} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1.2rem 1.5rem',
            ...canonicalCardStyle,
            marginBottom: '1rem',
            gap: '1.5rem',
            transition: 'all 0.2s',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              padding: '0 0.25rem'
            }}>
              <IconList />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.6rem',
                marginBottom: '0.22rem',
                minWidth: 0
              }}>
                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.01em',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {exam.title}
                </div>

                {showTimedIndicator && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: '1px',
                      height: '1.05rem',
                      background: 'rgba(255, 255, 255, 0.65)',
                      display: 'inline-block',
                      transform: 'translateY(2px)'
                    }}
                  />
                )}

                {showTimedIndicator && (
                  <span style={{
                    color: '#d98f30',
                    fontWeight: 700,
                    fontSize: '0.98rem',
                    whiteSpace: 'nowrap'
                  }}>
                    {timedState === 'IN_PROGRESS' ? 'IN PROGRESS' : 'OVER'}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.92rem', color: '#b5b5b7', display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 500 }}>
                <span>{exam.questionCount} Questions</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>•</span>
                <span>{exam.isAdaptive ? 'Adaptive Engine' : 'Standard Linear'}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>•</span>

                <span style={{
                  color: exam.status === ExamStatuses.Draft ? (
                    (() => {
                      const rule1Met = exam.questionCount > 0
                      const rule2Met = !exam.isAdaptive ? exam.questionCount === (exam.maxQuestions || 10) : true
                      const rule3Met = exam.isAdaptive ? exam.questionCount >= ((exam.maxQuestions || 10) * 3) : true
                      const rule4Met = exam.isAdaptive ? exam.hasPoolSettings : true
                      return (rule1Met && rule2Met && rule3Met && rule4Met) ? '#fbbf24' : '#b55810'
                    })()
                  ) : (exam.status === ExamStatuses.Published ? '#34d399' : '#9ca3af'),
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}>
                  {exam.status === ExamStatuses.Draft ? (
                    (() => {
                      const rule1Met = exam.questionCount > 0
                      const rule2Met = !exam.isAdaptive ? exam.questionCount === (exam.maxQuestions || 10) : true
                      const rule3Met = exam.isAdaptive ? exam.questionCount >= ((exam.maxQuestions || 10) * 3) : true
                      const rule4Met = exam.isAdaptive ? exam.hasPoolSettings : true
                      return (rule1Met && rule2Met && rule3Met && rule4Met) ? 'READY TO PUBLISH' : 'UNDER REVIEW'
                    })()
                  ) : exam.status}
                </span>
              </div>

              {showScheduleLine && (
                <div style={{
                  marginTop: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.92rem',
                  color: '#b5b5b7',
                  fontWeight: 500
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Start :</span>
                  <span>{scheduleStartText}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      width: '1px',
                      height: '1.05rem',
                      background: 'rgba(255, 255, 255, 0.18)',
                      display: 'inline-block'
                    }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>To :</span>
                  <span>{scheduleEndText}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', alignSelf: 'center' }}>
              <button 
                style={{
                  background: '#9e2d42', /* Exact solid crimson from image */
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                onClick={() => requestDeleteExam(exam)}
              >
                DELETE
              </button>
              
              <button 
                style={{
                  background: '#c48c34', /* Exact solid matching gold/orange from image */
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                onClick={() => navigate(`/instructor/exams/${exam.id}`)}
              >
                EDIT
              </button>

              <button 
                style={{
                  background: '#3e3e40', /* Exact solid dark gray from image */
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                onClick={() => navigate(`/instructor/analytics/${exam.id}`)}
              >
                VIEW
              </button>
            </div>
          </div>
        )})}
        {exams.length === 0 && (
          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', padding: '4rem 2rem', textAlign: 'center' }}>
            No exams found. Click 'Create New Exam' to get started.
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamList
