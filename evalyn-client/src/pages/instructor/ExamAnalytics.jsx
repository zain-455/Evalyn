import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area, ComposedChart } from 'recharts'
import api from '../../services/api'

// Fix 4: moved outside component — not recreated on every render
function generateICCPoint(theta, difficulty, discrimination) {
  return 1 / (1 + Math.exp(-discrimination * (theta - difficulty)))
}

// Fix 1: merge all ICC curves into one dataset so Recharts can render them
// Returns [{theta: '-4.0', q1: 0.02, q2: 0.11, ...}, ...]
function buildMergedICCData(questions) {
  const thetas = []
  for (let t = -4; t <= 4; t += 0.5) thetas.push(parseFloat(t.toFixed(1)))

  return thetas.map(theta => {
    const point = { theta }
    questions.forEach((q, i) => {
      point[`q${i + 1}`] = generateICCPoint(theta, q.irt_Difficulty ?? 0, q.irt_Discrimination ?? 1)
    })
    return point
  })
}

const ICC_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

function formatDateLabel(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function toDayKey(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function ExamAnalytics() {
  const { examId } = useParams()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refreshInFlightRef = useRef(false)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true

    if (!silent)
    {
      setLoading(true)
      setError('')
    }

    try {
      const res = await api.get(`/api/analytics/exam/${examId}`)
      setAnalytics(res.data)
      if (!silent) setError('')
    } catch (err) {
      console.error(err)
      if (!silent) setError('Failed to load analytics data.')
    } finally {
      refreshInFlightRef.current = false
      if (!silent) setLoading(false)
    }
  }, [examId])

  useEffect(() => { loadData({ silent: false }) }, [loadData])

  // Auto-refresh: keep the report live while open (silent refresh, no spinner flashes)
  useEffect(() => {
    const intervalMs = 15000
    const timer = setInterval(() => {
      if (document?.hidden) return
      loadData({ silent: true })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [loadData])

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>
  if (error) return <div className="empty-state"><h3>{error}</h3></div>
  if (!analytics) return <div className="empty-state"><h3>Exam analytics not found</h3></div>

  const examTitle = analytics.title ?? 'Exam'
  const itemAnalysis = Array.isArray(analytics.itemAnalysis) ? analytics.itemAnalysis : []
  const totalQuestions = typeof analytics.totalQuestions === 'number' ? analytics.totalQuestions : itemAnalysis.length
  const studentResults = Array.isArray(analytics.studentResults) ? analytics.studentResults : []
  const reliability = analytics.reliability && typeof analytics.reliability === 'object' ? analytics.reliability : {}
  const cohortSummary = analytics.cohortSummary && typeof analytics.cohortSummary === 'object' ? analytics.cohortSummary : {}
  const integrityHistogram = Array.isArray(analytics.integrityHistogram) ? analytics.integrityHistogram : []

  // Option A: response-based visuals only use administered items (TotalAnswered > 0)
  const administeredItems = itemAnalysis.filter(q => (q.totalAnswered ?? 0) > 0)
  const responseBasedItems = administeredItems
  const administeredCount = administeredItems.length
  const hasResponseData = administeredCount > 0
  const tifData = (Array.isArray(analytics.testInformationFunction) ? analytics.testInformationFunction : [])
    .map(p => ({
      ...p,
      theta: typeof p?.theta === 'number' ? p.theta : Number(p?.theta)
    }))
    .filter(p => Number.isFinite(p.theta))
    .sort((a, b) => a.theta - b.theta)

  const tifCurve = tifData.map(p => ({
    ...p,
    sem: (typeof p.information === 'number' && p.information > 0) ? (1 / Math.sqrt(p.information)) : null
  }))

  const itemStats = responseBasedItems.map((q, i) => ({
    name: `Q${i + 1}`,
    difficulty: q.irt_Difficulty ?? 0,
    discrimination: q.irt_Discrimination ?? 1,
    label: q.difficultyLabel
  }))

  const difficultyMin = itemStats.length ? Math.min(...itemStats.map(d => Number(d.difficulty) || 0)) : -4
  const difficultyMax = itemStats.length ? Math.max(...itemStats.map(d => Number(d.difficulty) || 0)) : 4
  const discriminationMax = itemStats.length ? Math.max(...itemStats.map(d => Number(d.discrimination) || 0)) : 2
  const difficultyDomainMin = Math.max(-4, Math.floor((difficultyMin - 0.25) * 2) / 2)
  const difficultyDomainMax = Math.min(4, Math.ceil((difficultyMax + 0.25) * 2) / 2)
  const discriminationDomainMax = Math.max(1, Math.ceil((discriminationMax + 0.15) * 10) / 10)

  const visibleQuestions = responseBasedItems.slice(0, 8)
  const iccData = buildMergedICCData(visibleQuestions)

  const avgDifficulty = itemAnalysis.length > 0
    ? (itemAnalysis.reduce((s, q) => s + (q.irt_Difficulty ?? 0), 0) / itemAnalysis.length).toFixed(2)
    : '—'

  const avgDiscrimination = itemAnalysis.length > 0
    ? (itemAnalysis.reduce((s, q) => s + (q.irt_Discrimination ?? 1), 0) / itemAnalysis.length).toFixed(2)
    : '—'

  const calibratedCount = itemAnalysis.filter(q => q.isCalibrated).length

  const peakInfo = tifData.length > 0
    ? tifData.reduce((max, p) => (typeof p.information === 'number' && p.information > (max?.information ?? -Infinity) ? p : max), null)?.information
    : null

  const trendDataMap = new Map()
  studentResults
    .filter(r => r.completedAt)
    .forEach(r => {
      const key = toDayKey(r.completedAt)
      if (!key) return
      const entry = trendDataMap.get(key) ?? { dayKey: key, dateLabel: '', count: 0, sumTheta: 0, sumIntegrity: 0 }
      entry.count += 1
      if (typeof r.thetaEstimate === 'number') entry.sumTheta += r.thetaEstimate
      if (typeof r.integrityScore === 'number') entry.sumIntegrity += r.integrityScore
      trendDataMap.set(key, entry)
    })

  const trendData = Array.from(trendDataMap.values())
    .map(d => ({
      dayKey: d.dayKey,
      dateLabel: formatDateLabel(d.dayKey),
      sessions: d.count,
      avgTheta: d.count > 0 ? d.sumTheta / d.count : 0,
      avgIntegrity: d.count > 0 ? d.sumIntegrity / d.count : 0
    }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))

  const integrityHistData = integrityHistogram
    .map(bin => {
      const count = typeof bin?.count === 'number' ? bin.count : 0
      const flaggedCount = typeof bin?.flaggedCount === 'number' ? bin.flaggedCount : 0
      const binStart = typeof bin?.binStart === 'number' ? bin.binStart : 0
      const binEnd = typeof bin?.binEnd === 'number' ? bin.binEnd : binStart + 10
      return {
        binStart,
        binEnd,
        label: `${binStart}-${binEnd}`,
        flaggedCount,
        nonFlaggedCount: Math.max(0, count - flaggedCount),
        count
      }
    })
    .filter(x => Number.isFinite(x.binStart) && Number.isFinite(x.binEnd))

  const integrityTotalCount = integrityHistData.reduce((sum, b) => sum + (typeof b.count === 'number' ? b.count : 0), 0)

  const thetaBinSize = 0.5
  const thetaBinCount = Math.round(8 / thetaBinSize)
  const thetaCounts = new Array(thetaBinCount).fill(0)
  studentResults
    .filter(r => typeof r.thetaEstimate === 'number')
    .forEach(r => {
      const theta = Math.max(-4, Math.min(4, r.thetaEstimate))
      const idx = Math.min(thetaBinCount - 1, Math.max(0, Math.floor((theta + 4) / thetaBinSize)))
      thetaCounts[idx] += 1
    })

  const thetaHistData = thetaCounts.map((count, idx) => {
    const start = -4 + (idx * thetaBinSize)
    const end = start + thetaBinSize
    return {
      label: `${start.toFixed(1)}–${end.toFixed(1)}`,
      count
    }
  })

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

  return (
    <div className="fade-in exam-analytics-page">
      {/* Item Statistics Overview */}
      <div className="stats-grid exam-analytics-stats-grid">
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Total Questions</div>
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{totalQuestions}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Administered Items</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>{administeredCount}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Avg Difficulty (b)</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{avgDifficulty}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Avg Discrimination (a)</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{avgDiscrimination}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Calibrated</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {calibratedCount}/{totalQuestions}
          </div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Sessions Completed</div>
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{analytics.totalSessions ?? 0}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Avg Theta (θ)</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{typeof analytics.avgTheta === 'number' ? analytics.avgTheta.toFixed(3) : '—'}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Avg Percentile</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{typeof analytics.avgPercentile === 'number' ? analytics.avgPercentile.toFixed(1) : '—'}</div>
        </div>
        <div className="card stat-card" style={canonicalCardStyle}>
          <div className="stat-label">Avg Integrity</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>{typeof analytics.avgIntegrity === 'number' ? `${analytics.avgIntegrity.toFixed(1)}%` : '—'}</div>
        </div>
      </div>

      {/* Reliability metrics */}
      <div className="card" style={{ ...canonicalCardStyle, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.6rem' }}>Reliability & Precision</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mode</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginTop: '0.2rem' }}>{analytics.isAdaptive ? 'Adaptive (IRT)' : 'Fixed-form'}</div>
          </div>

          {analytics.isAdaptive ? (
            <>
              <div style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Marginal Reliability (IRT)</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>
                  {typeof reliability.adaptiveMarginalReliability === 'number' ? reliability.adaptiveMarginalReliability.toFixed(4) : '—'}
                </div>
              </div>
              <div style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mean SEM</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--info)', marginTop: '0.2rem' }}>
                  {typeof cohortSummary.meanSEM === 'number' ? cohortSummary.meanSEM.toFixed(4) : '—'}
                </div>
              </div>
              <div style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Peak Test Information</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-light)', marginTop: '0.2rem' }}>
                  {typeof peakInfo === 'number' ? peakInfo.toFixed(4) : '—'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cronbach’s Alpha</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.2rem' }}>
                  {typeof reliability.cronbachAlpha === 'number' ? reliability.cronbachAlpha.toFixed(4) : '—'}
                </div>
              </div>
              <div style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Alpha data coverage</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginTop: '0.2rem' }}>
                  {typeof reliability.cronbachAlphaSessionsUsed === 'number' ? reliability.cronbachAlphaSessionsUsed : 0} sessions / {typeof reliability.cronbachAlphaItemsUsed === 'number' ? reliability.cronbachAlphaItemsUsed : 0} items
                </div>
              </div>
            </>
          )}
        </div>
        <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {analytics.isAdaptive
            ? 'Adaptive reliability is shown using marginal reliability + SEM (Cronbach’s alpha is not appropriate when students see different items).'
            : 'Fixed-form reliability uses Cronbach’s alpha computed from complete-response sessions.'}
        </div>
      </div>

      {/* Cohort/session comparisons */}
      <div className="chart-container exam-analytics-chart" style={{ ...canonicalCardStyle, marginTop: '1rem', marginBottom: '1rem' }}>
        <div className="chart-title">Cohort Trends — Avg Ability (θ) & Integrity</div>
        {trendData.length < 2 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Not enough completed sessions to show trends.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={trendData}>
              <defs>
                <linearGradient id="thetaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--info)" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="var(--info)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="dateLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} domain={[-4, 4]} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, fontSize: 12 }}
                formatter={(value, name) => {
                  if (name === 'avgIntegrity') return [`${Number(value).toFixed(1)}%`, 'Avg Integrity']
                  if (name === 'avgTheta') return [Number(value).toFixed(3), 'Avg Theta (θ)']
                  if (name === 'sessions') return [value, 'Sessions']
                  return [value, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Area yAxisId="left" type="monotone" dataKey="avgTheta" stroke="var(--info)" fill="url(#thetaFill)" strokeWidth={2} dot={false} name="Avg Theta" />
              <Line yAxisId="right" type="monotone" dataKey="avgIntegrity" stroke="var(--success)" strokeWidth={2} dot={false} name="Avg Integrity" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-container exam-analytics-chart" style={{ ...canonicalCardStyle, marginBottom: '1rem' }}>
        <div className="chart-title">Ability (θ) Distribution</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          Distribution of final θ estimates across completed sessions.
        </p>
        {studentResults.length < 2 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Not enough completed sessions to show a distribution.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={thetaHistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={1} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, fontSize: 12 }}
                formatter={(value) => [value, 'Sessions']}
              />
              <Bar dataKey="count" fill="var(--accent-light)" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Integrity distribution histogram */}
      <div className="chart-container exam-analytics-chart" style={{ ...canonicalCardStyle, marginBottom: '1rem' }}>
        <div className="chart-title">Integrity / Anomaly Distribution</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          Histogram of integrity scores (0–100). Flagged sessions are highlighted.
        </p>
        {integrityTotalCount === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No completed sessions yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={integrityHistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, fontSize: 12 }}
                formatter={(value, name, props) => {
                  if (name === 'nonFlaggedCount') return [value, 'Normal']
                  if (name === 'flaggedCount') return [value, 'Flagged']
                  return [value, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="nonFlaggedCount" stackId="a" fill="var(--info-bg)" name="Normal" radius={[4, 4, 0, 0]} />
              <Bar dataKey="flaggedCount" stackId="a" fill="var(--danger)" name="Flagged" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Difficulty & Discrimination Distribution */}
      <div className="chart-container exam-analytics-chart" style={{ ...canonicalCardStyle, marginBottom: '1rem' }}>
        <div className="chart-title">Item Parameters — Difficulty & Discrimination</div>
        {!hasResponseData ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Not enough response data yet to display item parameters.
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              Administered items only (Option A).
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={itemStats}>
                <defs>
                  <linearGradient id="difficultyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} domain={[difficultyDomainMin, difficultyDomainMax]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, discriminationDomainMax]} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [typeof value === 'number' ? value.toFixed(3) : value, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Area yAxisId="left" type="monotone" dataKey="difficulty" stroke="var(--info)" fill="url(#difficultyFill)" strokeWidth={2} dot={false} name="Difficulty (b)" />
                <Line yAxisId="right" type="monotone" dataKey="discrimination" stroke="var(--success)" strokeWidth={2} dot={false} name="Discrimination (a)" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Item Characteristic Curves — Fix 1: merged data approach */}
      <div className="chart-container exam-analytics-chart" style={{ ...canonicalCardStyle, marginBottom: '1rem' }}>
        <div className="chart-title">Item Characteristic Curves (ICC)</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          Shows P(correct) vs. student ability (θ) for each question {itemAnalysis.length > 8 ? '(first 8 shown)' : ''}
        </p>
        {!hasResponseData ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Not enough response data yet to display ICC curves.
          </div>
        ) : itemAnalysis.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No questions to display.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={iccData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis
                dataKey="theta"
                type="number"
                domain={[-4, 4]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)}
                label={{ value: 'Ability (θ)', position: 'insideBottom', offset: -5, fill: '#64748b' }}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                domain={[0, 1]}
                label={{ value: 'P(correct)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                formatter={(value) => (typeof value === 'number' ? value.toFixed(4) : value)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              {visibleQuestions.map((q, i) => (
                <Line
                  key={q.id}
                  dataKey={`q${i + 1}`}
                  stroke={ICC_COLORS[i % ICC_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={`Q${i + 1} (b=${(q.irt_Difficulty ?? 0).toFixed(1)})`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Test Information Function (TIF) */}
      <div className="chart-container exam-analytics-chart" style={{ ...canonicalCardStyle, marginBottom: '1rem' }}>
        <div className="chart-title">Test Information Function (TIF)</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          Higher information indicates lower measurement error at that θ.
        </p>
        {!hasResponseData ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Not enough response data yet to display TIF/SEM.
          </div>
        ) : tifCurve.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No TIF data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={tifCurve}>
              <defs>
                <linearGradient id="tifFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-light)" stopOpacity={0.20} />
                  <stop offset="100%" stopColor="var(--accent-light)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis
                dataKey="theta"
                type="number"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)}
              />
              <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                formatter={(value, name) => {
                  if (name === 'information') return [typeof value === 'number' ? value.toFixed(4) : value, 'Information']
                  if (name === 'sem') return [typeof value === 'number' ? value.toFixed(4) : value, 'SEM']
                  return [value, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Area yAxisId="left" type="monotone" dataKey="information" stroke="var(--accent-light)" fill="url(#tifFill)" strokeWidth={2} dot={false} name="Information" />
              <Line yAxisId="right" type="monotone" dataKey="sem" stroke="var(--warning)" strokeWidth={2} dot={false} name="SEM" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Question Details Table */}
      <div className="card" style={canonicalCardStyle}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Item Analysis</h3>
        {!hasResponseData ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Not enough response data yet to display item analysis.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Difficulty (b)</th>
                <th>Discrimination (a)</th>
                <th>P-Value</th>
                <th>PBIS</th>
                <th>Answered</th>
                <th>Avg Time</th>
                <th>Label</th>
                <th>Calibrated</th>
              </tr>
            </thead>
            <tbody>
              {responseBasedItems.map((q, i) => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Q{i + 1}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.questionText}</td>
                  <td>
                    <span style={{
                      color: q.irt_Difficulty < -1 ? 'var(--success)' : q.irt_Difficulty > 1 ? 'var(--danger)' : 'var(--warning)',
                      fontWeight: 600
                    }}>{(q.irt_Difficulty ?? 0).toFixed(2)}</span>
                  </td>
                  <td>{(q.irt_Discrimination ?? 1).toFixed(2)}</td>
                  <td>{typeof q.pValue === 'number' ? q.pValue.toFixed(3) : '—'}</td>
                  <td>{typeof q.pointBiserial === 'number' ? q.pointBiserial.toFixed(3) : '—'}</td>
                  <td>{q.totalAnswered ?? 0}</td>
                  <td>{typeof q.avgTimeTakenMs === 'number' ? `${Math.round(q.avgTimeTakenMs / 1000)}s` : '—'}</td>
                  <td>
                    <span className={`badge badge-${q.difficultyLabel === 'Easy' ? 'success' : q.difficultyLabel === 'Hard' ? 'danger' : 'warning'}`}>
                      {q.difficultyLabel}
                    </span>
                  </td>
                  <td>{q.isCalibrated ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Distractor analysis */}
      <div className="card" style={{ ...canonicalCardStyle, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Distractor Analysis</h3>
        {!hasResponseData ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
            Not enough response data yet to display distractor analysis.
          </div>
        ) : responseBasedItems.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No items available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {responseBasedItems.map((q, i) => (
              <div key={q.id} style={{ ...nestedPanelStyle, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                  <div style={{ fontWeight: 600, color: 'white' }}>Q{i + 1}: {q.questionText}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.totalAnswered ?? 0} responses</div>
                </div>

                <div style={{ marginTop: '0.6rem' }}>
                  <table className="table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '50%' }}>Option</th>
                        <th>Correct</th>
                        <th>Selected</th>
                        <th>Rate</th>
                        <th>Avg θ</th>
                        <th>Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(q.distractors) ? q.distractors : []).map(o => (
                        <tr key={o.id}>
                          <td style={{ maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.optionText}</td>
                          <td style={{ fontWeight: 600, color: o.isCorrect ? 'var(--success)' : 'var(--text-muted)' }}>{o.isCorrect ? '✓' : '—'}</td>
                          <td>{o.selectionCount ?? 0}</td>
                          <td>{typeof o.selectionRate === 'number' ? `${o.selectionRate.toFixed(1)}%` : '—'}</td>
                          <td>{typeof o.avgThetaAtSelection === 'number' ? o.avgThetaAtSelection.toFixed(3) : '—'}</td>
                          <td>
                            {o.isHighAbilityDistractor ? (
                              <span className="badge badge-warning">High-ability distractor</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session summaries */}
      <div className="card" style={{ ...canonicalCardStyle, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Session Summaries</h3>
        {studentResults.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No completed sessions yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Theta (θ)</th>
                  <th>SEM</th>
                  <th>Percentile</th>
                  <th>Score</th>
                  <th>Integrity</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {studentResults.map(row => (
                  <tr key={row.id}>
                    <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ color: 'white', fontWeight: 600 }}>{row.studentName ?? '—'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.studentEmail ?? ''}</div>
                    </td>
                    <td>{typeof row.thetaEstimate === 'number' ? row.thetaEstimate.toFixed(3) : '—'}</td>
                    <td>{typeof row.thetaSEM === 'number' ? row.thetaSEM.toFixed(3) : '—'}</td>
                    <td>{typeof row.percentileRank === 'number' ? row.percentileRank.toFixed(1) : '—'}</td>
                    <td>{(row.totalCorrect ?? 0)}/{(row.totalQuestions ?? 0)}</td>
                    <td>
                      <span className={`badge badge-${(row.integrityLabel === 'Low') ? 'danger' : (row.integrityLabel === 'Medium') ? 'warning' : 'success'}`}>
                        {row.integrityLabel ?? '—'}{typeof row.integrityScore === 'number' ? ` (${Math.round(row.integrityScore)}%)` : ''}
                      </span>
                    </td>
                    <td>{typeof row.durationMinutes === 'number' ? `${row.durationMinutes.toFixed(1)}m` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamAnalytics