import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import api from '../../services/api'

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7v6l4 2"></path>
  </svg>
)

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 3v18"></path>
    <path d="M6 4h10l-2 4 2 4H6"></path>
  </svg>
)

function TakeExam() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [questionStartTime, setQuestionStartTime] = useState(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentNumber, setCurrentNumber] = useState(1)
  const [loading, setLoading] = useState(true)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(null)
  const [displayNumber, setDisplayNumber] = useState(1)
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set())
  const [answeredQuestions, setAnsweredQuestions] = useState(new Map())
  const [servedQuestions, setServedQuestions] = useState(new Map())
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [showQuestionNav] = useState(true)

  // Behavioral telemetry refs
  const tabSwitchCount = useRef(0)
  const sessionIdRef = useRef(null)
  const hiddenAtRef = useRef(null)
  const currentQuestionIdRef = useRef(null)
  const currentNumberRef = useRef(1)

  const lastActivityAtRef = useRef(Date.now())
  const idleStartAtRef = useRef(null)
  const idleLoggedForCurrentGapRef = useRef(false)

  const lastMouseSampleAtRef = useRef(0)
  const lastMousePosRef = useRef(null)
  const mouseDistanceRef = useRef(0)
  const mouseMoveCountRef = useRef(0)
  const mouseAngleBinsRef = useRef(Array(8).fill(0))
  const lastFocusLostAtRef = useRef(0)
  const timeoutHandledRef = useRef(false)

  // Telemetry batching (avoid one network request per event)
  const telemetryQueueRef = useRef([])
  const telemetryFlushInFlightRef = useRef(false)

  // Start exam
  useEffect(() => {
    startExam()
  }, [])

  useEffect(() => {
    currentQuestionIdRef.current = currentQuestion?.id ?? null
    currentNumberRef.current = currentNumber
  }, [currentQuestion?.id, currentNumber])

  // Tab switch detection
  useEffect(() => {
    const logFocusLost = () => {
      if (!sessionIdRef.current) return
      const now = Date.now()
      // Avoid double-counting from blur + visibilitychange firing together
      if (now - lastFocusLostAtRef.current < 750) return
      lastFocusLostAtRef.current = now
      logEvent('FocusLost', JSON.stringify({ timestamp: now }))
    }

    const handleVisibilityChange = () => {
      if (document.hidden && sessionIdRef.current) {
        tabSwitchCount.current++
        hiddenAtRef.current = Date.now()
        logEvent('TabSwitch', JSON.stringify({ count: tabSwitchCount.current }))
        logFocusLost()
      }

      if (!document.hidden && sessionIdRef.current) {
        logEvent('FocusGained', JSON.stringify({ timestamp: Date.now() }))
        if (hiddenAtRef.current) {
          const hiddenDurationMs = Date.now() - hiddenAtRef.current
          logEvent('QuestionRevisit', JSON.stringify({ hiddenDurationMs, questionId: currentQuestionIdRef.current, questionNumber: currentNumberRef.current }))
          hiddenAtRef.current = null
        }
      }
    }

    const handlePaste = (e) => {
      if (sessionIdRef.current) {
        e.preventDefault()
        logEvent('CopyPaste', JSON.stringify({ timestamp: Date.now() }))
      }
    }

    const handleContextMenu = (e) => {
      if (sessionIdRef.current) {
        e.preventDefault()
        logEvent('RightClick', JSON.stringify({ timestamp: Date.now() }))
      }
    }

    const markActivity = () => {
      lastActivityAtRef.current = Date.now()
      if (idleStartAtRef.current && !idleLoggedForCurrentGapRef.current && sessionIdRef.current) {
        const durationMs = Date.now() - idleStartAtRef.current
        idleLoggedForCurrentGapRef.current = true
        logEvent('IdlePeriod', JSON.stringify({ durationMs, thresholdMs: 60000, questionId: currentQuestionIdRef.current, questionNumber: currentNumberRef.current }))
      }
    }

    const handleWindowBlur = () => {
      logFocusLost()
    }

    const handleMouseMove = (e) => {
      if (!sessionIdRef.current) return

      // Throttle sampling to reduce overhead
      const now = Date.now()
      if (now - lastMouseSampleAtRef.current < 100) return
      lastMouseSampleAtRef.current = now

      const prev = lastMousePosRef.current
      const next = { x: e.clientX, y: e.clientY }
      lastMousePosRef.current = next

      if (prev) {
        const dx = next.x - prev.x
        const dy = next.y - prev.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          mouseDistanceRef.current += dist
          mouseMoveCountRef.current += 1

          const angle = Math.atan2(dy, dx) // [-pi, pi]
          const normalized = (angle + Math.PI) / (2 * Math.PI) // [0,1)
          const bin = Math.min(7, Math.floor(normalized * 8))
          mouseAngleBinsRef.current[bin] += 1
        }
      }

      markActivity()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', markActivity)
    document.addEventListener('mousedown', markActivity)
    document.addEventListener('touchstart', markActivity)

    const idleInterval = setInterval(() => {
      if (!sessionIdRef.current) return
      const now = Date.now()
      const idleMs = now - lastActivityAtRef.current
      if (idleMs >= 60000 && !idleStartAtRef.current) {
        idleStartAtRef.current = now
        idleLoggedForCurrentGapRef.current = false
      }
      if (idleMs < 60000 && idleStartAtRef.current) {
        // Reset idle state after returning to activity
        idleStartAtRef.current = null
        idleLoggedForCurrentGapRef.current = false
      }
    }, 2500)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', markActivity)
      document.removeEventListener('mousedown', markActivity)
      document.removeEventListener('touchstart', markActivity)
      clearInterval(idleInterval)
    }
  }, [])

  const flushMouseSummary = async () => {
    if (!sessionIdRef.current) return
    if (mouseMoveCountRef.current <= 0) return

    const bins = mouseAngleBinsRef.current
    const total = bins.reduce((a, b) => a + b, 0)
    let entropy = 0
    if (total > 0) {
      bins.forEach(count => {
        if (count <= 0) return
        const p = count / total
        entropy += -p * Math.log2(p)
      })
    }

    const payload = {
      questionId: currentQuestionIdRef.current,
      questionNumber: currentNumberRef.current,
      sampleCount: mouseMoveCountRef.current,
      totalDistance: Math.round(mouseDistanceRef.current * 100) / 100,
      angleEntropy: Math.round(entropy * 1000000) / 1000000,
    }

    // Reset for next question/window
    mouseDistanceRef.current = 0
    mouseMoveCountRef.current = 0
    mouseAngleBinsRef.current = Array(8).fill(0)

    await logEvent('MouseMovementSummary', JSON.stringify(payload))
  }

  const logEvent = async (eventType, eventData) => {
    try {
      if (!sessionIdRef.current) return

      telemetryQueueRef.current.push({ eventType, eventData })

      // Flush opportunistically when queue grows.
      if (telemetryQueueRef.current.length >= 15) {
        await flushTelemetry()
      }
    } catch (err) {
      // Silently fail — don't disrupt the exam
    }
  }

  const flushTelemetry = async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    if (telemetryFlushInFlightRef.current) return
    if (!telemetryQueueRef.current?.length) return

    // Keep payloads small; flush in chunks.
    const batch = telemetryQueueRef.current.splice(0, 50)
    if (batch.length === 0) return

    telemetryFlushInFlightRef.current = true
    try {
      await api.post(`/api/testsessions/${sessionId}/events/batch`, batch)
    } catch (err) {
      // Best-effort: drop telemetry if network fails
    } finally {
      telemetryFlushInFlightRef.current = false
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      flushTelemetry()
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const startExam = async () => {
    try {
      const res = await api.post(`/api/testsessions/start/${examId}`)
      const startingNumber = Math.max(1, res.data.currentQuestionNumber || 1)
      sessionIdRef.current = res.data.sessionId
      setSession(res.data)
      setCurrentQuestion(res.data.firstQuestion)
      setTotalQuestions(res.data.totalQuestions)
      setTimeLeftSeconds(
        typeof res.data.remainingSeconds === 'number'
          ? Math.max(0, res.data.remainingSeconds)
          : Math.max(0, (res.data.durationMinutes || 0) * 60)
      )
      setQuestionStartTime(Date.now())
      setCurrentNumber(startingNumber)
      setDisplayNumber(startingNumber)
      setSelectedOption(null)
      setError('')
      timeoutHandledRef.current = false
      setFlaggedQuestions(new Set())
      setAnsweredQuestions(new Map())
      setServedQuestions(new Map([
        [startingNumber, { question: res.data.firstQuestion, selectedOptionId: null, isCorrect: null }]
      ]))
    } catch (err) {
      setError(err.response?.data?.title || err.response?.data?.error || 'Failed to start exam')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (!sessionIdRef.current) return
      setTimeLeftSeconds(prev => {
        if (typeof prev !== 'number') return prev
        if (prev <= 0) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!sessionIdRef.current || typeof timeLeftSeconds !== 'number') return
    if (timeLeftSeconds > 0) return
    if (timeoutHandledRef.current) return
    timeoutHandledRef.current = true
    navigate(`/result/${sessionIdRef.current}`)
  }, [timeLeftSeconds, navigate])

  const handleQuestionJump = (questionNumber) => {
    if (submitting) return
    if (questionNumber > currentNumber) return

    if (questionNumber === currentNumber) {
      setDisplayNumber(currentNumber)
      return
    }

    const questionEntry = servedQuestions.get(questionNumber)
    if (!questionEntry?.selectedOptionId) return

    setDisplayNumber(questionNumber)
  }

  const toggleFlagForDisplayedQuestion = () => {
    if (!displayedQuestion?.id) return

    setFlaggedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(displayedQuestion.id)) next.delete(displayedQuestion.id)
      else next.add(displayedQuestion.id)
      return next
    })
  }

  const reviewFirstFlagged = () => {
    if (!flaggedQuestionNumbers.length) return
    setDisplayNumber(flaggedQuestionNumbers[0])
    setShowFlagModal(false)
  }

  const submitAnswer = async () => {
    if (!selectedOption || submitting || timeLeftSeconds === 0 || displayNumber !== currentNumber) return
    if (!currentQuestion?.id || !questionStartTime) return

    setSubmitting(true)
    const timeTakenMs = Date.now() - questionStartTime
    const nextNumber = currentNumber + 1

    try {
      // Do not block answer submission on telemetry.
      flushMouseSummary()
      const res = await api.post(`/api/testsessions/${sessionIdRef.current}/answer`, {
        questionId: currentQuestion.id,
        selectedOptionId: selectedOption,
        timeTakenMs
      })

      setAnsweredQuestions((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, selectedOption)
        return next
      })

      setServedQuestions((prev) => {
        const next = new Map(prev)
        next.set(currentNumber, {
          question: currentQuestion,
          selectedOptionId: selectedOption,
          isCorrect: null
        })

        if (!res.data.isComplete && res.data.nextQuestion) {
          next.set(nextNumber, {
            question: res.data.nextQuestion,
            selectedOptionId: null,
            isCorrect: null
          })
        }

        return next
      })

      if (res.data.isComplete) {
        navigate(`/result/${sessionIdRef.current}`)
        return
      }

      setCurrentQuestion(res.data.nextQuestion)
      setCurrentNumber(nextNumber)
      setDisplayNumber(nextNumber)
      setSelectedOption(null)
      setQuestionStartTime(Date.now())
      setShowFlagModal(false)

    } catch (err) {
      setError(err.response?.data?.title || err.response?.data?.error || 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="exam-container fade-in">
        <div className="exam-loading card">
          <div className="exam-loading-spinner">
            <div className="spinner"></div>
          </div>
          <div className="exam-loading-copy">
            <div className="exam-loading-title">Preparing your assessment</div>
            <div className="exam-loading-subtitle">Loading questions, timer and session state…</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="exam-container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Error</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const progressPercent = totalQuestions > 0 ? (currentNumber / totalQuestions) * 100 : 0
  const displayedQuestionEntry = displayNumber === currentNumber
    ? { question: currentQuestion, selectedOptionId: selectedOption }
    : servedQuestions.get(displayNumber)

  const displayedQuestion = displayedQuestionEntry?.question ?? null
  const displayedSelectedOption = displayNumber === currentNumber
    ? selectedOption
    : displayedQuestionEntry?.selectedOptionId ?? null

  const isReviewMode = displayNumber !== currentNumber
  const isCurrentQuestionFlagged = displayedQuestion?.id
    ? flaggedQuestions.has(displayedQuestion.id)
    : false

  const answeredCount = answeredQuestions.size
  const remainingCount = Math.max(0, totalQuestions - answeredCount)

  const flaggedQuestionNumbers = Array.from(servedQuestions.entries())
    .filter(([, value]) => value?.question?.id && flaggedQuestions.has(value.question.id))
    .map(([questionNumber]) => questionNumber)
    .sort((a, b) => a - b)

  const timerClass = typeof timeLeftSeconds === 'number' && timeLeftSeconds <= 30
    ? 'critical'
    : typeof timeLeftSeconds === 'number' && timeLeftSeconds <= 60
      ? 'warning'
      : ''

  const formatTimeLeft = (seconds) => {
    if (typeof seconds !== 'number' || seconds < 0) return '--:--'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const canSubmitCurrent = !isReviewMode && timeLeftSeconds !== 0
  const title = session?.examTitle || 'Exam Session'

  const primaryButtonStyle = {
    background: '#d98f30',
    color: 'white',
    border: 'none',
    borderRadius: '999px',
    padding: '0.75rem 2rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'filter 0.2s ease',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
    whiteSpace: 'nowrap'
  }

  const secondaryButtonStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    color: 'rgba(255, 255, 255, 0.92)',
    borderRadius: '999px',
    padding: '0.75rem 1.8rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'filter 0.2s ease',
    whiteSpace: 'nowrap'
  }

  return (
    <div className="exam-container fade-in">
      <div className="card exam-header-card">
        <div className="exam-header-grid">
          <div className="exam-header-left">
            <div className="exam-title-wrap">
              <h2 className="exam-session-title">{title}</h2>
              <div className="exam-subline">
                <span className="exam-count-label">
                  {isReviewMode
                    ? `Reviewing Question ${displayNumber} of ${totalQuestions}`
                    : `Question ${currentNumber} of ${totalQuestions}`}
                </span>
                {isReviewMode && <span className="exam-chip">Review mode</span>}
              </div>
            </div>

            <div className="exam-metrics">
              <div className="exam-metric">
                <div className="exam-metric-value">{answeredCount}</div>
                <div className="exam-metric-label">Answered</div>
              </div>
              <div className="exam-metric">
                <div className="exam-metric-value">{remainingCount}</div>
                <div className="exam-metric-label">Remaining</div>
              </div>
              <div className="exam-metric">
                <div className="exam-metric-value">{flaggedQuestionNumbers.length}</div>
                <div className="exam-metric-label">Flagged</div>
              </div>
            </div>
          </div>

          <div className="exam-header-center">
            <div className="exam-progress-wrap" aria-label="Progress">
              <div className="exam-progress-track">
                <div className="exam-progress-glow" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div className="exam-progress-meta">
                <span className="exam-progress-label">{Math.round(progressPercent)}%</span>
                <span className="exam-progress-hint">Keep going — focus on accuracy.</span>
              </div>
            </div>
          </div>

          <div className="exam-header-right">
            <button
              type="button"
              className={`exam-flag-counter ${flaggedQuestionNumbers.length ? 'active' : ''}`}
              onClick={() => setShowFlagModal(true)}
            >
              <FlagIcon />
              <span>View flagged</span>
              <span className="exam-flag-badge">{flaggedQuestionNumbers.length}</span>
            </button>

            <div className={`exam-timer-card ${timerClass}`} aria-label="Time remaining">
              <div className="exam-timer-label">
                <ClockIcon />
                <span>Time left</span>
              </div>
              <div className="exam-timer-value">{formatTimeLeft(timeLeftSeconds)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="exam-main-layout exam-main-layout-v2">
        <div className="exam-question-column">
          {displayedQuestion && (
            <div className="card question-card">
              <div className="question-card-head">
                <div className="question-number">Question {displayNumber}</div>
                <button
                  type="button"
                  className={`flag-btn ${isCurrentQuestionFlagged ? 'active' : ''}`}
                  onClick={toggleFlagForDisplayedQuestion}
                  aria-label={isCurrentQuestionFlagged ? 'Unflag question' : 'Flag question for review'}
                  title={isCurrentQuestionFlagged ? 'Flagged for review' : 'Flag for review'}
                >
                  <FlagIcon />
                  <span className="flag-spark flag-spark-1" aria-hidden="true"></span>
                  <span className="flag-spark flag-spark-2" aria-hidden="true"></span>
                  <span className="flag-spark flag-spark-3" aria-hidden="true"></span>
                </button>
              </div>

              <div className="question-text">{displayedQuestion.questionText}</div>
              <div className="question-separator"></div>

              {isReviewMode && (
                <div className="exam-review-pill">Review mode: answers are read-only.</div>
              )}

              <div className="options-list">
                {displayedQuestion.options.map((opt, idx) => {
                  let className = 'option-btn'
                  const isSelected = opt.id === displayedSelectedOption

                  if (isSelected) className += ' selected'

                  return (
                    <button
                      key={opt.id}
                      className={className}
                      onClick={() => {
                        if (isReviewMode || submitting || timeLeftSeconds === 0) return
                        setSelectedOption(opt.id)
                      }}
                      disabled={isReviewMode || submitting || timeLeftSeconds === 0}
                    >
                      <span className="option-letter">{OPTION_LETTERS[idx]}</span>
                      <span>{opt.optionText}</span>
                    </button>
                  )
                })}
              </div>

              <div className="question-card-actions">
                {isReviewMode && (
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                    onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                    onClick={() => setDisplayNumber(currentNumber)}
                  >
                    Return to Current Question
                  </button>
                )}

                {canSubmitCurrent && (
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    onClick={submitAnswer}
                    disabled={!selectedOption || submitting}
                    onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                    onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                  >
                    {submitting
                      ? 'Submitting...'
                      : currentNumber === totalQuestions
                        ? 'Finish Exam'
                        : 'Submit & Next'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {showQuestionNav && (
          <aside className="exam-question-nav-panel exam-sidebar-stack">
            <div className="exam-sidebar-card">
              <div className="question-nav-head">
                <h3>Session Overview</h3>
                <button
                  type="button"
                  className="exam-link-btn"
                  onClick={() => setShowFlagModal(true)}
                >
                  Flagged
                </button>
              </div>
              <div className="exam-sidebar-metrics">
                <div className="exam-sidebar-metric">
                  <div className="exam-sidebar-metric-value">{answeredCount}/{totalQuestions}</div>
                  <div className="exam-sidebar-metric-label">Answered</div>
                </div>
                <div className="exam-sidebar-metric">
                  <div className={`exam-sidebar-timer ${timerClass}`}>{formatTimeLeft(timeLeftSeconds)}</div>
                  <div className="exam-sidebar-metric-label">Time left</div>
                </div>
              </div>
              {isReviewMode && (
                <div className="exam-review-pill">Review mode: answers are read-only.</div>
              )}
            </div>

            <div className="exam-sidebar-card">
              <div className="question-nav-head">
                <h3>Question Navigation</h3>
                <div className="exam-subhint">Jump back to answered questions.</div>
              </div>

              <div className="question-nav-grid">
              {Array.from({ length: totalQuestions }, (_, idx) => {
                const questionNumber = idx + 1
                const questionEntry = servedQuestions.get(questionNumber)
                const questionId = questionEntry?.question?.id
                const isLocked = questionNumber > currentNumber
                const isCurrent = questionNumber === displayNumber
                const isAnswered = questionId ? answeredQuestions.has(questionId) : false
                const isFlagged = questionId ? flaggedQuestions.has(questionId) : false

                return (
                  <button
                    key={questionNumber}
                    type="button"
                    className={`qnav-btn ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}`}
                    onClick={() => handleQuestionJump(questionNumber)}
                    disabled={isLocked || submitting}
                    title={isLocked ? 'Question not served yet' : `Question ${questionNumber}`}
                  >
                    <span>{questionNumber}</span>
                    {isFlagged && <FlagIcon />}
                  </button>
                )
              })}
              </div>
            </div>
          </aside>
        )}
      </div>

      {showFlagModal && createPortal(
        <div
          className="exam-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowFlagModal(false)
          }}
        >
          <div className="exam-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Flagged Questions</h3>
            <p>You have {flaggedQuestionNumbers.length} flagged question(s).</p>

            {flaggedQuestionNumbers.length > 0 ? (
              <div className="exam-flagged-list">
                {flaggedQuestionNumbers.map((questionNumber) => (
                  <button
                    key={questionNumber}
                    type="button"
                    className="exam-flag-chip"
                    onClick={() => {
                      setDisplayNumber(questionNumber)
                      setShowFlagModal(false)
                    }}
                  >
                    Question {questionNumber}
                  </button>
                ))}
              </div>
            ) : (
              <div className="exam-flag-empty">No flagged questions yet.</div>
            )}

            <div className="exam-modal-actions">
              <button
                type="button"
                style={secondaryButtonStyle}
                onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                onClick={reviewFirstFlagged}
                disabled={!flaggedQuestionNumbers.length}
              >
                Review Flagged
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                onClick={() => {
                  setShowFlagModal(false)
                  setDisplayNumber(currentNumber)
                }}
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default TakeExam
