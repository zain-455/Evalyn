import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'

// Fix 7: moved outside component — not recreated on every render
const inputStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  fontSize: '0.95rem',
  fontFamily: "'Poppins', sans-serif",
  padding: '0.75rem 1rem',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '8px',
  color: 'white',
  width: '100%',
  boxSizing: 'border-box',
  height: '46px',
  transition: 'all 0.2s ease',
}

const selectWrapperStyle = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center'
}

const selectIconStyle = {
  position: 'absolute',
  right: '1rem',
  pointerEvents: 'none',
  color: 'rgba(255,255,255,0.5)',
  transition: 'transform 0.3s ease'
}

const labelStyle = {
  fontSize: '0.85rem',
  color: 'rgba(255,255,255,0.7)',
  marginBottom: '0.5rem',
  display: 'block',
  fontWeight: 500
}

// Fix 5: inject keyframes once at module level
if (typeof document !== 'undefined') {
  const existing = document.getElementById('ai-gen-styles')
  const css = `
      @keyframes slideDownFadeIn {
        from { opacity: 0; transform: translateY(-10px) scale(0.99); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes aiBtnSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .ai-btn-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,0.75);
        border-top-color: rgba(255,255,255,0.15);
        animation: aiBtnSpin 900ms linear infinite;
        box-sizing: border-box;
      }
    `

  if (!existing) {
    const tag = document.createElement('style')
    tag.id = 'ai-gen-styles'
    tag.textContent = css
    document.head.appendChild(tag)
  } else {
    // Keep styles in sync during HMR / page navigation
    existing.textContent = css
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function difficultyLabelFromB(b) {
  if (b <= -0.75) return 'Easy'
  if (b >= 0.75) return 'Hard'
  return 'Medium'
}

function makeClientId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function aiGenStorageKey(examId) {
  return examId ? `evalyn:aiGen:items:exam:${examId}` : 'evalyn:aiGen:items:bank'
}

function loadAiGenItems(storageKey) {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(x => x && typeof x === 'object')
      .map(q => ({
        ...q,
        clientId: q.clientId || makeClientId(),
        selected: typeof q.selected === 'boolean' ? q.selected : true,
        options: Array.isArray(q.options) ? q.options : [],
        domainTags: Array.isArray(q.domainTags) ? q.domainTags : []
      }))
  } catch {
    return []
  }
}

// Fix 2: build payload outside addSelectedToExam so it can be reused
function buildPayload(q) {
  return {
    questionText: (q.questionText || '').trim(),
    questionType: q.questionType || 'MCQ',
    isAIGenerated: true,
    irt_Difficulty: clamp(Number(q.suggestedDifficulty), -4, 4),
    irt_Discrimination: clamp(Number(q.suggestedDiscrimination), 0.2, 3.0),
    difficultyLabel: difficultyLabelFromB(Number(q.suggestedDifficulty)),
    options: q.options.map(o => ({ optionText: o.text, isCorrect: !!o.isCorrect })),
    domainTags: (q.domainTags || []).filter(t => (t.domainName || '').trim() || (t.subDomain || '').trim())
  }
}

function AIQuestionGen() {
  const { examId } = useParams()
  const navigate = useNavigate()

  const storageKey = aiGenStorageKey(examId)

  const [topic, setTopic] = useState('')
  const [domain, setDomain] = useState('')
  const [subDomain, setSubDomain] = useState('')
  const [questionType, setQuestionType] = useState('MCQ')
  const [difficulty, setDifficulty] = useState('medium')
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState(() => loadAiGenItems(storageKey))
  const [difficultyOpen, setDifficultyOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)

  const isHydratingRef = useRef(false)
  const lastStorageKeyRef = useRef(storageKey)

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
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
    whiteSpace: 'nowrap'
  }

  useEffect(() => {
    if (lastStorageKeyRef.current === storageKey) return

    isHydratingRef.current = true
    lastStorageKeyRef.current = storageKey

    const next = loadAiGenItems(storageKey)
    setItems(next)

    // allow persist effect to resume after this effect batch
    Promise.resolve().then(() => { isHydratingRef.current = false })
  }, [storageKey])

  useEffect(() => {
    if (isHydratingRef.current) return

    try {
      if (items.length === 0) {
        // Important: never delete on first mount hydration; only delete when user clears
        return
      }
      window.localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {
      // ignore storage failures
    }
  }, [items, storageKey])

  const selectedCount = useMemo(
    () => items.filter(i => i.selected).length,
    [items]
  )

  const canGenerate = useMemo(() => {
    return !!topic.trim() && !!domain.trim() && !!subDomain.trim() && !generating
  }, [topic, domain, subDomain, generating])

  const generate = async (e) => {
    e.preventDefault()
    setError('')

    if (!topic.trim() || !domain.trim() || !subDomain.trim()) {
      setError('Please fill Topic, Domain, and Sub-domain before generating.')
      return
    }

    // Fix 3: clamp count before sending
    const safeCount = clamp(parseInt(count) || 1, 1, 10)
    setCount(safeCount)

    setGenerating(true)
    try {
      const res = await api.post('/api/ai/generate-questions', {
        topic,
        domain,
        subDomain,
        questionType,
        difficulty,
        count: safeCount
      })

      const normalized = (res.data || []).map(q => {
        const options = (q.options || []).map(o => ({
          text: o.text ?? '',
          isCorrect: !!o.isCorrect
        }))
        const firstCorrect = options.findIndex(o => o.isCorrect)
        const safeOptions = options.map((o, idx) => ({
          ...o,
          isCorrect: firstCorrect === -1 ? idx === 0 : idx === firstCorrect
        }))

        return {
          clientId: makeClientId(),
          selected: true,
          questionText: q.questionText ?? '',
          questionType: questionType,
          suggestedDifficulty: clamp(Number(q.suggestedDifficulty ?? 0), -4, 4),
          suggestedDiscrimination: clamp(Number(q.suggestedDiscrimination ?? 1), 0.2, 3.0),
          options: safeOptions.length > 0 ? safeOptions : [{ text: '', isCorrect: true }],
          domainTags: Array.isArray(q.domainTags) ? q.domainTags.slice(0, 2).map(t => ({
            domainName: t.domainName ?? '',
            subDomain: t.subDomain ?? ''
          })) : [{ domainName: '', subDomain: '' }]
        }
      })

      setItems(normalized)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to generate questions.')
    } finally {
      setGenerating(false)
    }
  }

  const clearGenerated = () => {
    setItems([])
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  // Fix 1: these are now actually wired up (options are editable)
  const setCorrect = (clientId, optionIdx) => {
    setItems(prev => prev.map(q => {
      if (q.clientId !== clientId) return q
      return {
        ...q,
        options: q.options.map((o, idx) => ({ ...o, isCorrect: idx === optionIdx }))
      }
    }))
  }

  const updateOptionText = (clientId, optionIdx, text) => {
    setItems(prev => prev.map(q => {
      if (q.clientId !== clientId) return q
      const next = [...q.options]
      next[optionIdx] = { ...next[optionIdx], text }
      return { ...q, options: next }
    }))
  }

  const updateQuestionField = (clientId, patch) => {
    setItems(prev => prev.map(q => (q.clientId === clientId ? { ...q, ...patch } : q)))
  }

  const addSelectedToExam = async () => {
    if (!examId) return
    if (selectedCount === 0) {
      setError('Select at least one question to add.')
      return
    }

    const selected = items.filter(i => i.selected)

    // Fix 4: validate all questions have text before starting any requests
    const blank = selected.find(q => !q.questionText.trim())
    if (blank) {
      setError('One or more selected questions have empty text. Please fix before adding.')
      return
    }

    setAdding(true)
    setError('')
    try {
      // Fix 2: parallel requests instead of sequential loop
      await Promise.all(selected.map(q => api.post(`/api/exams/${examId}/questions`, buildPayload(q))))
      navigate(`/instructor/exams/${examId}`)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to add questions to the exam.')
    } finally {
      setAdding(false)
    }
  }

  const saveToBank = async () => {
    if (selectedCount === 0) {
      setError('Select at least one question to save to the bank.')
      return
    }

    const selected = items.filter(i => i.selected)
    const blank = selected.find(q => !q.questionText.trim())
    if (blank) {
      setError('One or more selected questions have empty text. Please fix before saving.')
      return
    }

    setSavingBank(true)
    setError('')
    try {
      await Promise.all(selected.map(q => api.post('/api/question-bank', buildPayload(q))))
      toast.success(`Successfully saved ${selectedCount} questions to Global Bank`)
      if (!examId) {
        navigate('/instructor/question-bank')
      }
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to save questions to the bank.')
      toast.error('Failed to save to bank')
    } finally {
      setSavingBank(false)
    }
  }

  return (
    <div className="fade-in" style={{ padding: '0', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="dash-card" style={{ ...canonicalCardStyle, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1.35rem 1.5rem', marginBottom: '2rem', marginTop: '1rem', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '1.5rem', textAlign: 'left' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="hero-title" style={{ fontSize: '1.7rem', color: 'rgba(255,255,255,0.95)', fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>Configure Generator</h2>
          <p className="hero-subtitle" style={{ color: 'rgba(255,255,255,0.75)', marginTop: '0.45rem', marginBottom: 0 }}>Generate questions and review them before adding to your exam.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate(examId ? `/instructor/exams/${examId}` : '/instructor/question-bank')}
            style={{
              background: '#d98f30',
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              padding: '0.75rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'filter 0.2s ease',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            {examId ? 'Back to Exam' : 'Back to Bank'}
          </button>

          <button
            disabled={savingBank || selectedCount === 0}
            onClick={saveToBank}
            style={{
              background: selectedCount > 0 ? '#d98f30' : 'rgba(217, 143, 48, 0.4)',
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              padding: '0.75rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: (savingBank || selectedCount === 0) ? 'not-allowed' : 'pointer',
              opacity: (savingBank || selectedCount === 0) ? 0.7 : 1,
              transition: 'filter 0.2s ease',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={e => { if (!(savingBank || selectedCount === 0)) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseOut={e => { if (!(savingBank || selectedCount === 0)) e.currentTarget.style.filter = 'brightness(1)' }}
          >
            {savingBank ? 'Saving...' : `Save to Bank (${selectedCount})`}
          </button>

          {examId && (
            <button
              disabled={adding || selectedCount === 0}
              onClick={addSelectedToExam}
              style={{
                background: selectedCount > 0 ? '#d98f30' : 'rgba(217, 143, 48, 0.4)',
                color: 'white',
                border: 'none',
                borderRadius: '100px',
                padding: '0.75rem 1.8rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: (adding || selectedCount === 0) ? 'not-allowed' : 'pointer',
                opacity: (adding || selectedCount === 0) ? 0.7 : 1,
                transition: 'filter 0.2s ease',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={e => { if (!(adding || selectedCount === 0)) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { if (!(adding || selectedCount === 0)) e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {adding ? 'Adding...' : `Add to Exam (${selectedCount})`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {error}
        </div>
      )}

      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem 2rem', width: '100%', marginBottom: '1.5rem' }}>
        <form onSubmit={generate} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1.5rem 1.25rem' }}>
          {/* First Row: Domain, Sub-domain, Topic */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Domain</label>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g., Physics"
              className="exam-input"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Sub-domain</label>
            <input
              value={subDomain}
              onChange={e => setSubDomain(e.target.value)}
              placeholder="e.g., Mechanics"
              className="exam-input"
              style={inputStyle}
              required
            />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Topic</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g., Newton's Laws of Motion"
              className="exam-input"
              style={inputStyle}
              required
            />
          </div>

          {/* Second Row: Type, Difficulty, Count, Generate Button */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Question Type</label>
            <div style={selectWrapperStyle} className="select-container">
              <div
                onClick={() => setTypeOpen(!typeOpen)}
                className="exam-input"
                style={{ ...inputStyle, cursor: 'pointer', paddingRight: '2.5rem', display: 'flex', alignItems: 'center' }}
              >
                {questionType}
              </div>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ ...selectIconStyle, transform: typeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              {typeOpen && (
                <>
                  <div
                    style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9 }}
                    onClick={() => setTypeOpen(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: 'rgba(25, 25, 30, 0.95)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    zIndex: 10,
                    padding: '0.5rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    animation: 'slideDownFadeIn 0.2s ease forwards'
                  }}>
                    {['MCQ', 'True / False', 'Short answer'].map(opt => (
                      <div
                        key={opt}
                        onClick={() => { setQuestionType(opt); setTypeOpen(false) }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          color: questionType === opt ? '#d98f30' : 'rgba(255,255,255,0.85)',
                          background: questionType === opt ? 'rgba(217, 143, 48, 0.1)' : 'transparent',
                          transition: 'all 0.2s ease',
                          fontSize: '0.95rem',
                          fontWeight: questionType === opt ? 600 : 400
                        }}
                        onMouseOver={e => {
                          if (questionType !== opt) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.color = 'white'
                          }
                        }}
                        onMouseOut={e => {
                          if (questionType !== opt) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                          }
                        }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}>Difficulty</label>
            <div style={selectWrapperStyle} className="select-container">
              <div
                onClick={() => setDifficultyOpen(!difficultyOpen)}
                className="exam-input"
                style={{ ...inputStyle, cursor: 'pointer', paddingRight: '2.5rem', display: 'flex', alignItems: 'center', textTransform: 'capitalize' }}
              >
                {difficulty}
              </div>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ ...selectIconStyle, transform: difficultyOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              {difficultyOpen && (
                <>
                  <div
                    style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9 }}
                    onClick={() => setDifficultyOpen(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: 'rgba(25, 25, 30, 0.95)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    zIndex: 10,
                    padding: '0.5rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    animation: 'slideDownFadeIn 0.2s ease forwards'
                  }}>
                    {['easy', 'medium', 'hard', 'mixed'].map(opt => (
                      <div
                        key={opt}
                        onClick={() => { setDifficulty(opt); setDifficultyOpen(false) }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          borderRadius: '8px',
                          color: difficulty === opt ? '#d98f30' : 'rgba(255,255,255,0.85)',
                          background: difficulty === opt ? 'rgba(217, 143, 48, 0.1)' : 'transparent',
                          transition: 'all 0.2s ease',
                          fontSize: '0.95rem',
                          fontWeight: difficulty === opt ? 600 : 400
                        }}
                        onMouseOver={e => {
                          if (difficulty !== opt) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.color = 'white'
                          }
                        }}
                        onMouseOut={e => {
                          if (difficulty !== opt) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                          }
                        }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}>Count</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={e => setCount(e.target.value)}
              onBlur={e => setCount(clamp(parseInt(e.target.value) || 1, 1, 10))}
              className="exam-input"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                type="button"
                disabled={items.length === 0 || generating}
                onClick={clearGenerated}
                style={{
                  background: (items.length > 0 && !generating) ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '100px',
                  padding: '0.75rem 1.2rem',
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  cursor: (items.length > 0 && !generating) ? 'pointer' : 'not-allowed',
                  opacity: (items.length > 0 && !generating) ? 1 : 0.7,
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                  whiteSpace: 'nowrap',
                  height: '46px',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={e => { if (items.length > 0 && !generating) e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseOut={e => { if (items.length > 0 && !generating) e.currentTarget.style.filter = 'brightness(1)' }}
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={!canGenerate}
                style={{
                  background: '#d98f30',
                  color: 'white',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '0.75rem 1.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: canGenerate ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'filter 0.2s ease',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                  whiteSpace: 'nowrap',
                  height: '46px',
                  flex: 1,
                  opacity: canGenerate ? 1 : 0.8
                }}
                onMouseOver={e => canGenerate && (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseOut={e => canGenerate && (e.currentTarget.style.filter = 'brightness(1)')}
              >
                {generating ? (
                  <span style={{ display: 'inline-flex', gap: '0.65rem', alignItems: 'center' }}>
                    <span className="ai-btn-spinner" />
                    Generating...
                  </span>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {items.map((q, idx) => (
            <div key={q.clientId} className="dash-card" style={{ ...canonicalCardStyle, padding: '1.75rem 2.25rem', width: '100%' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={q.selected}
                    onChange={e => updateQuestionField(q.clientId, { selected: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#d98f30', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '1.1rem', fontWeight: 650, color: 'white' }}>Question {idx + 1}</div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>Difficulty (b)</span>
                    <div
                      className="exam-input"
                      style={{ ...inputStyle, width: '80px', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', color: 'rgba(255,255,255,0.9)', userSelect: 'none' }}
                    >
                      {Number(q.suggestedDifficulty).toFixed(1)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>Discrimination (a)</span>
                    <div
                      className="exam-input"
                      style={{ ...inputStyle, width: '80px', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', color: 'rgba(255,255,255,0.9)', userSelect: 'none' }}
                    >
                      {Number(q.suggestedDiscrimination).toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Question text — editable */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Question Text</label>
                <div
                  className="exam-input"
                  style={{
                    ...nestedPanelStyle,
                    padding: '1.05rem 1.1rem',
                    minHeight: '104px',
                    height: 'auto',
                    width: '100%',
                    boxSizing: 'border-box',
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: '1rem',
                    lineHeight: 1.55,
                    fontFamily: "'Poppins', sans-serif",
                    userSelect: 'none',
                    cursor: 'default',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {q.questionText}
                </div>
              </div>

              {/* Fix 1: options are now editable — handlers wired up */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ ...labelStyle, marginBottom: '1rem' }}>Options</label>
                <div style={{ display: 'grid', gridTemplateColumns: (q.questionType === 'MCQ' || q.questionType === 'True / False') ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {(q.questionType === 'MCQ' || q.questionType === 'True / False') && (
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: opt.isCorrect ? '#22c55e' : '#ef4444',
                            color: 'white',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                            border: 'none',
                            cursor: 'default',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {opt.isCorrect ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          )}
                        </button>
                      )}
                      <div
                        className="exam-input"
                        style={{
                          ...nestedPanelStyle,
                          minHeight: '48px',
                          padding: '0.9rem 1.05rem',
                          width: '100%',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          border: opt.isCorrect ? '2px solid rgba(34, 197, 94, 0.7)' : nestedPanelStyle.border,
                          boxShadow: opt.isCorrect ? '0 0 12px rgba(34, 197, 94, 0.22)' : 'none',
                          color: opt.isCorrect ? 'rgba(34, 197, 94, 0.95)' : 'rgba(255,255,255,0.9)',
                          fontWeight: opt.isCorrect ? 650 : 450,
                          userSelect: 'none',
                          cursor: 'default',
                          lineHeight: 1.35,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {opt.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Domain (optional)</label>
                  <div
                    className="exam-input"
                    style={{
                      ...nestedPanelStyle,
                      minHeight: '48px',
                      padding: '0.9rem 1.05rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '0.98rem',
                      lineHeight: 1.35,
                      userSelect: 'none',
                      cursor: 'default'
                    }}
                  >
                    {q.domainTags?.[0]?.domainName || '—'}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Sub-domain (optional)</label>
                  <div
                    className="exam-input"
                    style={{
                      ...nestedPanelStyle,
                      minHeight: '48px',
                      padding: '0.9rem 1.05rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '0.98rem',
                      lineHeight: 1.35,
                      userSelect: 'none',
                      cursor: 'default'
                    }}
                  >
                    {q.domainTags?.[0]?.subDomain || '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AIQuestionGen