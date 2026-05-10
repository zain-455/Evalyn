import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { ExamBuilderContext } from '../../components/ExamBuilder/ExamBuilderContext'
import QuestionSelectionModal from '../../components/ExamBuilder/QuestionSelectionModal'
import DeleteConfirmationModal from '../../components/ExamBuilder/DeleteConfirmationModal'
import ExamSettingsPanel from '../../components/ExamBuilder/ExamSettingsPanel'
import SelectedQuestionList from '../../components/ExamBuilder/SelectedQuestionList'
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

  /* Difficulty sliders (Enhanced) */
  @keyframes thumbPulse {
    0% { box-shadow: 0 0 0 0 rgba(217, 143, 48, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(217, 143, 48, 0); }
    100% { box-shadow: 0 0 0 0 rgba(217, 143, 48, 0); }
  }

  input[type='range'].pool-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    outline: none;
    cursor: pointer;
  }

  input[type='range'].pool-range:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Track filling via linear-gradient and CSS variable */
  input[type='range'].pool-range::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: linear-gradient(to right, #d98f30 var(--p, 0%), rgba(255, 255, 255, 0.05) var(--p, 0%));
    border-radius: 10px;
  }

  input[type='range'].pool-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #d98f30;
    cursor: pointer;
    margin-top: -5px;
    transition: all 0.2s ease;
    box-shadow: 0 0 10px rgba(217, 143, 48, 0.4);
  }

  input[type='range'].pool-range:not(:disabled):hover::-webkit-slider-thumb {
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(217, 143, 48, 0.6);
    animation: thumbPulse 1.5s infinite;
  }

  input[type='range'].pool-range:active::-webkit-slider-thumb {
    transform: scale(1.3);
    box-shadow: 0 0 20px rgba(217, 143, 48, 0.8) !important;
  }

  /* Firefox support */
  input[type='range'].pool-range::-moz-range-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }
  input[type='range'].pool-range::-moz-range-progress {
    height: 4px;
    background: #d98f30;
    border-radius: 10px;
  }
  input[type='range'].pool-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #d98f30;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    box-shadow: 0 0 10px rgba(217, 143, 48, 0.4);
  }
  input[type='range'].pool-range:not(:disabled):hover::-moz-range-thumb {
    transform: scale(1.2);
    box-shadow: 0 0 15px rgba(217, 143, 48, 0.6);
    animation: thumbPulse 1.5s infinite;
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

const ChecklistItem = ({ met, text }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'flex-start', 
    gap: '1rem',
    color: met ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
    transition: 'all 0.3s ease',
    textDecoration: met ? 'line-through' : 'none',
    fontFamily: "'Poppins', sans-serif"
  }}>
    <div style={{
      marginTop: '0.15rem',
      flexShrink: 0,
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      border: `2.5px solid ${met ? 'rgba(255,255,255,0.2)' : 'rgba(217, 143, 48, 0.9)'}`,
      background: met ? 'rgba(255,255,255,0.1)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {met && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
    </div>
    <span style={{ 
        fontSize: '0.98rem', 
        lineHeight: 1.5, 
        fontWeight: met ? 400 : 500,
        color: met ? 'rgba(255,255,255,0.4)' : '#a0a0a5'
      }}>
      {text}
    </span>
  </div>
)

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
  const autoGrowTextarea = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(getEmptyForm())
  const [difficultyOpen, setDifficultyOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const difficultyRef = useRef(null)
  const typeRef = useRef(null)
  const textareaRef = useRef(null)
  const correctAnswerTextareaRefs = useRef([])
  const [bankHasFiltered, setBankHasFiltered] = useState(false)
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(() => {
    return localStorage.getItem('evalyn_skip_delete_confirm') === 'true'
  })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState(null)

  const [bankModalVisible, setBankModalVisible] = useState(false)
  const [bankModalActive, setBankModalActive] = useState(false)
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState([])

  const [bankFilterDomain, setBankFilterDomain] = useState('')
  const [bankFilterSubDomain, setBankFilterSubDomain] = useState('')
  const [bankAppliedDomain, setBankAppliedDomain] = useState('')
  const [bankAppliedSubDomain, setBankAppliedSubDomain] = useState('')

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

  const parseIsoDate = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  const formatLocalDateTime = (iso) => {
    const d = parseIsoDate(iso)
    if (!d) return null
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  }

  const scheduleStartText = formatLocalDateTime(exam?.startsAtUtc)
  const scheduleEndText = formatLocalDateTime(exam?.endsAtUtc)
  const showScheduleWindow = Boolean(scheduleStartText || scheduleEndText)

  const fixedFormQuestionCount = new Set(
    [...questions, ...attachedBankQuestions]
      .map(q => q?.id)
      .filter(id => Number.isFinite(Number(id)))
      .map(id => Number(id))
  ).size

  const maxQuestions = exam?.maxQuestions || 10
  const publishEligibleCount = exam?.isAdaptive ? effectivePoolCount : fixedFormQuestionCount

  // Publishing Rules Logic
  const rule1Met = publishEligibleCount > 0
  const rule2Met = !exam?.isAdaptive ? publishEligibleCount === maxQuestions : true // Applicable only to linear
  const rule3Met = exam?.isAdaptive ? publishEligibleCount >= (maxQuestions * 3) : true // Applicable only to adaptive
  const rule4Met = exam?.isAdaptive ? poolConstraintsLocked : true

  const allRulesMet = rule1Met && rule2Met && rule3Met && rule4Met
  const canPublish = allRulesMet

  const publishHint = (() => {
    if (publishing) return ''
    if (exam?.isAdaptive) {
        if (!rule3Met) return `Needs at least ${(maxQuestions * 3) - publishEligibleCount} more`
        return 'Ready'
    } else {
        if (publishEligibleCount < maxQuestions) return `Needs ${maxQuestions - publishEligibleCount} more`
        if (publishEligibleCount > maxQuestions) return `Remove ${publishEligibleCount - maxQuestions}`
        return 'Ready'
    }
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
    if (skipDeleteConfirmation) {
      await deleteQuestionMutation.mutateAsync(qId)
    } else {
      setDeleteTargetId(qId)
      setDeleteConfirmOpen(true)
    }
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


  const contextValue = {
    getPrimaryButtonStyle, autoGrowTextarea, clampTheta, clampUi, thetaToUi, uiToThetaBand, uiWord, 
    addQuestion, getDifficultyBadge, getDifficultyColor, publishExam, deleteQuestion, 
    setCorrectOption, updateOption, handleTypeChange, closeBankModal, openBankModal, toggleBankQuestion, 
    getEmptyForm, getApiErrorMessage, DEFAULT_MIN_DIFFICULTY, DEFAULT_MAX_DIFFICULTY, 
    DIFFICULTY_UI_MIN, DIFFICULTY_UI_MAX, DIFFICULTY_WINDOW_THETA, navigate, queryClient, 
    primaryButtonBaseStyle, poolCardStyle, poolCardSectionTitleStyle, poolCardHelperTextStyle, poolCardInputStyle, 
    showAdd, setShowAdd, form, setForm, difficultyOpen, setDifficultyOpen, typeOpen, setTypeOpen, 
    difficultyRef, typeRef, textareaRef, correctAnswerTextareaRefs, bankModalVisible, setBankModalVisible, 
    bankModalActive, setBankModalActive, selectedBankQuestionIds, setSelectedBankQuestionIds, 
    bankFilterDomain, setBankFilterDomain, bankFilterSubDomain, setBankFilterSubDomain, 
    bankAppliedDomain, setBankAppliedDomain, bankAppliedSubDomain, setBankAppliedSubDomain, 
    bankHasFiltered, setBankHasFiltered, poolSettings, setPoolSettings, poolConstraintsLocked, 
    setPoolConstraintsLocked, minDifficultyInput, setMinDifficultyInput, maxDifficultyInput, 
    setMaxDifficultyInput, difficultyUi, setDifficultyUi, difficultyTouched, setDifficultyTouched, 
    difficultyBalanced, setDifficultyBalanced, examQuery, questionsQuery, poolQuery, 
    attachedBankQuery, bankQuestionsQuery, addQuestionMutation, publishMutation, 
    deleteQuestionMutation, updatePoolSettingsMutation, attachBankQuestionMutation, 
    detachBankQuestionMutation, exam, questions, pool, effectivePoolCount, attachedBankQuestions, 
    bankQuestions, loading, publishing, saving, canEditExam, canEditPool, canEditConstraints, 
    fixedFormQuestionCount, maxQuestions, publishEligibleCount, canPublish, publishHint, 
    attachedBankIds, filteredBankQuestions, selectableFilteredBankQuestionIds, 
    selectableFilteredIdSet, allSelectableFilteredSelected, examId,
    skipDeleteConfirmation, setSkipDeleteConfirmation, deleteConfirmOpen, setDeleteConfirmOpen,
    deleteTargetId, setDeleteTargetId
  };

  return (
    <ExamBuilderContext.Provider value={contextValue}>
      <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <QuestionSelectionModal />
        <DeleteConfirmationModal />
        
        {publishConfirmOpen && createPortal(
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
              if (e.target === e.currentTarget && !publishing) {
                setPublishConfirmOpen(false)
              }
            }}
          >
            <div
              className="examlist-modal-card"
              style={{
                background: '#333335',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                width: '100%',
                maxWidth: '560px',
                padding: '1.5rem 1.6rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 750, color: 'white', marginBottom: '0.35rem' }}>
                    Publish exam?
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
                    This will make <span style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 650 }}>{exam.title}</span> live for students. You won't be able to edit pool settings or add/delete questions once published.
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '1.15rem 0 1.25rem' }} />

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => setPublishConfirmOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '100px',
                    padding: '0.7rem 1.4rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: publishing ? 'not-allowed' : 'pointer',
                    opacity: publishing ? 0.7 : 1,
                    transition: 'filter 0.2s ease',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => { if (!publishing) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={(e) => { if (!publishing) e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={publishing}
                  onClick={async () => {
                    await publishExam()
                    setPublishConfirmOpen(false)
                  }}
                  style={{
                    background: '#d98f30',
                    color: 'white',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '0.7rem 1.4rem',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: publishing ? 'not-allowed' : 'pointer',
                    opacity: publishing ? 0.8 : 1,
                    transition: 'filter 0.2s ease',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => { if (!publishing) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseOut={(e) => { if (!publishing) e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        

      {/* HEADER SECTION */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        background: '#333335',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '1.35rem 1.6rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            lineHeight: 1.3,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            marginBottom: '0.4rem',
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}>{exam.title}</h1>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.92rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            <span>{exam.isAdaptive ? 'Adaptive Engine' : 'Fixed Engine'}</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
            <span style={{
              color: exam.status === ExamStatuses.Draft ? '#fbbf24'
                : exam.status === ExamStatuses.Published ? '#22c55e'
                  : 'white',
              fontWeight: 650,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              {exam.status === ExamStatuses.Draft ? (
                allRulesMet ? (
                  <span style={{ color: '#fbbf24' }}>READY TO PUBLISH</span>
                ) : 'UNDER REVIEW'
              ) : exam.status}
            </span>
          </div>

          {showScheduleWindow && (
            <div style={{
              marginTop: '0.35rem',
              display: 'flex',
              gap: '0.45rem',
              alignItems: 'center',
              fontSize: '0.92rem',
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 500,
              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>
              <span>Schedule</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>:</span>
              {scheduleStartText && <span>{scheduleStartText}</span>}
              {scheduleStartText && scheduleEndText && (
                <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>To :</span>
              )}
              {!scheduleStartText && scheduleEndText && (
                <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>To :</span>
              )}
              {scheduleEndText && <span>{scheduleEndText}</span>}
            </div>
          )}
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
              onClick={() => setPublishConfirmOpen(true)}
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
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {/* Publishing Checklist Card */}
      {exam.status === ExamStatuses.Draft && (
        exam?.isAdaptive ? (
          /* ADAPTIVE CHECKLIST - 3 ITEMS (Roomy bottom) */
          <div style={{
            background: '#333335',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '2.25rem 2.5rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{
              fontWeight: 700,
              fontSize: '1.25rem',
              color: 'rgba(255,255,255,0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: '1.15rem',
              marginBottom: '2rem',
              fontFamily: "'Poppins', sans-serif"
            }}>Publishing Checklist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <ChecklistItem met={rule1Met} text="Add questions from the Global Question Bank, through AI, or manually create them." />
              <ChecklistItem met={rule3Met} text={`For adaptive engines, add at least 300% (${maxQuestions * 3}) of the required questions for optimal calibration.`} />
              <ChecklistItem met={rule4Met} text="Set difficulty constraints in the settings panel and save them (Domain tags are optional)." />
            </div>
          </div>
        ) : (
          /* LINEAR CHECKLIST - 2 ITEMS (Balanced bottom) */
          <div style={{
            background: '#333335',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '2.25rem 2.5rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{
              fontWeight: 700,
              fontSize: '1.25rem',
              color: 'rgba(255,255,255,0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: '1.15rem',
              marginBottom: '2rem',
              fontFamily: "'Poppins', sans-serif"
            }}>Publishing Checklist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <ChecklistItem met={rule1Met} text="Add questions from the Global Question Bank, through AI, or manually create them." />
              <ChecklistItem met={rule2Met} text={`For linear engines, ensure the active question count exactly matches the required amount (${maxQuestions}).`} />
            </div>
          </div>
        )
      )}

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

      
        <ExamSettingsPanel />
        <SelectedQuestionList />
      </div>
    </ExamBuilderContext.Provider>
  )
}

export default ExamBuilder;
