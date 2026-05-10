import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { ExamStatuses } from '../../constants/appConstants'

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
  domainTags: [{ domainName: '', subDomain: '' }]
})

const getApiErrorMessage = (err, fallback) => {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.title ||
    err?.message ||
    fallback
  )
}

// Moved to module level — no re-injection on every render
const globalStyles = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  @keyframes slideDownFadeIn {
    from { opacity: 0; transform: translateY(-18px) scale(0.99); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .no-focus-outline:focus {
    border-color: rgba(255, 255, 255, 0.3) !important;
    box-shadow: none !important;
  }

  /* Difficulty sliders */
  input[type='range'].pool-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: transparent;
    border-radius: 999px;
    outline: none;
    cursor: pointer;
  }
  input[type='range'].pool-range:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  input[type='range'].pool-range::-webkit-slider-runnable-track {
    height: 6px;
    background: rgba(217, 143, 48, 0.55);
    border-radius: 999px;
    transition: filter 160ms ease, background 160ms ease;
  }

  input[type='range'].pool-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #d98f30;
    border: 3px solid rgba(0,0,0,0.35);
    margin-top: -5px;
    box-shadow: 0 4px 14px rgba(217, 143, 48, 0.22);
    transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
  }

  input[type='range'].pool-range:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px rgba(217, 143, 48, 0.18), 0 6px 18px rgba(217, 143, 48, 0.22);
  }

  input[type='range'].pool-range:active::-webkit-slider-thumb {
    transform: scale(1.12);
    box-shadow: 0 0 0 4px rgba(217, 143, 48, 0.18), 0 10px 26px rgba(217, 143, 48, 0.25);
  }

  input[type='range'].pool-range::-moz-range-track {
    height: 6px;
    background: rgba(217, 143, 48, 0.55);
    border-radius: 999px;
    transition: filter 160ms ease, background 160ms ease;
  }
  input[type='range'].pool-range::-moz-range-progress {
    height: 6px;
    background: rgba(217, 143, 48, 0.55);
    border-radius: 999px;
    transition: filter 160ms ease, background 160ms ease;
  }
  input[type='range'].pool-range::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #d98f30;
    border: 3px solid rgba(0,0,0,0.35);
    box-shadow: 0 4px 14px rgba(217, 143, 48, 0.22);
    transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
  }

  input[type='range'].pool-range:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 4px rgba(217, 143, 48, 0.18), 0 6px 18px rgba(217, 143, 48, 0.22);
  }

  input[type='range'].pool-range:active::-moz-range-thumb {
    transform: scale(1.12);
    box-shadow: 0 0 0 4px rgba(217, 143, 48, 0.18), 0 10px 26px rgba(217, 143, 48, 0.25);
  }

`

// Inject once at module load
if (typeof document !== 'undefined') {
  const existing = document.getElementById('exam-builder-styles')
  if (!existing) {
    const tag = document.createElement('style')
    tag.id = 'exam-builder-styles'
    tag.textContent = globalStyles
    document.head.appendChild(tag)
  }
}

function ExamBuilder() {
  const DEFAULT_MIN_DIFFICULTY = -4
  const DEFAULT_MAX_DIFFICULTY = 4
  const DIFFICULTY_UI_MIN = 1
  const DIFFICULTY_UI_MAX = 10
  const DIFFICULTY_WINDOW_THETA = 3.0
  const { examId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const primaryButtonBaseStyle = {
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

  const getPrimaryButtonStyle = (enabled = true) => {
    if (enabled) return primaryButtonBaseStyle
    return {
      ...primaryButtonBaseStyle,
      cursor: 'not-allowed',
      opacity: 0.5
    }
  }

  const poolCardStyle = {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '1.5rem',
    boxSizing: 'border-box',
    boxShadow: 'none'
  }

  const poolCardSectionTitleStyle = {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: 700,
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  }

  const poolCardHelperTextStyle = {
    color: '#a0a0a5',
    fontSize: '0.82rem',
    lineHeight: 1.35
  }

  const poolCardInputStyle = {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '0 1rem',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.92)',
    width: '100%',
    boxSizing: 'border-box',
    height: '42px',
    fontSize: '0.9rem',
    fontWeight: 400,
    outline: 'none'
  }
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(getEmptyForm())
  const [difficultyOpen, setDifficultyOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const difficultyRef = useRef(null)
  const typeRef = useRef(null)
  const textareaRef = useRef(null)
  const correctAnswerTextareaRefs = useRef([])

  const autoGrowTextarea = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const [bankModalVisible, setBankModalVisible] = useState(false)
  const [bankModalActive, setBankModalActive] = useState(false)
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState([])

  const [bankFilterDomain, setBankFilterDomain] = useState('')
  const [bankFilterSubDomain, setBankFilterSubDomain] = useState('')
  const [bankAppliedDomain, setBankAppliedDomain] = useState('')
  const [bankAppliedSubDomain, setBankAppliedSubDomain] = useState('')
  const [bankHasFiltered, setBankHasFiltered] = useState(false)

  const [poolSettings, setPoolSettings] = useState({
    allowAIGenerated: true,
    requireCalibrated: false,
    minDifficulty: -4,
    maxDifficulty: 4,
    allowedTags: []
  })

  const [poolConstraintsLocked, setPoolConstraintsLocked] = useState(false)

  const [minDifficultyInput, setMinDifficultyInput] = useState('')
  const [maxDifficultyInput, setMaxDifficultyInput] = useState('')

  const [difficultyUi, setDifficultyUi] = useState(5)
  const [difficultyTouched, setDifficultyTouched] = useState(false)
  const [difficultyBalanced, setDifficultyBalanced] = useState(false)

  const clampTheta = (value) => Math.max(DEFAULT_MIN_DIFFICULTY, Math.min(DEFAULT_MAX_DIFFICULTY, value))
  const clampUi = (value) => Math.max(DIFFICULTY_UI_MIN, Math.min(DIFFICULTY_UI_MAX, value))

  const thetaToUi = (thetaValue) => {
    const t = clampTheta(Number(thetaValue))
    const ratio = (t - DEFAULT_MIN_DIFFICULTY) / (DEFAULT_MAX_DIFFICULTY - DEFAULT_MIN_DIFFICULTY)
    const ui = DIFFICULTY_UI_MIN + ratio * (DIFFICULTY_UI_MAX - DIFFICULTY_UI_MIN)
    return clampUi(Math.round(ui))
  }

  const uiToThetaBand = (uiValue) => {
    const u = clampUi(Number(uiValue))
    const ratio = (u - DIFFICULTY_UI_MIN) / (DIFFICULTY_UI_MAX - DIFFICULTY_UI_MIN)
    const availableSpan = (DEFAULT_MAX_DIFFICULTY - DEFAULT_MIN_DIFFICULTY) - DIFFICULTY_WINDOW_THETA
    const min = DEFAULT_MIN_DIFFICULTY + ratio * availableSpan
    const max = min + DIFFICULTY_WINDOW_THETA
    return {
      min: Number(clampTheta(min).toFixed(2)),
      max: Number(clampTheta(max).toFixed(2))
    }
  }

  const uiWord = (uiValue) => {
    const v = Number(uiValue)
    if (v <= 3) return 'Easy'
    if (v >= 8) return 'Hard'
    return 'Balanced'
  }

  // Fix 1: Close difficulty dropdown on outside click
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
    if (!bankModalVisible) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeBankModal()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [bankModalVisible])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [form.questionText, showAdd])

  useEffect(() => {
    if (form.questionType !== 'Short answer') return
    correctAnswerTextareaRefs.current.forEach(autoGrowTextarea)
  }, [form.questionType, form.options, showAdd])

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    enabled: !!examId,
    queryFn: async () => {
      const res = await api.get(`/api/exams/${examId}`)
      return res.data
    }
  })

  const questionsQuery = useQuery({
    queryKey: ['examQuestions', examId],
    enabled: !!examId,
    queryFn: async () => {
      const res = await api.get(`/api/exams/${examId}/questions`)
      return res.data
    }
  })

  const poolQuery = useQuery({
    queryKey: ['examPool', examId],
    enabled: !!examId,
    queryFn: async () => {
      const res = await api.get(`/api/exams/${examId}/pool`)
      return res.data
    }
  })

  const attachedBankQuery = useQuery({
    queryKey: ['examPoolAttached', examId],
    enabled: !!examId,
    queryFn: async () => {
      const res = await api.get(`/api/exams/${examId}/pool/attached`)
      return res.data
    }
  })

  const bankQuestionsQuery = useQuery({
    queryKey: ['questionBank'],
    queryFn: async () => {
      const res = await api.get('/api/question-bank')
      return res.data
    }
  })

  const addQuestionMutation = useMutation({
    mutationFn: async (payload) => {
      await api.post(`/api/exams/${examId}/questions`, payload)
    },
    onSuccess: async () => {
      setShowAdd(false)
      setForm(getEmptyForm())
      await queryClient.invalidateQueries({ queryKey: ['examQuestions', examId] })
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to add question'))
    }
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/api/exams/${examId}/publish`)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['exam', examId] }),
        queryClient.invalidateQueries({ queryKey: ['examQuestions', examId] }),
        queryClient.invalidateQueries({ queryKey: ['examPool', examId] })
      ])
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to publish'))
    }
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: async (qId) => {
      await api.delete(`/api/exams/${examId}/questions/${qId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['examQuestions', examId] })
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to delete question'))
    }
  })

  const updatePoolSettingsMutation = useMutation({
    mutationFn: async (payload) => {
      await api.put(`/api/exams/${examId}/pool`, payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['examPool', examId] }),
        queryClient.invalidateQueries({ queryKey: ['examPoolQuestions', examId] })
      ])
      setPoolConstraintsLocked(true)
      toast.success('Pool settings saved')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to save pool settings'))
    }
  })

  const attachBankQuestionMutation = useMutation({
    mutationFn: async (questionIds) => {
      const ids = Array.isArray(questionIds) ? questionIds : []
      if (ids.length === 0) return
      await api.post(`/api/exams/${examId}/pool/attach`, { questionIds: ids })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['examPool', examId] }),
        queryClient.invalidateQueries({ queryKey: ['examPoolAttached', examId] }),
        queryClient.invalidateQueries({ queryKey: ['exam', examId] })
      ])
      toast.success('Questions attached to pool')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to attach question'))
    }
  })

  const detachBankQuestionMutation = useMutation({
    mutationFn: async (questionId) => {
      await api.delete(`/api/exams/${examId}/pool/attach/${questionId}`)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['examPool', examId] }),
        queryClient.invalidateQueries({ queryKey: ['examPoolAttached', examId] }),
        queryClient.invalidateQueries({ queryKey: ['exam', examId] })
      ])
      toast.success('Question detached')
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to detach question'))
    }
  })

  const exam = examQuery.data
  const questions = questionsQuery.data ?? []
  const pool = poolQuery.data
  const effectivePoolCount = pool?.effectivePoolCount ?? questions.length
  const attachedBankQuestions = attachedBankQuery.data ?? []
  const bankQuestions = bankQuestionsQuery.data ?? []
  const loading = examQuery.isLoading || questionsQuery.isLoading
  const publishing = publishMutation.isPending
  const saving = addQuestionMutation.isPending

  const canEditExam = exam?.status === ExamStatuses.Draft
  const canEditPool = exam?.status === ExamStatuses.Draft
  const canEditConstraints = canEditPool && !poolConstraintsLocked && !updatePoolSettingsMutation.isPending

  const fixedFormQuestionCount = new Set(
    [...questions, ...attachedBankQuestions]
      .map(q => q?.id)
      .filter(id => Number.isFinite(Number(id)))
      .map(id => Number(id))
  ).size

  const maxQuestions = exam?.maxQuestions || 10
  const publishEligibleCount = exam?.isAdaptive ? effectivePoolCount : fixedFormQuestionCount
  const canPublish = exam?.isAdaptive
    ? publishEligibleCount >= maxQuestions
    : publishEligibleCount === maxQuestions

  const publishHint = (() => {
    if (publishing) return ''
    if (publishEligibleCount < maxQuestions) return `Needs ${maxQuestions - publishEligibleCount} more`

    if (exam?.isAdaptive) return 'Ready'

    if (publishEligibleCount > maxQuestions) return `Remove ${publishEligibleCount - maxQuestions}`
    return 'Ready'
  })()
  const attachedBankIds = new Set((attachedBankQuestions || []).map(q => q?.id))

  useEffect(() => {
    if (!exam?.status) return
    if (exam.status !== ExamStatuses.Draft) setShowAdd(false)
  }, [exam?.status])

  const filteredBankQuestions = bankQuestions.filter(q => {
    const domainMatch = !bankAppliedDomain || (q.domainTags && q.domainTags.some(t =>
      t.domainName?.toLowerCase().includes(bankAppliedDomain.toLowerCase())
    ))

    const subDomainMatch = !bankAppliedSubDomain || (q.domainTags && q.domainTags.some(t =>
      t.subDomain?.toLowerCase().includes(bankAppliedSubDomain.toLowerCase())
    ))

    return domainMatch && subDomainMatch
  })

  const selectableFilteredBankQuestionIds = filteredBankQuestions
    .filter(q => !attachedBankIds.has(q?.id))
    .map(q => Number(q?.id))
    .filter(n => Number.isFinite(n))
  const selectableFilteredIdSet = new Set(selectableFilteredBankQuestionIds)
  const allSelectableFilteredSelected = selectableFilteredBankQuestionIds.length > 0 &&
    selectableFilteredBankQuestionIds.every(id => selectedBankQuestionIds.includes(id))
  
  const toggleBankQuestion = (questionId) => {
    setSelectedBankQuestionIds(prev => {
      const id = Number(questionId)
      if (!Number.isFinite(id)) return prev
      if (prev.includes(id)) return prev.filter(x => x !== id)
      return [...prev, id]
    })
  }
  
  const closeBankModal = () => {
    if (attachBankQuestionMutation.isPending) return
    setBankModalActive(false)
    window.setTimeout(() => {
      setBankModalVisible(false)
      setSelectedBankQuestionIds([])
    }, 170)
  }
  
  const openBankModal = () => {
    if (!canEditPool || attachBankQuestionMutation.isPending || bankQuestions.length === 0) return
    setSelectedBankQuestionIds([])
    setBankModalVisible(true)
    window.requestAnimationFrame(() => setBankModalActive(true))
  }

  useEffect(() => {
    if (!pool) return
    setPoolSettings({
      allowAIGenerated: pool.allowAIGenerated,
      requireCalibrated: pool.requireCalibrated,
      minDifficulty: pool.minDifficulty,
      maxDifficulty: pool.maxDifficulty,
      allowedTags: pool.allowedTags ?? []
    })

    setMinDifficultyInput(pool.minDifficulty === DEFAULT_MIN_DIFFICULTY ? '' : String(pool.minDifficulty))
    setMaxDifficultyInput(pool.maxDifficulty === DEFAULT_MAX_DIFFICULTY ? '' : String(pool.maxDifficulty))

    // Represent current constraint as a single 1–10 position (by center).
    const centerTheta = ((pool.minDifficulty ?? DEFAULT_MIN_DIFFICULTY) + (pool.maxDifficulty ?? DEFAULT_MAX_DIFFICULTY)) / 2
    setDifficultyUi(thetaToUi(centerTheta))
    setDifficultyTouched(false)
    setDifficultyBalanced(false)
  }, [pool])

  const addQuestion = async (e) => {
    e.preventDefault()

    // Fix 7: Validate options aren't just whitespace
    const emptyOption = form.options.some(o => !o.optionText.trim())
    if (emptyOption) {
      toast.error('All options must have text')
      return
    }

    // Filter out empty domain tags — backend requires MinimumLength on both fields
    const payload = {
      ...form,
      domainTags: form.domainTags.filter(t => t.domainName.trim() && t.subDomain.trim())
    }

    await addQuestionMutation.mutateAsync(payload)
  }
  
  const getDifficultyBadge = (q) => {
    const label = (q?.difficultyLabel || '').trim()
    if (label) return label
    const raw = q?.irt_Difficulty
    if (typeof raw === 'number') {
      if (raw >= 1) return 'Hard'
      if (raw <= -1) return 'Easy'
      return 'Medium'
    }
    return ''
  }

  const getDifficultyColor = (difficultyLabel) => {
    const label = (difficultyLabel || '').trim().toLowerCase()
    if (label === 'hard') return 'rgba(239, 68, 68, 0.95)'
    if (label === 'medium') return 'rgba(251, 191, 36, 0.95)'
    if (label === 'easy') return 'rgba(16, 185, 129, 0.95)'
    return 'rgba(255,255,255,0.7)'
  }

  const publishExam = async () => {
    await publishMutation.mutateAsync()
  }

  const deleteQuestion = async (qId) => {
    if (!confirm('Delete this question?')) return
    await deleteQuestionMutation.mutateAsync(qId)
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

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#cba072', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    </div>
  )
  if (examQuery.isError) return <div className="empty-state"><h3>Exam not found</h3></div>
  if (!exam) return <div className="empty-state"><h3>Exam not found</h3></div>

  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

      {bankModalVisible && createPortal(
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeBankModal()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            padding: '2rem',
            opacity: bankModalActive ? 1 : 0,
            transition: 'opacity 160ms ease'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '1100px',
              background: '#333335',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '1.75rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.15rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Select Questions From Bank
                </div>
                <div style={{ marginTop: '0.35rem', color: '#a0a0a5', fontSize: '0.9rem', lineHeight: 1.4 }}>
                  Pick one or more questions to attach to this exam pool.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', rowGap: '0.85rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '2px', paddingTop: '0.5rem', flexShrink: 0, position: 'relative', zIndex: 2 }}>
                <input
                  type="text"
                  placeholder="Domain"
                  value={bankFilterDomain}
                  onChange={(e) => setBankFilterDomain(e.target.value)}
                  style={{
                    width: '210px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    height: '44px',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                />

                <input
                  type="text"
                  placeholder="Sub-domain"
                  value={bankFilterSubDomain}
                  onChange={(e) => setBankFilterSubDomain(e.target.value)}
                  style={{
                    width: '210px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    height: '44px',
                    fontFamily: "'Poppins', sans-serif"
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    const nextDomain = (bankFilterDomain || '').trim()
                    const nextSubDomain = (bankFilterSubDomain || '').trim()
                    setBankAppliedDomain(nextDomain)
                    setBankAppliedSubDomain(nextSubDomain)
                    setBankHasFiltered(!!(nextDomain || nextSubDomain))
                  }}
                  style={{
                    background: '#d98f30',
                    color: 'white',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '0 1.5rem 2px 1.5rem',
                    height: '44px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'filter 0.2s ease',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem'
                  }}
                  onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/>
                  </svg>
                  Filter
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.75rem', flex: 1, overflowY: 'auto' }}>
              {bankQuestions.length === 0 ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', background: 'rgba(0,0,0,0.15)' }}>
                  No questions available in the bank.
                </div>
              ) : filteredBankQuestions.length === 0 ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', background: 'rgba(0,0,0,0.15)' }}>
                  No results for the current filter.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredBankQuestions.map((q) => {
                    const id = q?.id
                    const isAttached = attachedBankIds.has(id)
                    const isSelected = selectedBankQuestionIds.includes(Number(id))
                    const difficulty = getDifficultyBadge(q)
                    const difficultyColor = getDifficultyColor(difficulty)
                    const questionTypeLabel = (q?.questionType || '').trim()
                    const firstTag = Array.isArray(q?.domainTags)
                      ? q.domainTags.find(t => ((t?.domainName || '').trim() || (t?.subDomain || '').trim()))
                      : null
                    const domainLabel = (firstTag?.domainName || '').trim()
                    const subDomainLabel = (firstTag?.subDomain || '').trim()
                    const domainSubdomainText = (domainLabel && subDomainLabel)
                      ? `${domainLabel} / ${subDomainLabel}`
                      : (domainLabel || subDomainLabel)

                    return (
                      <div
                        key={id}
                        onClick={() => {
                          if (!canEditPool || attachBankQuestionMutation.isPending || isAttached) return
                          toggleBankQuestion(id)
                        }}
                        style={{
                          display: 'flex',
                          padding: '1.15rem 1.15rem',
                          borderRadius: '12px',
                          border: isSelected ? '1px solid rgba(217, 143, 48, 0.55)' : '1px solid rgba(255,255,255,0.10)',
                          background: isSelected ? 'rgba(217, 143, 48, 0.14)' : 'rgba(255,255,255,0.03)',
                          backdropFilter: 'blur(14px) saturate(1.05)',
                          WebkitBackdropFilter: 'blur(14px) saturate(1.05)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                          cursor: (!canEditPool || attachBankQuestionMutation.isPending || isAttached) ? 'not-allowed' : 'pointer',
                          opacity: isAttached ? 0.55 : 1,
                          transition: 'background 0.15s ease, border-color 0.15s ease'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.95rem' }}>#{id}</div>
                              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.18)' }} />
                              {difficulty && (
                                <div style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.02em', color: difficultyColor }}>
                                  {difficulty}
                                </div>
                              )}
                              {difficulty && questionTypeLabel && (
                                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.14)' }} />
                              )}
                              {questionTypeLabel && (
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'rgba(255,255,255,0.65)' }}>
                                  {questionTypeLabel}
                                </div>
                              )}
                              {(difficulty || questionTypeLabel) && (
                                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.14)' }} />
                              )}
                              <div
                                title={q?.isCalibrated ? 'Calibrated: IRT parameters updated using real student responses.' : 'Not calibrated yet: needs enough student responses, then calibration runs.'}
                                style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 800,
                                  letterSpacing: '0.03em',
                                  textTransform: 'uppercase',
                                  color: q?.isCalibrated ? 'rgba(16, 185, 129, 0.95)' : 'rgba(255,255,255,0.6)'
                                }}
                              >
                                {q?.isCalibrated ? 'Calibrated' : 'Not calibrated'}
                              </div>
                              {isAttached && (
                                <>
                                  <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.14)' }} />
                                  <div style={{ fontSize: '0.85rem', fontWeight: 900, letterSpacing: '0.02em', color: 'rgba(16, 185, 129, 0.95)' }}>
                                    Attached
                                  </div>
                                </>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                              {domainSubdomainText && (
                                <div
                                  title={domainSubdomainText}
                                  style={{
                                    maxWidth: '320px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: 'rgba(255,255,255,0.55)',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.01em'
                                  }}
                                >
                                  {domainSubdomainText}
                                </div>
                              )}
                              <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.14)' }} />
                              <div style={{ width: '22px', height: '22px', borderRadius: '7px', border: `2px solid ${isSelected ? '#d98f30' : 'rgba(255,255,255,0.18)'}`, background: isSelected ? '#d98f30' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '0.65rem', marginBottom: '0.75rem' }} />

                          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {q?.questionText}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(14px) saturate(1.05)', WebkitBackdropFilter: 'blur(14px) saturate(1.05)', boxShadow: '0 -10px 28px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                  Selected : <span style={{ color: '#ffffff', fontWeight: 900 }}>{selectedBankQuestionIds.length}</span>
                </div>

                {bankHasFiltered && (
                  <>
                    <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.14)' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setBankFilterDomain('')
                        setBankFilterSubDomain('')
                        setBankAppliedDomain('')
                        setBankAppliedSubDomain('')
                        setBankHasFiltered(false)
                      }}
                      style={{
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '100px',
                        padding: '0 1.35rem',
                        height: '44px',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      Clear Filter
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={closeBankModal}
                  disabled={attachBankQuestionMutation.isPending}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '100px',
                    padding: '0.75rem 1.6rem',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: attachBankQuestionMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: attachBankQuestionMutation.isPending ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!canEditPool || attachBankQuestionMutation.isPending || selectableFilteredBankQuestionIds.length === 0}
                  onClick={() => {
                    if (!canEditPool || attachBankQuestionMutation.isPending) return
                    if (allSelectableFilteredSelected) {
                      setSelectedBankQuestionIds(prev => prev.filter(id => !selectableFilteredIdSet.has(id)))
                      return
                    }

                    const unique = Array.from(new Set(selectableFilteredBankQuestionIds))
                    if (unique.length === 0) return
                    setSelectedBankQuestionIds(unique)
                  }}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '100px',
                    padding: '0.75rem 1.6rem',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: (!canEditPool || attachBankQuestionMutation.isPending) ? 'not-allowed' : 'pointer',
                    opacity: (!canEditPool || attachBankQuestionMutation.isPending) ? 0.6 : 1,
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={e => { if (canEditPool && !attachBankQuestionMutation.isPending) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {allSelectableFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  disabled={!canEditPool || attachBankQuestionMutation.isPending || selectedBankQuestionIds.length === 0}
                  onClick={async () => {
                    if (!canEditPool || attachBankQuestionMutation.isPending || selectedBankQuestionIds.length === 0) return
                    await attachBankQuestionMutation.mutateAsync(selectedBankQuestionIds)
                    setBankModalActive(false)
                    window.setTimeout(() => {
                      setBankModalVisible(false)
                      setSelectedBankQuestionIds([])
                    }, 170)
                  }}
                  style={getPrimaryButtonStyle(canEditPool && !attachBankQuestionMutation.isPending && selectedBankQuestionIds.length > 0)}
                  onMouseOver={e => {
                    if (canEditPool && !attachBankQuestionMutation.isPending && selectedBankQuestionIds.length > 0) e.currentTarget.style.filter = 'brightness(1.1)'
                  }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  {attachBankQuestionMutation.isPending ? 'Selecting…' : 'Select'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            lineHeight: 1.3,
            color: '#0a0a0f',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            marginBottom: '0.4rem',
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}>{exam.title}</h1>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.95rem', color: '#0a0a0f', fontWeight: 500, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            <span>{exam.isAdaptive ? 'Adaptive Engine' : 'Fixed Engine'}</span>
            <span style={{ color: 'rgba(0, 0, 0, 0.3)' }}>|</span>
            <span style={{
              color: exam.status === ExamStatuses.Draft ? '#b55810'
                : exam.status === ExamStatuses.Published ? '#22c55e'
                  : '#0a0a0f',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              {exam.status === ExamStatuses.Draft ? 'Under Review' : exam.status}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => { if (canEditExam) setShowAdd(!showAdd) }}
            disabled={!canEditExam}
            style={{
              background: canEditExam ? '#d98f30' : 'rgba(217, 143, 48, 0.4)',
              color: canEditExam ? 'white' : 'rgba(255, 255, 255, 0.6)',
              border: 'none',
              borderRadius: '100px',
              padding: '0.75rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: canEditExam ? 'pointer' : 'not-allowed',
              transition: 'filter 0.2s ease',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem'
            }}
            onMouseOver={e => { if (canEditExam) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseOut={e => { if (canEditExam) e.currentTarget.style.filter = 'brightness(1)' }}
          >
            <span>Add Question</span>
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
                opacity: canEditExam ? 0.9 : 0.7,
                transform: showAdd ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {exam.status === ExamStatuses.Draft && (
            <button
              onClick={publishExam}
              disabled={publishing || !canPublish}
              style={{
                position: 'relative',
                background: canPublish ? '#d98f30' : 'rgba(217, 143, 48, 0.4)',
                border: 'none',
                borderRadius: '100px',
                padding: '0.75rem 1.8rem',
                color: canPublish ? 'white' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: canPublish ? 'pointer' : 'not-allowed',
                transition: 'filter 0.2s ease',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                overflow: 'hidden'
              }}
              onMouseOver={e => { if (canPublish) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { if (canPublish) e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {publishing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  animation: 'shimmer 1.5s infinite'
                }} />
              )}
              {publishing ? 'Publishing...' : (
                <>
                  <span>Publish</span>
                  <span style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <span>{publishEligibleCount}/{maxQuestions}</span>
                    <span style={{ opacity: 0.55 }}>|</span>
                    <span>{publishHint}</span>
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Add Question Form */}
      <div
        aria-hidden={!showAdd}
        style={{
          marginBottom: showAdd ? '2.5rem' : 0,
          maxHeight: showAdd ? '2200px' : 0,
          overflow: 'hidden',
          opacity: showAdd ? 1 : 0,
          transform: showAdd ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.99)',
          pointerEvents: showAdd ? 'auto' : 'none',
          willChange: 'max-height, opacity, transform',
          transition: 'max-height 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease, transform 360ms cubic-bezier(0.16, 1, 0.3, 1), margin-bottom 360ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div style={{
          background: '#333335',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '2.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <h3 style={{
            fontWeight: 700,
            marginBottom: '1.5rem',
            fontSize: '1.25rem',
            color: 'rgba(255,255,255,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '1rem',
            letterSpacing: '0.01em'
          }}>New Question Configuration</h3>

          <form onSubmit={addQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              {/* Question Type Dropdown */}
              <div className="form-group" style={{ position: 'relative' }} ref={typeRef}>
                <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block' }}>Question Type</label>
                <div
                  className="form-input"
                  onClick={() => setTypeOpen(!typeOpen)}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0 1.25rem',
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
                    height: '54px'
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
              {/* Fix 1: difficulty dropdown with outside-click close via ref */}
              <div className="form-group" style={{ position: 'relative' }} ref={difficultyRef}>
                <label className="form-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block' }}>Difficulty Level</label>
                <div
                  className="form-input"
                  onClick={() => setDifficultyOpen(!difficultyOpen)}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0 1.25rem',
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
                    height: '54px'
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
                          transition: 'all 0.15s ease',
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: '1rem'
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
                    { (form.questionType === 'MCQ' || form.questionType === 'True / False') ? (
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
                onClick={() => setShowAdd(false)}
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
                {saving ? 'Saving...' : 'Save Question'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Question Pool & Constraints */}
      <div style={{
        background: '#333335',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '2.5rem',
        marginTop: '1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {exam?.isAdaptive ? 'QUESTION POOL & CONSTRAINTS' : 'QUESTION POOL'}
          </h3>

          <div style={{ marginLeft: 'auto', color: '#a0a0a5', fontSize: '0.98rem', display: 'flex', gap: '1.25rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <span>
              {exam?.isAdaptive ? 'Eligible questions' : 'Available questions'} : <span style={{ color: '#ffffff', fontWeight: 800 }}>{publishEligibleCount}</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span>Exam questions : <span style={{ color: '#ffffff', fontWeight: 800 }}>{questions.length}</span></span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span>Attached bank questions : <span style={{ color: '#ffffff', fontWeight: 800 }}>{pool?.attachedBankQuestionCount ?? attachedBankQuestions.length}</span></span>
          </div>
        </div>

        {/* REDESIGNED: Attach Questions Header & List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* Top Row: Attach Controls and Header */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '1.5rem',
            alignItems: 'stretch', 
            background: 'rgba(0,0,0,0.15)',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', minWidth: 0 }}>
                <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                  Attach Questions
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    disabled={!canEditPool || attachBankQuestionMutation.isPending || bankQuestions.length === 0}
                    onClick={openBankModal}
                    style={getPrimaryButtonStyle(canEditPool && !attachBankQuestionMutation.isPending && bankQuestions.length > 0)}
                    onMouseOver={e => {
                      if (canEditPool && !attachBankQuestionMutation.isPending && bankQuestions.length > 0) e.currentTarget.style.filter = 'brightness(1.1)'
                    }}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Select
                  </button>
                </div>
              </div>

              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', whiteSpace: 'nowrap', textAlign: 'right' }}>
                Attached Question List
              </div>
            </div>
          </div>

          {/* List of Attached Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {attachedBankQuestions.length === 0 ? (
              <div style={{ 
                padding: '3rem', 
                textAlign: 'center', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '12px', 
                border: '1px dashed rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.95rem'
              }}>
                No questions attached from the bank yet.
              </div>
            ) : (
              attachedBankQuestions.map(q => (
                <div key={q.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem 2rem',
                  gap: '1.5rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <div style={{ minWidth: '160px', color: '#ffffff', fontWeight: 700, fontSize: '1.05rem' }}>
                    Question ID #{q.id}
                  </div>

                  <div style={{
                    width: '1px',
                    alignSelf: 'stretch',
                    background: 'rgba(255,255,255,0.12)',
                    margin: '0 0.5rem'
                  }} />
                  
                  <div style={{ 
                    flex: 1, 
                    color: 'rgba(255,255,255,0.85)', 
                    fontSize: '1rem', 
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {q.questionText}
                  </div>

                  <div style={{
                    width: '1px',
                    alignSelf: 'stretch',
                    background: 'rgba(255,255,255,0.12)',
                    margin: '0 0.5rem'
                  }} />

                  <button
                    type="button"
                    disabled={!canEditPool || detachBankQuestionMutation.isPending}
                    onClick={() => detachBankQuestionMutation.mutateAsync(q.id)}
                    style={getPrimaryButtonStyle(canEditPool && !detachBankQuestionMutation.isPending)}
                    onMouseOver={e => {
                      if (canEditPool && !detachBankQuestionMutation.isPending) e.currentTarget.style.filter = 'brightness(1.1)'
                    }}
                    onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {exam?.isAdaptive && (
        <>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '2.5rem 0 1.5rem 0' }}></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(280px, 1.1fr) minmax(250px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

          {/* Column 1: Constraints */}
          <div style={poolCardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Constraints</div>
              <div style={poolCardHelperTextStyle}>Control what types of questions can enter the pool.</div>
            </div>

            <div style={poolCardSectionTitleStyle}>Question Sources</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', cursor: canEditConstraints ? 'pointer' : 'default' }}>
                <div
                  onClick={() => canEditConstraints && setPoolSettings(ps => ({ ...ps, allowAIGenerated: !ps.allowAIGenerated }))}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: `2px solid ${poolSettings.allowAIGenerated ? '#d98f30' : 'rgba(255,255,255,0.18)'}`,
                    background: poolSettings.allowAIGenerated ? '#d98f30' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    cursor: canEditConstraints ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  {poolSettings.allowAIGenerated && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.2 }}>Allow AI-generated questions</span>
                  <span style={poolCardHelperTextStyle}>Include AI-generated items in the pool.</span>
                </div>
              </label>

              <label style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', cursor: canEditConstraints ? 'pointer' : 'default' }}>
                <div
                  onClick={() => canEditConstraints && setPoolSettings(ps => ({ ...ps, requireCalibrated: !ps.requireCalibrated }))}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: `2px solid ${poolSettings.requireCalibrated ? '#d98f30' : 'rgba(255,255,255,0.18)'}`,
                    background: poolSettings.requireCalibrated ? '#d98f30' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    cursor: canEditConstraints ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  {poolSettings.requireCalibrated && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.2 }}>Require calibrated questions only</span>
                  <span style={poolCardHelperTextStyle}>Filter the pool to calibrated items only.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Column 2: Difficulty */}
          <div style={poolCardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Difficulty</div>
              <div style={poolCardHelperTextStyle}>Restrict the pool by how easy or hard questions should be.</div>
            </div>

            <div style={poolCardSectionTitleStyle}>Difficulty Range</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', justifySelf: 'start' }}>Easier</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 800, justifySelf: 'center', textAlign: 'center' }}>
                  {uiWord(difficultyUi)}
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}> ({difficultyUi}/{DIFFICULTY_UI_MAX})</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', justifySelf: 'end' }}>Harder</div>
              </div>

              <div style={{
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.12)',
                borderRadius: '12px',
                paddingLeft: '0.95rem',
                paddingRight: '0.95rem',
                paddingTop: '0.85rem',
                paddingBottom: '1.2rem'
              }}>
                <input
                  type="range"
                  min={DIFFICULTY_UI_MIN}
                  max={DIFFICULTY_UI_MAX}
                  step="1"
                  disabled={!canEditConstraints || difficultyBalanced}
                  className="pool-range"
                  value={difficultyUi}
                  onChange={(e) => {
                    const next = clampUi(Number(e.target.value))
                    setDifficultyUi(next)
                    setDifficultyTouched(true)
                    setDifficultyBalanced(false)

                    const band = uiToThetaBand(next)
                    setMinDifficultyInput(band.min === DEFAULT_MIN_DIFFICULTY ? '' : String(band.min))
                    setMaxDifficultyInput(band.max === DEFAULT_MAX_DIFFICULTY ? '' : String(band.max))
                  }}
                  aria-label="Difficulty"
                />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.78rem',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '1rem',
                gap: '0.75rem'
              }}>
                {(() => {
                  if (difficultyBalanced) return <span>Full range (Balanced mix)</span>

                  const band = difficultyTouched
                    ? uiToThetaBand(difficultyUi)
                    : {
                        min: Number(poolSettings.minDifficulty ?? DEFAULT_MIN_DIFFICULTY),
                        max: Number(poolSettings.maxDifficulty ?? DEFAULT_MAX_DIFFICULTY)
                      }

                  const fmt = (v) => {
                    const n = Number(v)
                    if (!Number.isFinite(n)) return ''
                    return n.toFixed(2).replace(/\.00$/, '')
                  }

                  return <span>Band : ( {fmt(band.min)} to {fmt(band.max)} )</span>
                })()}

                <button
                  type="button"
                  disabled={!canEditConstraints}
                  onClick={() => {
                    if (!canEditConstraints) return
                    setDifficultyBalanced(prev => {
                      const next = !prev
                      if (next) {
                        setDifficultyTouched(false)
                        setMinDifficultyInput('')
                        setMaxDifficultyInput('')
                        setDifficultyUi(5)
                      } else {
                        const band = uiToThetaBand(difficultyUi)
                        setDifficultyTouched(true)
                        setMinDifficultyInput(band.min === DEFAULT_MIN_DIFFICULTY ? '' : String(band.min))
                        setMaxDifficultyInput(band.max === DEFAULT_MAX_DIFFICULTY ? '' : String(band.max))
                      }
                      return next
                    })
                  }}
                  style={getPrimaryButtonStyle(canEditConstraints)}
                  onMouseOver={e => { if (canEditConstraints) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  Balance
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Tagging */}
          <div style={{ ...poolCardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Tagging</div>
              <div style={poolCardHelperTextStyle}>Require specific tags to be present in the pool.</div>
            </div>

            <div>
              <div style={{ ...poolCardSectionTitleStyle, marginBottom: '0.35rem' }}>Required Tag</div>
              <div style={{ ...poolCardHelperTextStyle, marginBottom: '0.75rem' }}>Add a specific domain tag to require:</div>
              <input
                type="text"
                placeholder="Add tags"
                disabled={!canEditConstraints}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    e.preventDefault();
                    const newTag = { domainName: e.target.value.trim(), subDomain: '' };
                    setPoolSettings(ps => ({ ...ps, allowedTags: [...(ps.allowedTags || []), newTag] }));
                    e.target.value = '';
                  }
                }}
                style={poolCardInputStyle}
              />
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem', flex: 1 }}>
              <div style={poolCardSectionTitleStyle}>Tags in Use</div>
              <div style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '0.5rem',
                padding: '0.85rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.12)',
                height: '56px',
                alignItems: 'center',
                overflowX: 'auto',
                overflowY: 'hidden'
              }}>
                {(poolSettings.allowedTags || []).length === 0 ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', ...poolCardHelperTextStyle, fontSize: '0.85rem' }}>
                    No tags specified
                  </div>
                ) : (
                  (poolSettings.allowedTags || []).map((t, i) => (
                    <div key={i} style={{
                      background: 'rgba(217, 143, 48, 0.14)',
                      border: '1px solid rgba(217, 143, 48, 0.35)',
                      borderRadius: '100px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.92)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexShrink: 0
                    }}>
                      {t.domainName} {t.subDomain && `- ${t.subDomain}`}
                      <span
                        onClick={() => {
                          if (canEditConstraints) setPoolSettings(ps => ({ ...ps, allowedTags: ps.allowedTags.filter((_, idx) => idx !== i) }))
                        }}
                        style={{
                          cursor: canEditConstraints ? 'pointer' : 'default',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '1rem',
                          lineHeight: '1',
                          opacity: canEditConstraints ? 1 : 0.5
                        }}
                      >×</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Separator and Bottom Bar */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.75rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#a0a0a5', fontSize: '1.05rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Max Question Count:</span>
              <span style={{ color: '#ffffff', fontWeight: 900 }}>{exam?.maxQuestions || 10}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.15)' }}>|</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Min Time:</span>
              <span style={{ color: '#ffffff', fontWeight: 900 }}>
                {typeof exam?.durationMinutes === 'number' && Number.isFinite(exam.durationMinutes)
                  ? `${exam.durationMinutes} mins`
                  : 'N/A'}
              </span>
            </div>
          </div>
          
          <button
            type="button"
            disabled={!canEditPool || updatePoolSettingsMutation.isPending}
            onClick={() => {
              if (!canEditPool || updatePoolSettingsMutation.isPending) return

              if (poolConstraintsLocked) {
                setPoolConstraintsLocked(false)
                return
              }

              const clamp = (value) => Math.max(DEFAULT_MIN_DIFFICULTY, Math.min(DEFAULT_MAX_DIFFICULTY, value))
              const parseOrDefault = (raw, fallback) => {
                if (raw == null) return fallback
                const trimmed = String(raw).trim()
                if (!trimmed) return fallback
                const n = Number(trimmed)
                return Number.isFinite(n) ? n : fallback
              }

              const minDifficulty = clamp(parseOrDefault(minDifficultyInput, DEFAULT_MIN_DIFFICULTY))
              const maxDifficulty = clamp(parseOrDefault(maxDifficultyInput, DEFAULT_MAX_DIFFICULTY))

              const payload = {
                allowAIGenerated: !!poolSettings.allowAIGenerated,
                requireCalibrated: !!poolSettings.requireCalibrated,
                minDifficulty,
                maxDifficulty,
                allowedTags: (poolSettings.allowedTags || []).filter(t => (t.domainName || '').trim())
              }
              updatePoolSettingsMutation.mutateAsync(payload)
            }}
            style={getPrimaryButtonStyle(canEditPool && !updatePoolSettingsMutation.isPending)}
            onMouseOver={e => { if (canEditPool && !updatePoolSettingsMutation.isPending) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
          >
            {updatePoolSettingsMutation.isPending
              ? 'Saving…'
              : (poolConstraintsLocked ? 'Edit Saved Constraints' : 'Save Constraints')}
          </button>
        </div>

        </>
        )}
      </div>

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
              onClick={() => navigate(`/instructor/exams/${examId}/ai`)}
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
            {questions.map((q, i) => (
              <div key={q.id} style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s',
                position: 'relative'
              }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <button
                  onClick={() => deleteQuestion(q.id)}
                  aria-label="Delete question"
                  style={{ position: 'absolute', top: '1.05rem', right: '1.05rem', background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.75)', cursor: 'pointer', fontSize: '1.35rem', lineHeight: 1, padding: '0.25rem 0.35rem' }}
                  onMouseOver={e => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.95)'}
                  onMouseOut={e => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.75)'}
                >×</button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.1rem', lineHeight: 1.1 }}>
                  <span style={{ 
                    color: 'rgba(255,255,255,0.2)', 
                    fontWeight: 900, 
                    fontSize: '0.85rem', 
                    letterSpacing: '0.05em',
                    fontFamily: "'Poppins', sans-serif",
                    lineHeight: 1
                  }}>
                    #{q.id}
                  </span>
                  <span style={{
                    color: q.difficultyLabel === 'Easy' ? '#4ade80' :
                      q.difficultyLabel === 'Medium' ? '#fbbf24' : '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: "'Poppins', sans-serif",
                    lineHeight: 1
                  }}>
                    {q.difficultyLabel}
                  </span>
                  {q.domainTags && q.domainTags.length > 0 && (
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: 500,
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
                  paddingTop: '1rem',
                  fontSize: '0.95rem',
                  color: 'rgba(255, 255, 255, 0.85)',
                  lineHeight: '1.6',
                  marginBottom: '1.75rem',
                  flexGrow: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
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
                          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                          background: o.isCorrect ? '#22c55e' : '#ef4444',
                          color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          {o.isCorrect ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          )}
                        </div>
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          border: `1px solid ${o.isCorrect ? 'rgba(74, 222, 128, 0.22)' : 'rgba(255, 255, 255, 0.08)'}`,
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 0.85rem',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            color: o.isCorrect ? '#4ade80' : 'rgba(255, 255, 255, 0.65)',
                            fontSize: '0.8rem',
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamBuilder