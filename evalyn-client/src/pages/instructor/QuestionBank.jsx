import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'

const getEmptyForm = () => ({
  questionText: '',
  questionType: 'MCQ',
  irt_Difficulty: 0,
  irt_Discrimination: 1.0,
  difficultyLabel: 'Medium',
  options: [
    { optionText: '', isCorrect: true },
    { optionText: '', isCorrect: false },
    { optionText: '', isCorrect: false },
    { optionText: '', isCorrect: false }
  ],
  domainTags: [{ domainName: '', subDomain: '' }],
  isAIGenerated: false
})

const getApiErrorMessage = (err, fallback) => {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.title ||
    err?.message ||
    fallback
  )
}

function QuestionBank() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(getEmptyForm())
  const [difficultyOpen, setDifficultyOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [filterDomain, setFilterDomain] = useState('')
  const [filterSubDomain, setFilterSubDomain] = useState('')
  const [appliedDomain, setAppliedDomain] = useState('')
  const [appliedSubDomain, setAppliedSubDomain] = useState('')
  const [hasFiltered, setHasFiltered] = useState(false)

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

  const labelStyle = {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '0.5rem',
    marginLeft: '0.25rem'
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: 'white',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    height: '48px',
    fontFamily: "'Poppins', sans-serif"
  }

  const difficultyRef = useRef(null)
  const typeRef = useRef(null)
  const textareaRef = useRef(null)
  const correctAnswerTextareaRefs = useRef([])
  const navigate = useNavigate()

  const autoGrowTextarea = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    const handler = (e) => {
      if (difficultyRef.current && !difficultyRef.current.contains(e.target)) {
        setDifficultyOpen(false)
      }
      if (typeRef.current && !typeRef.current.contains(e.target)) {
        setTypeOpen(false)
      }
    }
    if (difficultyOpen || typeOpen) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [difficultyOpen, typeOpen])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [form.questionText, editingId, showAdd])

  useEffect(() => {
    if (form.questionType !== 'Short answer') return
    correctAnswerTextareaRefs.current.forEach(autoGrowTextarea)
  }, [form.questionType, form.options, editingId, showAdd])

  const bankQuestionsQuery = useQuery({
    queryKey: ['questionBank'],
    queryFn: async () => {
      const res = await api.get('/api/question-bank')
      return res.data
    }
  })

  const bankQuestions = bankQuestionsQuery.data ?? []
  const loading = bankQuestionsQuery.isLoading

  const filteredQuestions = bankQuestions.filter(q => {
    const domainMatch = !appliedDomain || (q.domainTags && q.domainTags.some(t =>
      t.domainName?.toLowerCase().includes(appliedDomain.toLowerCase())
    ));

    const subDomainMatch = !appliedSubDomain || (q.domainTags && q.domainTags.some(t =>
      t.subDomain?.toLowerCase().includes(appliedSubDomain.toLowerCase())
    ));

    return domainMatch && subDomainMatch;
  });

  const addQuestionMutation = useMutation({
    mutationFn: async (payload) => {
      await api.post('/api/question-bank', payload)
    },
    onSuccess: async () => {
      setShowAdd(false)
      setForm(getEmptyForm())
      await queryClient.invalidateQueries({ queryKey: ['questionBank'] })
      toast.success('Question added to bank')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to add question'))
    }
  })

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      await api.put(`/api/question-bank/${id}`, payload)
    },
    onSuccess: async () => {
      setEditingId(null)
      setShowAdd(false)
      setForm(getEmptyForm())
      await queryClient.invalidateQueries({ queryKey: ['questionBank'] })
      toast.success('Question updated')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to update question'))
    }
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: async (qId) => {
      await api.delete(`/api/question-bank/${qId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['questionBank'] })
      toast.success('Question deleted')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to delete question'))
    }
  })

  const saveQuestion = async (e) => {
    e.preventDefault()

    const emptyOption = form.options.some(o => !o.optionText.trim())
    if (emptyOption) {
      toast.error('All options must have text')
      return
    }

    const payload = {
      ...form,
      domainTags: form.domainTags.filter(t => t.domainName.trim() && t.subDomain.trim())
    }

    if (editingId) {
      await updateQuestionMutation.mutateAsync({ id: editingId, payload })
    } else {
      await addQuestionMutation.mutateAsync(payload)
    }
  }

  const handleDelete = async (e, qId) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to permanently delete this global question?')) return
    await deleteQuestionMutation.mutateAsync(qId)
  }

  const handleEdit = (q) => {
    setEditingId(q.id)
    setForm({
      questionText: q.questionText || '',
      questionType: q.questionType || 'MCQ',
      irt_Difficulty: q.irT_Difficulty || 0,
      irt_Discrimination: q.irT_Discrimination || 1.0,
      difficultyLabel: q.difficultyLabel || 'Medium',
      options: q.options && q.options.length > 0 ? q.options.map(o => ({ optionText: o.optionText, isCorrect: o.isCorrect })) : getEmptyForm().options,
      domainTags: q.domainTags && q.domainTags.length > 0 ? q.domainTags.map(t => ({ domainName: t.domainName, subDomain: t.subDomain })) : [{ domainName: '', subDomain: '' }],
      isAIGenerated: q.isAIGenerated || false
    })
    setShowAdd(true)
  }

  const setCorrectOption = (idx) => {
    const opts = form.options.map((o, i) => ({ ...o, isCorrect: i === idx }))
    setForm({ ...form, options: opts })
  }

  const updateOption = (idx, text) => {
    const opts = [...form.options]
    opts[idx] = { ...opts[idx], optionText: text }
    setForm({ ...form, options: opts })
  }

  const handleTypeChange = (newType) => {
    let newOptions = [];
    if (newType === 'MCQ') {
      newOptions = [
        { optionText: '', isCorrect: true },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false }
      ];
    } else if (newType === 'True / False') {
      newOptions = [
        { optionText: 'True', isCorrect: true },
        { optionText: 'False', isCorrect: false }
      ];
    } else if (newType === 'Short answer') {
      newOptions = [
        { optionText: '', isCorrect: true }
      ];
    }
    setForm({ ...form, questionType: newType, options: newOptions });
    setTypeOpen(false);
  }

  const saving = addQuestionMutation.isPending || updateQuestionMutation.isPending

  const renderQuestionForm = () => (
    <div style={{
      marginBottom: editingId ? '0rem' : '2.5rem',
      ...canonicalCardStyle,
      padding: '2rem 2.5rem',
      animation: 'slideDownFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      marginTop: editingId ? '1rem' : '0'
    }}>
      <h3 style={{
        fontWeight: 700,
        marginBottom: '1.5rem',
        fontSize: '1.25rem',
        color: 'rgba(255,255,255,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '1rem',
        letterSpacing: '0.01em'
      }}>{editingId ? 'Edit Global Question' : 'New Global Question'}</h3>

      <form onSubmit={saveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Question Text</label>
          <textarea
            className="form-textarea no-focus-outline"
            ref={textareaRef}
            value={form.questionText}
            onChange={e => setForm({ ...form, questionText: e.target.value })}
            required
            placeholder="Enter your question here..."
            style={{
              minHeight: '8.5rem',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '1.5rem 1.25rem',
              borderRadius: '12px',
              fontSize: '1.05rem',
              lineHeight: '1.5',
              fontFamily: "'Poppins', sans-serif",
              color: 'white',
              width: '100%',
              resize: 'none',
              boxSizing: 'border-box',
              display: 'block',
              overflow: 'hidden'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div className="form-group" style={{ position: 'relative' }} ref={typeRef}>
            <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block' }}>Question Type</label>
            <div
              className="form-input"
              onClick={() => setTypeOpen(!typeOpen)}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: 'white',
                width: '100%',
                boxSizing: 'border-box',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                boxShadow: typeOpen ? '0 0 0 2px rgba(255,255,255,0.1)' : 'none',
                height: '54px',
                padding: '0 1.25rem'
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '1rem', fontFamily: "'Poppins', sans-serif" }}>{form.questionType}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: typeOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>

            {typeOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                background: 'rgba(20, 20, 25, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.5rem', zIndex: 50,
                boxShadow: '0 100px 40px rgba(0,0,0,0.4)', animation: 'slideDownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                display: 'flex', flexDirection: 'column', gap: '4px'
              }}>
                {['MCQ', 'True / False', 'Short answer'].map(type => (
                  <div
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    style={{
                      padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                      background: form.questionType === type ? 'rgba(255,255,255,0.06)' : 'transparent',
                      transition: 'all 0.15s ease', color: 'white', fontWeight: 600, fontSize: '1rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = form.questionType === type ? 'rgba(255,255,255,0.06)' : 'transparent'}
                  >
                    {type}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ position: 'relative' }} ref={difficultyRef}>
            <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block' }}>Difficulty Level</label>
            <div
              className="form-input"
              onClick={() => setDifficultyOpen(!difficultyOpen)}
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: 'white',
                width: '100%',
                boxSizing: 'border-box',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                boxShadow: difficultyOpen ? '0 0 0 2px rgba(255,255,255,0.1)' : 'none',
                height: '54px',
                padding: '0 1.25rem'
              }}
            >
              <span style={{
                color: form.difficultyLabel === 'Easy' ? '#4ade80' :
                  form.difficultyLabel === 'Medium' ? '#fbbf24' :
                    form.difficultyLabel === 'Hard' ? '#ef4444' : 'white',
                fontWeight: 600,
                fontSize: '1rem',
                fontFamily: "'Poppins', sans-serif"
              }}>
                {form.difficultyLabel}
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: difficultyOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>

            {difficultyOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '0.5rem',
                zIndex: 50,
                boxShadow: '0 100px 40px rgba(0,0,0,0.4)',
                animation: 'slideDownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {[
                  { label: 'Easy', b: -1.5, color: '#4ade80' },
                  { label: 'Medium', b: 0, color: '#fbbf24' },
                  { label: 'Hard', b: 1.5, color: '#ef4444' }
                ].map(diff => (
                  <div
                    key={diff.label}
                    onClick={() => {
                      setForm({ ...form, difficultyLabel: diff.label, irt_Difficulty: diff.b })
                      setDifficultyOpen(false)
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: form.difficultyLabel === diff.label ? 'rgba(255,255,255,0.06)' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = form.difficultyLabel === diff.label ? 'rgba(255,255,255,0.06)' : 'transparent'}
                  >
                    <span style={{ color: diff.color, fontWeight: 600 }}>{diff.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Domain</label>
            <input
              className="form-input no-focus-outline"
              value={form.domainTags[0].domainName}
              onChange={e => setForm({ ...form, domainTags: [{ ...form.domainTags[0], domainName: e.target.value }] })}
              placeholder="e.g., Data Structures"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: 'white',
                width: '100%',
                boxSizing: 'border-box',
                height: '54px',
                padding: '0 1.25rem',
                fontSize: '1rem',
                fontFamily: "'Poppins', sans-serif"
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Sub-Domain</label>
            <input
              className="form-input no-focus-outline"
              value={form.domainTags[0].subDomain}
              onChange={e => setForm({ ...form, domainTags: [{ ...form.domainTags[0], subDomain: e.target.value }] })}
              placeholder="e.g., Binary Trees"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: 'white',
                width: '100%',
                boxSizing: 'border-box',
                height: '54px',
                padding: '0 1.25rem',
                fontSize: '1rem',
                fontFamily: "'Poppins', sans-serif"
              }}
            />
          </div>
        </div>

        {/* Options */}
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {form.questionType === 'MCQ' || form.questionType === 'True / False' ? 'Answer Options' : 'Correct Answer'}
            {(form.questionType === 'MCQ' || form.questionType === 'True / False') && <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>(click circle to mark correct)</span>}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {form.options.map((opt, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.85rem', alignItems: 'center',
                transition: 'all 0.2s ease'
              }}>
                {(form.questionType === 'MCQ' || form.questionType === 'True / False') && (
                  <button
                    type="button"
                    onClick={() => setCorrectOption(i)}
                    style={{
                      width: '46px', height: '46px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: opt.isCorrect ? '#22c55e' : '#ef4444',
                      color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                      margin: '0px 4px 0px 2px'
                    }}
                    onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                    onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                  >
                    {opt.isCorrect ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    )}
                  </button>
                )}
                {(form.questionType === 'MCQ' || form.questionType === 'True / False') ? (
                  <input
                    className="form-input no-focus-outline"
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: opt.isCorrect ? '#22c55e' : 'white',
                      fontWeight: opt.isCorrect ? 600 : 400,
                      boxSizing: 'border-box',
                      height: '54px',
                      padding: '0 1.25rem',
                      fontSize: '1.1rem',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                    readOnly={form.questionType === 'True / False'}
                    value={opt.optionText}
                    onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                ) : (
                  <textarea
                    className="form-textarea no-focus-outline"
                    ref={el => { correctAnswerTextareaRefs.current[i] = el }}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '0.9rem 1.25rem',
                      borderRadius: '12px',
                      color: 'white',
                      fontWeight: 400,
                      boxSizing: 'border-box',
                      minHeight: '54px',
                      resize: 'none',
                      lineHeight: '1.5',
                      fontSize: '1.1rem',
                      fontFamily: "'Poppins', sans-serif",
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word'
                    }}
                    value={opt.optionText}
                    onChange={e => updateOption(i, e.target.value)}
                    onInput={e => autoGrowTextarea(e.currentTarget)}
                    placeholder="Type the correct answer"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.25rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            onClick={() => { setShowAdd(false); setEditingId(null); setForm(getEmptyForm()); }}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '100px',
              padding: '0.75rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: '#d98f30',
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              padding: '0.75rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'filter 0.2s ease',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
            }}
            onMouseOver={e => { if (!saving) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseOut={e => { if (!saving) e.currentTarget.style.filter = 'brightness(1)' }}
          >
            {saving ? 'Saving...' : (editingId ? 'Update Question' : 'Save Question')}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', paddingBottom: '4rem', position: 'relative' }} className="fade-in">
      {/* Decorative Glows */}
      <div style={{ position: 'fixed', top: '5%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(217, 143, 48, 0.04) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>
      <div style={{ position: 'fixed', bottom: '5%', right: '-10%', width: '45vw', height: '45vw', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>

      <div className="dash-card" style={{ ...canonicalCardStyle, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1.35rem 1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '1.5rem', textAlign: 'left' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="hero-title" style={{ fontSize: '1.7rem', color: 'rgba(255,255,255,0.95)', fontWeight: 800, margin: 0, whiteSpace: 'nowrap' }}>Global Question Bank</h2>
          <p className="hero-subtitle" style={{ color: 'rgba(255,255,255,0.75)', marginTop: '0.45rem', marginBottom: 0 }}>Manage all questions available across exams.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button
            type="button"
            className="uiverse"
            onClick={() => navigate('/instructor/ai-question-gen')}
          >
            <div className="wrapper">
              <span>AI Generate</span>
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

          <button
            type="button"
            onClick={() => {
              const isAddFormOpen = showAdd && !editingId

              if (isAddFormOpen) {
                setShowAdd(false)
                setEditingId(null)
                setForm(getEmptyForm())
                return
              }

              setEditingId(null)
              setForm(getEmptyForm())
              setShowAdd(true)
            }}
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
              gap: '0.55rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
              transition: 'filter 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            <span>Add Global Question</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                opacity: 0.9,
                transform: showAdd && !editingId ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Section */}
      {!showAdd && (
        <div style={{
          padding: '1.5rem 2rem',
          marginBottom: '2.5rem',
          ...canonicalCardStyle,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: '1.5rem',
          alignItems: 'flex-end',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <label style={labelStyle}>Domain</label>
            <input
              type="text"
              placeholder="e.g., Programming"
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="exam-input"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Sub-domain</label>
            <input
              type="text"
              placeholder="e.g., React"
              value={filterSubDomain}
              onChange={(e) => setFilterSubDomain(e.target.value)}
              className="exam-input"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                setAppliedDomain(filterDomain);
                setAppliedSubDomain(filterSubDomain);
                setHasFiltered(true);
              }}
              style={{
                background: '#d98f30',
                color: 'white',
                border: 'none',
                borderRadius: '100px',
                padding: '0 1.6rem 2px 1.6rem',
                height: '42px',
                fontSize: '0.9rem',
                fontWeight: 700,
                marginBottom: '3px',
                cursor: 'pointer',
                transition: 'filter 0.2s ease',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}
              onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z" />
              </svg>
              Filter
            </button>

            {hasFiltered && (
              <button
                onClick={() => {
                  setFilterDomain('');
                  setFilterSubDomain('');
                  setAppliedDomain('');
                  setAppliedSubDomain('');
                  setHasFiltered(false);
                }}
                style={{
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '100px',
                  padding: '2px 1.6rem 4px 1.6rem',
                  height: '42px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  marginBottom: '3px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {showAdd && !editingId && renderQuestionForm()}

      {/* Question List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#a0a0a5' }}>Loading bank questions...</div>
        ) : filteredQuestions.length === 0 ? (
          <div style={{
            ...canonicalCardStyle,
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            padding: '3rem 2rem',
            textAlign: 'center',
            color: '#a0a0a5'
          }}>
            {hasFiltered ? "No results" : "No global questions found. Provide some options above to get started."}
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <div
              key={q.id}
              style={{
                ...canonicalCardStyle,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 900,
                    fontSize: '1.1rem',
                    letterSpacing: '0.05em',
                    fontFamily: "'Poppins', sans-serif"
                  }}>
                    #{q.id}
                  </span>
                  <span style={{
                    color: q.difficultyLabel === 'Easy' ? '#4ade80' :
                      q.difficultyLabel === 'Medium' ? '#fbbf24' : '#ef4444',
                    fontSize: '1rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: "'Poppins', sans-serif"
                  }}>
                    {q.difficultyLabel}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                  <span
                    title={q.isCalibrated ? 'Calibrated: IRT parameters updated using real student responses.' : 'Not calibrated yet: needs enough student responses, then calibration runs.'}
                    style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: q.isCalibrated ? 'rgba(16, 185, 129, 0.95)' : 'rgba(255,255,255,0.6)',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    {q.isCalibrated ? 'Calibrated' : 'Not calibrated'}
                  </span>
                  {q.domainTags && q.domainTags.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      color: 'rgba(255,255,255,0.5)', fontSize: '1rem', fontWeight: 500,
                      fontFamily: "'Poppins', sans-serif"
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                      <span>{q.domainTags[0].domainName}</span>
                      {q.domainTags[0].subDomain && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                          <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{q.domainTags[0].subDomain}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => handleEdit(q)}
                    style={{
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
                    }}
                    onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, q.id)}
                    style={{
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
                    }}
                    onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{
                fontSize: '1.05rem',
                color: '#ffffff',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                padding: '1.25rem',
                ...nestedPanelStyle,
                margin: '0.75rem 0 1.25rem 0',
                fontFamily: "'Poppins', sans-serif"
              }}>
                {q.questionText}
              </div>

              {/* Display Options in Card */}
              {editingId !== q.id && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0rem' }}>
                  {q.options && q.options.map((opt, i) => (
                    <div key={opt.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.85rem',
                    }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                        background: opt.isCorrect ? '#22c55e' : '#ef4444',
                        color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.4)'
                      }}>
                        {opt.isCorrect ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        )}
                      </div>
                      <div style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.15)',
                        borderRadius: '12px',
                        border: `1px solid ${opt.isCorrect ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                        transition: 'all 0.2s ease',
                        height: '56px',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden'
                      }}>
                        <input
                          readOnly
                          value={opt.optionText}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: opt.isCorrect ? '#22c55e' : 'rgba(255,255,255,0.85)',
                            fontSize: '1.05rem',
                            fontWeight: opt.isCorrect ? 700 : 400,
                            fontFamily: "'Poppins', sans-serif",
                            width: '100%',
                            padding: '0 1.25rem',
                            outline: 'none',
                            cursor: 'default'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editingId === q.id && renderQuestionForm()}

            </div>
          ))
        )}
      </div>

    </div>
  )
}

export default QuestionBank
