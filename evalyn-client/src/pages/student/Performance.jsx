import { useState, useEffect } from 'react'
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

function Performance() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPerformanceData()
  }, [])

  const loadPerformanceData = async () => {
    try {
      const res = await api.get('/api/analytics/student-profile')
      setData(res.data)
      setError('')
    } catch (err) {
      console.error('Failed to load performance data:', err)
      setData(null)
      setError('Unable to load performance analytics yet. Complete an assessment or try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner" style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const canonicalCardStyle = {
    background: '#333335',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    padding: '1.5rem'
  }

  const nestedPanelStyle = {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '1.25rem'
  }

  const mutedText = { color: 'rgba(255,255,255,0.65)' }

  const radarStats = data?.radarStats || []
  const abilityHistory = data?.abilityHistory || []
  const currentTheta = data?.currentTheta ?? 0
  const percentile = data?.percentile ?? 0
  const sem = data?.sem ?? 0
  const confidenceInterval = data?.confidenceInterval || [0, 0]

  const topDomain = radarStats.length
    ? [...radarStats].sort((a, b) => b.A - a.A)[0]
    : null
  const focusDomain = radarStats.length
    ? [...radarStats].sort((a, b) => a.A - b.A)[0]
    : null

  const growthDelta = abilityHistory.length >= 2
    ? abilityHistory[abilityHistory.length - 1].theta - abilityHistory[0].theta
    : 0
  const growthLabel = growthDelta > 0.05 ? 'Rising Rapidly'
    : growthDelta < -0.05 ? 'Needs Attention'
    : 'Holding Steady'
  const growthSubtext = abilityHistory.length >= 2
    ? `${growthDelta >= 0 ? '+' : ''}${growthDelta.toFixed(2)} θ change`
    : 'Not enough data yet'

  const hasPerformanceData = radarStats.length > 0 || abilityHistory.length > 0

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && (
        <div style={{ ...canonicalCardStyle, background: '#3a2f2f', borderColor: 'rgba(248,113,113,0.3)' }}>
          <div style={{ color: '#fca5a5', fontWeight: 700 }}>{error}</div>
        </div>
      )}
      {/* Top Banner Stats */}
      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <span style={{ ...mutedText, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: 600 }}>Estimated Mastery</span>
            <h2 style={{ margin: '0.2rem 0', fontSize: '2.2rem', fontWeight: 900, color: '#d98f30' }}>
              {percentile}% <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Percentile Rank</span>
            </h2>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ ...nestedPanelStyle, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ ...mutedText, fontSize: '0.75rem', fontWeight: 600 }}>Ability Estimate (θ)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginTop: '0.3rem' }}>+{currentTheta}</div>
            </div>
            <div style={{ ...nestedPanelStyle, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ ...mutedText, fontSize: '0.75rem', fontWeight: 600 }}>SEM (Standard Error)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginTop: '0.3rem' }}>±{sem}</div>
            </div>
            <div style={{ ...nestedPanelStyle, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ ...mutedText, fontSize: '0.75rem', fontWeight: 600 }}>Confidence Interval</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: '0.3rem' }}>
                [{confidenceInterval[0]} , {confidenceInterval[1]}]
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        {/* Radar Chart: Cognitive Domain Profile */}
        <div className="dash-card" style={canonicalCardStyle}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Skill Fingerprint</h3>
            <p style={{ ...mutedText, fontSize: '0.85rem', marginTop: '0.2rem' }}>Mastery across cognitive dimensions</p>
          </div>
          
          <div style={{ height: '350px', width: '100%' }}>
            {!radarStats.length ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', textAlign: 'center' }}>
                Complete an assessment to show your performance.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarStats}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Ability"
                    dataKey="A"
                    stroke="#d98f30"
                    fill="#d98f30"
                    fillOpacity={0.4}
                  />
                  <Radar
                    name="Cohort Average"
                    dataKey="B"
                    stroke="rgba(255,255,255,0.3)"
                    fill="rgba(255,255,255,0.1)"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '10px', height: '10px', background: '#d98f30', borderRadius: '50%' }} />
              <span style={{ ...mutedText, fontSize: '0.75rem' }}>My Mastery</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '10px', height: '10px', background: 'rgba(255,255,255,0.3)', borderRadius: '50%' }} />
              <span style={{ ...mutedText, fontSize: '0.75rem' }}>Cohort Avg</span>
            </div>
          </div>
        </div>

        {/* Area Chart: Progression */}
        <div className="dash-card" style={canonicalCardStyle}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Mastery Progression</h3>
            <p style={{ ...mutedText, fontSize: '0.85rem', marginTop: '0.2rem' }}>IRT θ-estimate trajectory over time</p>
          </div>

          <div style={{ height: '350px', width: '100%' }}>
            {!abilityHistory.length ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', textAlign: 'center' }}>
                Complete an assessment to show your performance.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={abilityHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTheta" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d98f30" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#d98f30" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis 
                    domain={[-4, 4]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#222', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="theta" 
                    stroke="#d98f30" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTheta)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Domain Insights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
         <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', ...mutedText, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Top Domain</div>
          <div style={{ fontSize: '1.18rem', fontWeight: 800, marginTop: '0.5rem' }}>{topDomain?.subject || '—'}</div>
          <div style={{ fontSize: '0.88rem', color: '#34d399', fontWeight: 700, marginTop: '0.2rem' }}>
            {topDomain ? `${topDomain.A}% mastery` : 'No domain data yet'}
          </div>
         </div>
         <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', ...mutedText, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Focus Area</div>
          <div style={{ fontSize: '1.18rem', fontWeight: 800, marginTop: '0.5rem' }}>{focusDomain?.subject || '—'}</div>
          <div style={{ fontSize: '0.88rem', color: '#f97316', fontWeight: 700, marginTop: '0.2rem' }}>
            {focusDomain ? `${focusDomain.A}% mastery` : 'No domain data yet'}
          </div>
         </div>
         <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', ...mutedText, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Growth Index</div>
          <div style={{ fontSize: '1.18rem', fontWeight: 800, marginTop: '0.5rem' }}>{growthLabel}</div>
          <div style={{ fontSize: '0.88rem', color: '#38bdf8', fontWeight: 700, marginTop: '0.2rem' }}>{growthSubtext}</div>
         </div>
      </div>
    </div>
  )
}

export default Performance
