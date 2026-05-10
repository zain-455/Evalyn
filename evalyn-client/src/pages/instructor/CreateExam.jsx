import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

/**
 * StepBadge: Premium indicator replacing the previous circular numbering.
 * Uses icons and a phase label for a more structured, dashboard-aligned feel.
 */
const StepBadge = ({ phase }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <span style={{ 
      fontSize: '1.2rem', 
      fontWeight: 800, 
      color: '#d98f30', 
      textTransform: 'uppercase', 
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap'
    }}>
      Phase {phase}
    </span>
    <div style={{ 
      width: '1px', 
      height: '1.5rem', 
      background: 'rgba(255, 255, 255, 0.12)',
      flexShrink: 0
    }} />
  </div>
)

// -- Icons --
const IconDetails = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
const IconSettings = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
const IconAudience = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
const IconBolt = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>

// Removed LinearVisualizer and AdaptiveVisualizer


function CreateExam() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [maxQuestions, setMaxQuestions] = useState('')
  const [startsAtLocal, setStartsAtLocal] = useState('')
  const [endsAtLocal, setEndsAtLocal] = useState('')
  const [isAdaptive, setIsAdaptive] = useState(true)
  const [audienceType, setAudienceType] = useState('SECTION') // SECTION, MULTI_SECTION, INDIVIDUAL
  const [sectionsInput, setSectionsInput] = useState('')
  const [studentIdsInput, setStudentIdsInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const descriptionRef = useRef(null)

  const autoGrowTextarea = (textareaEl) => {
    if (!textareaEl) return
    textareaEl.style.height = 'auto'
    textareaEl.style.height = `${textareaEl.scrollHeight}px`
  }

  useLayoutEffect(() => {
    autoGrowTextarea(descriptionRef.current)
  }, [description])

  const toUtcIsoOrNull = (dateTimeLocalValue) => {
    if (!dateTimeLocalValue) return null
    const d = new Date(dateTimeLocalValue)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const duration = parseInt(durationMinutes)
    const maxQ = parseInt(maxQuestions)

    if (title.trim().length < 3) {
      setError('Exam title must be at least 3 characters.')
      return
    }
    if (!duration || duration < 1) {
      setError('Duration must be at least 1 minute.')
      return
    }
    if (!maxQ || maxQ < 1) {
      setError('Max questions must be at least 1.')
      return
    }

    const hasStart = Boolean(startsAtLocal)
    const hasEnd = Boolean(endsAtLocal)
    if (hasStart !== hasEnd) {
      setError('Please set both a start time and an end time (or leave both empty).')
      return
    }
    if (hasStart && hasEnd) {
      const startDate = new Date(startsAtLocal)
      const endDate = new Date(endsAtLocal)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setError('Invalid start/end time. Please pick a valid date and time.')
        return
      }
      if (endDate <= startDate) {
        setError('End time must be after start time.')
        return
      }
    }

    setLoading(true)
    try {
      const sections = (audienceType === 'SECTION' || audienceType === 'MULTI_SECTION')
        ? sectionsInput.split(',').map(s => s.trim()).filter(Boolean)
        : []
      
      const studentIds = audienceType === 'INDIVIDUAL'
        ? studentIdsInput.split(',').map(s => s.trim()).filter(Boolean)
        : []

      const res = await api.post('/api/exams', {
        title,
        description,
        durationMinutes: duration,
        maxQuestions: maxQ,
        isAdaptive,
        audienceType,
        sections: sections.length > 0 ? sections : null,
        studentIds: studentIds.length > 0 ? studentIds : null,
        startsAtUtc: toUtcIsoOrNull(startsAtLocal),
        endsAtUtc: toUtcIsoOrNull(endsAtLocal)
      })
      navigate(`/instructor/exams/${res.data.id}`)
    } catch (err) {
      console.error(err)
      const data = err.response?.data
      const msg = data?.errors
        ? Object.values(data.errors).flat().join(' ')
        : data?.error || data?.title || 'Failed to create exam.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Canonical Design Tokens ─────────────────────────
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
    padding: '0.75rem 1.6rem',
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'filter 0.2s ease',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
    opacity: loading ? 0.7 : 1
  }

  const secondaryButtonStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    color: 'rgba(255, 255, 255, 0.92)',
    borderRadius: '100px',
    padding: '0.75rem 1.6rem',
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'filter 0.2s ease'
  }

  const labelStyle = {
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: '0.6rem',
    display: 'block',
    fontWeight: 600,
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  }

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.22)',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    fontWeight: 400,
    padding: '0 1.1rem',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.95)',
    width: '100%',
    boxSizing: 'border-box',
    height: '48px'
  }

  const dateTimeInputStyle = {
    ...inputStyle,
    colorScheme: 'dark'
  }

  const textareaStyle = {
    ...inputStyle,
    padding: '1rem 1.1rem',
    minHeight: '220px',
    resize: 'none',
    overflow: 'hidden'
  }

  const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.75rem'
  }

  const cardTitleStyle = {
    fontSize: '1.2rem',
    fontWeight: 750,
    color: 'white',
    margin: 0,
    letterSpacing: '-0.01em'
  }

  const selectionCardStyle = (selected) => ({
    ...nestedPanelStyle,
    padding: '1.5rem',
    background: selected ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.25)',
    border: selected ? '1px solid rgba(217, 143, 48, 0.4)' : '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    flex: 1,
    minHeight: '130px',
    borderRadius: '16px',
    position: 'relative',
    boxShadow: selected ? '0 8px 24px rgba(0, 0, 0, 0.4)' : 'none',
    transform: selected ? 'translateY(-2px)' : 'none'
  })

  const radioIndicatorStyle = (selected) => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: `2px solid ${selected ? '#d98f30' : 'rgba(255,255,255,0.25)'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s ease',
    position: 'absolute',
    top: '1.25rem',
    right: '1.25rem'
  })

  const radioInnerStyle = {
    width: '10px',
    height: '10px',
    background: '#d98f30',
    borderRadius: '50%'
  }

  return (
    <div className="fade-in" style={{ position: 'relative', paddingBottom: '3rem' }}>
      {/* ── Page Header ── */}
      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.35rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="hero-title" style={{ fontSize: '1.7rem', margin: 0, color: 'rgba(255,255,255,0.95)', fontWeight: 800 }}>Create New Exam</h2>
            <p className="hero-subtitle" style={{ marginTop: '0.4rem', marginBottom: 0, color: 'rgba(255,255,255,0.55)' }}>Configure assessment parameters, engine logic, and audience visibility.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
              onClick={() => navigate('/instructor/exams')}
            >
              Back
            </button>
            <button
              type="submit"
              form="create-exam-form"
              disabled={loading}
              style={primaryButtonStyle}
              onMouseOver={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {loading ? 'Creating...' : 'Create Exam & Continue'}
            </button>
          </div>
        </div>
      </div>

      <form id="create-exam-form" onSubmit={handleSubmit}>
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.18)',
            color: '#f87171',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {error}
          </div>
        )}

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Step 1: Exam Details */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.85rem' }}>
            <div style={cardHeaderStyle}>
              <StepBadge phase="1" />
              <h3 style={cardTitleStyle}>Exam Details</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label style={labelStyle}>Exam Title</label>
                <input
                  type="text"
                  className="exam-input"
                  style={inputStyle}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Advanced Machine Learning"
                  required
                />
              </div>

              <div className="form-group">
                <label style={labelStyle}>Description (Optional)</label>
                <textarea
                  ref={descriptionRef}
                  className="exam-input"
                  style={textareaStyle}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide exam overview, rules, or instructions..."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    disabled={description.includes("Ensure a stable internet connection.")}
                    style={{
                      ...primaryButtonStyle,
                      opacity: description.includes("Ensure a stable internet connection.") ? 0.5 : (loading ? 0.7 : 1),
                      cursor: description.includes("Ensure a stable internet connection.") ? 'not-allowed' : (loading ? 'not-allowed' : 'pointer')
                    }}
                    onClick={() => {
                      const rules = "1. Ensure a stable internet connection.\n2. Do not switch tabs or close the browser.\n3. Complete the exam within the allocated time.\n4. Suspicious activity may result in disqualification.";
                      if (!description.includes("Ensure a stable internet connection.")) {
                        setDescription(prev => prev ? prev + '\n\n' + rules : rules);
                      }
                    }}
                    onMouseOver={e => { if (!description.includes("Ensure a stable internet connection.") && !loading) e.currentTarget.style.filter = 'brightness(1.1)' }}
                    onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                  >
                    {description.includes("Ensure a stable internet connection.") ? "Rules Added" : "Add default rules"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Exam Settings */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.85rem' }}>
            <div style={cardHeaderStyle}>
              <StepBadge phase="2" />
              <h3 style={cardTitleStyle}>Exam Settings</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={labelStyle}>Duration (Mins)</label>
                  <input
                    type="number"
                    className="exam-input"
                    style={inputStyle}
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(e.target.value)}
                    min="1"
                    placeholder="e.g., 60"
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={labelStyle}>Max Questions</label>
                  <input
                    type="number"
                    className="exam-input"
                    style={inputStyle}
                    value={maxQuestions}
                    onChange={e => setMaxQuestions(e.target.value)}
                    min="1"
                    placeholder="e.g., 50"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ ...nestedPanelStyle, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
                  <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>Schedule Window (Optional)</label>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', fontWeight: 600 }}>
                    Auto-saved as UTC
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input
                      type="datetime-local"
                      value={startsAtLocal}
                      onChange={(e) => setStartsAtLocal(e.target.value)}
                      className="exam-input"
                      style={dateTimeInputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Finish Time</label>
                    <input
                      type="datetime-local"
                      value={endsAtLocal}
                      onChange={(e) => setEndsAtLocal(e.target.value)}
                      className="exam-input"
                      style={dateTimeInputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.8rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.45 }}>
                  Leave both empty to allow starting any time after publish. If set, students can only start within this window.
                </div>
              </div>

              <div className="form-group">
                <label style={labelStyle}>Assessment Engine</label>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <div
                    onClick={() => setIsAdaptive(false)}
                    style={selectionCardStyle(!isAdaptive)}
                    onMouseEnter={e => { if(!isAdaptive) e.currentTarget.style.borderColor = 'rgba(217, 143, 48, 0.3)' }}
                    onMouseLeave={e => { if(!isAdaptive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                  >
                    <div style={radioIndicatorStyle(!isAdaptive)}>
                      {!isAdaptive && <div style={radioInnerStyle} />}
                    </div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.01em', marginTop: '0.2rem' }}>Linear</div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', lineHeight: 1.5, maxWidth: '200px' }}>
                      Fixed sequence for all students. Standard behavior.
                    </p>
                  </div>

                  <div
                    onClick={() => setIsAdaptive(true)}
                    style={selectionCardStyle(isAdaptive)}
                    onMouseEnter={e => { if(!isAdaptive) e.currentTarget.style.borderColor = 'rgba(217, 143, 48, 0.3)' }}
                    onMouseLeave={e => { if(!isAdaptive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                  >
                    <div style={radioIndicatorStyle(isAdaptive)}>
                      {isAdaptive && <div style={radioInnerStyle} />}
                    </div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.01em', marginTop: '0.2rem' }}>Adaptive</div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', lineHeight: 1.5, maxWidth: '200px' }}>
                      IRT-based dynamic difficulty scaling and neural logic.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Audience & Visibility (Full Width) */}
          <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.85rem', gridColumn: '1 / -1' }}>
            <div style={cardHeaderStyle}>
              <StepBadge phase="3" />
              <h3 style={cardTitleStyle}>Audience & Visibility</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label style={labelStyle}>Access mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                  {[
                    { id: 'SECTION', label: 'Single Section', desc: 'Assign to one specific group' },
                    { id: 'MULTI_SECTION', label: 'Multi-Section', desc: 'Multiple comma-separated groups' },
                    { id: 'INDIVIDUAL', label: 'Individual', desc: 'Targeting specific student IDs' }
                  ].map(opt => (
                    <div
                      key={opt.id}
                      onClick={() => setAudienceType(opt.id)}
                      style={selectionCardStyle(audienceType === opt.id)}
                      onMouseEnter={e => { if(audienceType !== opt.id) e.currentTarget.style.borderColor = 'rgba(217, 143, 48, 0.3)' }}
                      onMouseLeave={e => { if(audienceType !== opt.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                    >
                      <div style={radioIndicatorStyle(audienceType === opt.id)}>
                        {audienceType === opt.id && <div style={radioInnerStyle} />}
                      </div>
                      <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.01em', marginTop: '0.2rem' }}>{opt.label}</div>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', lineHeight: 1.5 }}>{opt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {(audienceType === 'SECTION' || audienceType === 'MULTI_SECTION') && (
                <div className="form-group fade-in">
                  <label style={labelStyle}>
                    {audienceType === 'SECTION' ? 'Section Name' : 'Section Names (e.g. 7A, 7B)'}
                  </label>
                  <input
                    type="text"
                    className="exam-input"
                    style={inputStyle}
                    value={sectionsInput}
                    onChange={e => setSectionsInput(e.target.value)}
                    placeholder={audienceType === 'SECTION' ? 'e.g. 7A' : 'e.g. 7A, 7B, 8C'}
                    required
                  />
                </div>
              )}

              {audienceType === 'INDIVIDUAL' && (
                <div className="form-group fade-in">
                  <label style={labelStyle}>Student Roll Nos (Comma separated)</label>
                  <input
                    type="text"
                    className="exam-input"
                    style={inputStyle}
                    value={studentIdsInput}
                    onChange={e => setStudentIdsInput(e.target.value)}
                    placeholder="e.g. CS101, CS102, CS105"
                    required
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CreateExam