import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

function History() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const res = await api.get('/api/testsessions/my')
      setHistory(res.data || [])
    } catch (err) {
      console.error('Failed to load history:', err)
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
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
  }

  const mutedText = { color: 'rgba(255,255,255,0.65)' }

  return (
    <div className="fade-in" style={{ paddingBottom: '2rem' }}>
      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.2rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)' }}>
            Assessment History
          </h1>
          <p style={{ marginTop: '0.45rem', marginBottom: 0, color: 'rgba(255,255,255,0.75)', fontSize: '1.05rem' }}>
            Review your past performance and completed sessions.
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div style={{ 
          padding: '2rem 0', 
          color: '#000000', 
          fontSize: '1.05rem',
          textAlign: 'center'
        }}>
          You haven't completed any assessments yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {history.map(session => (
            <div key={session.id} style={{ 
              background: '#333335',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '1.5rem 1.8rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              transition: 'filter 0.2s ease, border-color 0.2s ease'
            }}
            onMouseOver={e => { 
              e.currentTarget.style.filter = 'brightness(1.03)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
            }}
            onMouseOut={e => { 
              e.currentTarget.style.filter = 'brightness(1)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', width: '100%' }}>
                 <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 750, color: 'white', fontFamily: "'Poppins', sans-serif" }}>
                      {session.examTitle}
                    </h3>
                    <p style={{ marginTop: '0.3rem', fontSize: '0.85rem', ...mutedText }}>
                      {new Date(session.startedAt).toLocaleDateString()} at {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                 </div>

                 <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: session.percentileRank >= 70 ? '#34d399' : session.percentileRank >= 50 ? '#fbbf24' : '#f87171' }}>
                        {session.percentileRank}%
                      </div>
                    </div>

                    <div style={{ width: '1px', height: '2rem', background: 'rgba(255,255,255,0.1)' }} />

                    <div>
                      <div style={{ fontSize: '0.7rem', ...mutedText, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 800, 
                        color: session.status === 'Completed' ? '#34d399' : '#f87171' 
                      }}>
                        {session.status}
                      </div>
                    </div>

                    <div style={{ width: '1px', height: '2rem', background: 'rgba(255,255,255,0.1)' }} />

                    <button
                      type="button"
                      style={primaryButtonStyle}
                      onMouseOver={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                      onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                      onClick={() => navigate(`/result/${session.id}`)}
                    >
                      View Results
                    </button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default History
