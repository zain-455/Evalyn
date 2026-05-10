import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import api from '../../services/api'

function ExamResult() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResult()
  }, [sessionId])

  const loadResult = async () => {
    try {
      const res = await api.get(`/api/testsessions/${sessionId}/result`)
      setResult(res.data)
    } catch (err) {
      console.error('Failed to load result:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>
  if (!result) return <div className="empty-state"><h3>Result not found</h3></div>

  const canonicalCardStyle = {
    background: '#333335',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  }

  const nestedPanelStyle = {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  }

  const mutedText = { color: 'rgba(255,255,255,0.65)' }

  const primaryButtonStyle = {
    background: '#d98f30',
    border: 'none',
    color: '#fff',
    borderRadius: '999px',
    padding: '0.75rem 2rem',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
    transition: 'filter 0.2s ease'
  }

  const skillMap = Array.isArray(result.skillMap) ? result.skillMap : []
  const normalizedSkills = skillMap
    .map(s => {
      const mastery = Number(s?.masteryPercentage)
      const total = Number(s?.total)
      const correct = Number(s?.correct)
      const domain = (s?.domain || '').trim()
      const subDomain = (s?.subDomain || '').trim()
      const label = (subDomain || domain || 'Untitled').trim()

      return {
        domain,
        subDomain,
        label,
        mastery: Number.isFinite(mastery) ? Math.max(0, Math.min(100, mastery)) : null,
        total: Number.isFinite(total) ? total : null,
        correct: Number.isFinite(correct) ? correct : null,
      }
    })
    .filter(s => s.label && s.mastery != null)

  const topSkillsForChart = [...normalizedSkills]
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, 8)

  // Radar charts are only meaningful with 3+ points
  const canRenderRadar = topSkillsForChart.length >= 3
  const radarData = canRenderRadar
    ? topSkillsForChart.map(s => ({ domain: s.label, mastery: s.mastery, fullMark: 100 }))
    : []

  const weakestSkill = normalizedSkills.length
    ? [...normalizedSkills].sort((a, b) => a.mastery - b.mastery)[0]
    : null

  const integrityClass = result.integrityLabel === 'High' ? 'integrity-high' :
                          result.integrityLabel === 'Medium' ? 'integrity-medium' : 'integrity-low'

  const accuracy = result.totalQuestions > 0
    ? Math.round((result.totalCorrect / result.totalQuestions) * 100)
    : 0

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      <div style={{ ...canonicalCardStyle, padding: '1.35rem 1.5rem', marginBottom: '1.15rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gridTemplateRows: 'auto 0.45rem auto',
            alignItems: 'start',
            columnGap: '1rem'
          }}
        >
          <h1
            style={{
              gridColumn: '1 / 2',
              gridRow: '1 / 2',
              margin: 0,
              fontSize: '1.9rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.95)'
            }}
          >
            Exam Results
          </h1>

          <button
            type="button"
            style={{ ...primaryButtonStyle, gridColumn: '2 / 3', gridRow: '2 / 3', alignSelf: 'center', transform: 'translateY(-10px)' }}
            onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
            onClick={() => navigate('/')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Back to Dashboard</span>
            </span>
          </button>

          <p
            style={{
              gridColumn: '1 / 2',
              gridRow: '3 / 4',
              margin: 0,
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 600
            }}
          >
            {result.examTitle}
          </p>
        </div>
      </div>

      {/* Score Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.1rem', alignItems: 'stretch' }}>
        <div style={{ ...canonicalCardStyle, padding: '1.15rem 1.2rem', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
          <div style={{ ...mutedText, fontSize: '0.9rem', fontWeight: 700 }}>Ability Score (theta)</div>
          <div style={{ color: '#d98f30', fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {result.thetaEstimate.toFixed(2)}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', fontWeight: 600 }}>
            ± {result.thetaSEM.toFixed(2)} SEM
          </div>
        </div>
        <div style={{ ...canonicalCardStyle, padding: '1.15rem 1.2rem', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
          <div style={{ ...mutedText, fontSize: '0.9rem', fontWeight: 700 }}>Percentile Rank</div>
          <div style={{ color: '#34d399', fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {result.percentileRank}%
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', fontWeight: 600 }}>
            Top {(100 - result.percentileRank).toFixed(0)}% of students
          </div>
        </div>
        <div style={{ ...canonicalCardStyle, padding: '1.15rem 1.2rem', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
          <div style={{ ...mutedText, fontSize: '0.9rem', fontWeight: 700 }}>Questions</div>
          <div style={{ color: '#38bdf8', fontSize: '1.9rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {result.totalCorrect}/{result.totalQuestions}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', fontWeight: 600 }}>
            {accuracy}% accuracy
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Cognitive Skill Insights */}
        <div style={{ ...canonicalCardStyle, padding: '1.2rem' }}>
          <div style={{ marginBottom: '0.25rem' }}>
            <div style={{ fontSize: '1.02rem', fontWeight: 750, color: 'rgba(255,255,255,0.95)' }}>Cognitive Skill Insights</div>
            {weakestSkill && (
              <div style={{ marginTop: '0.2rem', fontSize: '1.02rem', fontWeight: 750, color: 'rgba(255,255,255,0.92)' }}>
                Area : {weakestSkill.label} ( {weakestSkill.mastery}% )
              </div>
            )}
          </div>

          <div style={{ marginBottom: '0.95rem', ...mutedText, fontSize: '0.9rem' }}>
            Use this breakdown to decide what to revise next — start with the lowest mastery area.
          </div>

          {normalizedSkills.length === 0 ? (
            <div style={{ ...nestedPanelStyle, padding: '1rem', ...mutedText }}>No skill data available for this session.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: canRenderRadar ? '1fr 1fr' : '1fr', gap: '1rem', alignItems: 'stretch' }}>
              {canRenderRadar && (
                <div style={{ ...nestedPanelStyle, padding: '0.85rem 0.85rem 0.6rem', minHeight: '280px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.65)', marginBottom: '0.6rem' }}>
                    Mastery Map
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData} outerRadius="78%">
                      <PolarGrid stroke="rgba(255,255,255,0.14)" />
                      <PolarAngleAxis dataKey="domain" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} />
                      <Radar name="Mastery" dataKey="mastery" stroke="#d98f30" fill="#d98f30" fillOpacity={0.22} strokeWidth={2} />
                      <Tooltip contentStyle={{ background: '#2b2b2f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12, color: '#fff' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', ...mutedText }}>
                    Showing top {topSkillsForChart.length} areas by question volume.
                  </div>
                </div>
              )}

              <div style={{ ...nestedPanelStyle, padding: '0.95rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.65)', marginBottom: '0.65rem' }}>
                  Key Takeaways
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {weakestSkill && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'rgba(255,255,255,0.92)' }}>What to revise next</div>
                        <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', ...mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weakestSkill.label}</div>
                      </div>
                      <div style={{ fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>{weakestSkill.mastery}%</div>
                    </div>
                  )}

                  {normalizedSkills.length <= 2 && !canRenderRadar && (
                    <div style={{ fontSize: '0.9rem', ...mutedText, lineHeight: 1.35 }}>
                      The mastery map needs at least 3 skill areas to render cleanly. Your full breakdown is shown in the Domain Breakdown section below.
                    </div>
                  )}

                  <div style={{ fontSize: '0.9rem', ...mutedText, lineHeight: 1.35 }}>
                    For details (scores, mastery, and all areas), use the Domain Breakdown card below.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Behavioral Integrity (clean structure) */}
        <div style={{ ...canonicalCardStyle, padding: '1.2rem' }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 750, marginBottom: '0.25rem', color: 'rgba(255,255,255,0.95)' }}>Behavioral Integrity</div>
          <div style={{ marginBottom: '0.95rem', ...mutedText, fontSize: '0.9rem' }}>
            Helps you understand whether your attempt looks consistent and authentic.
          </div>

          <div style={{ ...nestedPanelStyle, padding: '1rem', marginBottom: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'center' }}>
              <div className={`integrity-circle ${integrityClass}`} style={{ width: '96px', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.65rem', fontWeight: 900 }}>
                {result.integrityScore}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(255,255,255,0.94)', lineHeight: 1.25 }}>
                  {result.integrityLabel} Confidence
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', ...mutedText }}>
                  {result.integrityFlags.length === 0
                    ? 'No integrity signals were detected in this session.'
                    : `${result.integrityFlags.length} integrity signal(s) detected. Review the signals below so you know what to avoid next time.`}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...nestedPanelStyle, padding: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.65)' }}>Signals</div>
              <div style={{ width: '1px', height: '0.9rem', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ fontSize: '0.82rem', ...mutedText, fontWeight: 800 }}>{result.integrityFlags.length} total</div>
            </div>

            {result.integrityFlags.length === 0 ? (
              <div style={{ ...mutedText, fontSize: '0.9rem' }}>Nothing to review. Keep the same steady pace and behavior.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {result.integrityFlags.map((flag, i) => {
                  const sev = (flag?.severity || '').toLowerCase()
                  const bg = sev === 'high' ? 'var(--danger-bg)' : sev === 'medium' ? 'var(--warning-bg)' : 'var(--info-bg)'
                  const fg = sev === 'high' ? 'var(--danger)' : sev === 'medium' ? 'var(--warning)' : 'var(--info)'
                  const label = flag?.severity || 'Info'
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '0.75rem 0.85rem',
                        background: bg,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div style={{ fontWeight: 800, color: fg, fontSize: '0.92rem' }}>{flag.signal}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: fg, opacity: 0.95 }}>
                          {label}
                        </div>
                      </div>
                      {flag.description && (
                        <div style={{ ...mutedText, marginTop: '0.25rem', fontSize: '0.88rem', lineHeight: 1.35 }}>{flag.description}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain Breakdown Table */}
      {result.skillMap.length > 0 && (
        <div style={{ ...canonicalCardStyle, marginBottom: '1rem', padding: '1.2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 750, marginBottom: '0.9rem', color: 'rgba(255,255,255,0.95)' }}>Domain Breakdown</h3>

          <div style={{ ...nestedPanelStyle, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 1.1fr 0.65fr 1fr',
                gap: 0,
                padding: '0.85rem 0.95rem',
                background: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <div style={{ paddingRight: '0.75rem' }}>Domain</div>
              <div style={{ padding: '0 0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>Sub-domain</div>
              <div style={{ padding: '0 0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>Score</div>
              <div style={{ paddingLeft: '0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>Mastery</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {result.skillMap.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.1fr 1.1fr 0.65fr 1fr',
                    gap: 0,
                    padding: '0.85rem 0.95rem',
                    borderBottom: i === result.skillMap.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ paddingRight: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{s.domain}</div>
                  <div style={{ padding: '0 0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)', ...mutedText, fontWeight: 600 }}>
                    {s.subDomain || '—'}
                  </div>
                  <div style={{ padding: '0 0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
                    {s.correct}/{s.total}
                  </div>
                  <div style={{ paddingLeft: '0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="progress-bar" style={{ width: '120px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${s.masteryPercentage}%`,
                            background: s.masteryPercentage >= 70 ? 'var(--success)' : s.masteryPercentage >= 40 ? 'var(--warning)' : 'var(--danger)'
                          }}
                        ></div>
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{s.masteryPercentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamResult
