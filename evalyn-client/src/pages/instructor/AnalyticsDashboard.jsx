import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function AnalyticsDashboard() {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    try {
      const res = await api.get('/api/analytics/instructor-dashboard')
      setDashboardData(res.data)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !dashboardData) {
    return (
      <div className="loading-spinner" style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const {
    integrityDistribution = [],
    thetaDistribution = [],
    questionBankHealth = [],
    volumeLast7Days = [],
    stats = {}
  } = dashboardData

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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>{label}</p>
          <p style={{ margin: 0, color: '#fff', fontWeight: 'bold' }}>
            {payload[0].value} {payload[0].name === 'Count' || payload[0].name === 'count' || payload[0].name === 'Submissions' || payload[0].name === 'submissions' ? '' : payload[0].name}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fade-in" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', right: '-10%', top: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', left: '-5%', bottom: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }}></div>

      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.35rem 1.5rem', marginBottom: '1.5rem', position: 'relative', zIndex: 1, textAlign: 'left' }}>
        <h2 className="hero-title" style={{ fontSize: '1.8rem', margin: 0, color: 'rgba(255,255,255,0.95)', fontWeight: 800 }}>Platform Analytics</h2>
        <p className="hero-subtitle" style={{ marginTop: '0.45rem', marginBottom: 0, color: 'rgba(255,255,255,0.75)' }}>Comprehensive analytics across all your exams and student performance trends.</p>
      </div>

      <div className="hero-stats-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
        <div className="dash-card" style={{ ...canonicalCardStyle, flex: 1, minWidth: '150px', padding: '1.25rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{stats.activeExams || 0}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Exams</div>
        </div>
        <div className="dash-card" style={{ ...canonicalCardStyle, flex: 1, minWidth: '150px', padding: '1.25rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{stats.totalStudentsTested || 0}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Submissions</div>
          </div>
          <div className="dash-card" style={{ ...canonicalCardStyle, flex: 1, minWidth: '150px', padding: '1.25rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{stats.avgClassIntegrity || 0}%</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Avg Integrity Score</div>
          </div>
          <div className="dash-card" style={{ ...canonicalCardStyle, flex: 1, minWidth: '150px', padding: '1.25rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{stats.totalQuestions || 0}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Analyzed Questions</div>
          </div>
      </div>


      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', position: 'relative', zIndex: 1, paddingBottom: '2rem' }}>

        <div className="dash-card" style={{ ...canonicalCardStyle, minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">Integrity Score Distribution (Anomaly Histogram)</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Distribution of model-derived trust scores (0=Critical, 100=Authentic) across all past sessions.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            {integrityDistribution && integrityDistribution.some(d => (d.Count > 0 || d.count > 0)) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={integrityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey={integrityDistribution[0]?.range ? "range" : "Range"} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={integrityDistribution[0]?.count !== undefined ? "count" : "Count"} name="Count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ ...nestedPanelStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Insufficient data to generate anomalies.
              </div>
            )}
          </div>
        </div>

        <div className="dash-card" style={{ ...canonicalCardStyle, minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">Class Ability Estimates (Theta θ)</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Aggregate distribution of maximum likelihood ability estimates (-3 to +3) for all tested students.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            {thetaDistribution && thetaDistribution.some(d => (d.Count > 0 || d.count > 0)) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thetaDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey={thetaDistribution[0]?.range ? "range" : "Range"} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={thetaDistribution[0]?.count !== undefined ? "count" : "Count"} name="Count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ ...nestedPanelStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Insufficient data to plot ability estimates.
              </div>
            )}
          </div>
        </div>

        <div className="dash-card" style={{ ...canonicalCardStyle, minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">Item Discrimination Quality</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Average IRT discrimination parameter per active exam pool. &gt;1.0 indicates strong measurement quality.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            {questionBankHealth && questionBankHealth.some(d => (d.AvgDiscrimination > 0 || d.avgDiscrimination > 0)) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={questionBankHealth} layout="vertical" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
                  <YAxis dataKey={questionBankHealth[0]?.examName ? "examName" : "ExamName"} type="category" stroke="rgba(255,255,255,0.6)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={questionBankHealth[0]?.avgDiscrimination !== undefined ? "avgDiscrimination" : "AvgDiscrimination"} name="Avg Discrimination" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ ...nestedPanelStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Insufficient data to compute discrimination metrics.
              </div>
            )}
          </div>
        </div>

        <div className="dash-card" style={{ ...canonicalCardStyle, minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div className="dash-card-header" style={{ marginBottom: '1rem' }}>
            <span className="dash-card-title">Test Volumes (Trailing 7 Days)</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Number of recorded test sessions completed successfully per day.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            {volumeLast7Days && volumeLast7Days.some(d => (d.Submissions > 0 || d.submissions > 0)) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeLast7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey={volumeLast7Days[0]?.date ? "date" : "Date"} stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey={volumeLast7Days[0]?.submissions !== undefined ? "submissions" : "Submissions"} stroke="var(--accent)" fillOpacity={1} fill="url(#colorSubmissions)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ ...nestedPanelStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No testing volume recorded in the trailing period.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default AnalyticsDashboard
