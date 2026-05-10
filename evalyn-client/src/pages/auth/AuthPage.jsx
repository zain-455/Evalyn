import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { Roles } from '../../constants/appConstants'

function AuthPage() {
  const [isRightPanelActive, setIsRightPanelActive] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { login } = useAuth()

  const getApiErrorMessage = (err, fallback) => {
    const data = err?.response?.data
    if (!data) {
      const status = err?.response?.status
      // When Vite proxy can't reach the backend, it often returns 500 with an empty body.
      // Give an actionable message instead of the generic Axios status string.
      if (status === 500 || status === 502 || status === 503 || status === 504) {
        return 'Backend API is not reachable. Start Evalyn.API (http://localhost:5230) and refresh the page.'
      }

      // True network/CORS errors (no response)
      if (!err?.response) {
        return 'Network error. Ensure Evalyn.API is running and your API URL/proxy is configured.'
      }

      return err?.message || fallback
    }

    // ValidationProblemDetails: { errors: { field: [..], ... } }
    if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      const messages = Object.values(data.errors)
        .flat()
        .filter(Boolean)
      if (messages.length) return messages.join(', ')
    }

    // Legacy / ad-hoc
    if (Array.isArray(data.errors) && data.errors.length) return data.errors.join(', ')
    if (typeof data.error === 'string' && data.error) return data.error
    if (typeof data.title === 'string' && data.title) return data.title
    if (typeof data.detail === 'string' && data.detail) return data.detail

    return fallback
  }

  // Prevent page-level scrollbars on auth routes (login/register)
  useEffect(() => {
    document.documentElement.classList.add('auth-page')
    document.body.classList.add('auth-page')
    return () => {
      document.documentElement.classList.remove('auth-page')
      document.body.classList.remove('auth-page')
    }
  }, [])

  // Login State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register State
  const [regFullName, setRegFullName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regRole, setRegRole] = useState(Roles.Student)
  const [regInstitution, setRegInstitution] = useState('')
  const [regIdentifier, setRegIdentifier] = useState('') // Roll No or Inst ID
  const [regSection, setRegSection] = useState('')
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
  const [regPassword, setRegPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false)
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState('')
  const [isWavyFilling, setIsWavyFilling] = useState(false)

  // Set initial panel based on route
  useEffect(() => {
    if (location.pathname === '/register') {
      setIsRightPanelActive(true)
    } else {
      setIsRightPanelActive(false)
    }
  }, [location.pathname])

  const handlePanelSwitch = (isRight, skipClearEmail = false) => {
    setIsRightPanelActive(isRight)
    
    // Clear errors and success messages
    setLoginError('')
    setRegError('')
    setRegSuccess('')
    setIsWavyFilling(false)

    // Reset Login Fields
    if (!skipClearEmail) setLoginEmail('')
    setLoginPassword('')
    setShowLoginPassword(false)

    // Reset Registry Fields
    setRegFullName('')
    setRegEmail('')
    setRegRole(Roles.Student)
    setRegInstitution('')
    setRegIdentifier('')
    setRegSection('')
    setRegPassword('')
    setShowRegPassword(false)
    setRegConfirmPassword('')
    setShowRegConfirmPassword(false)

    // Update URL without full reload
    navigate(isRight ? '/register' : '/login', { replace: true })
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await login(loginEmail, loginPassword)
      navigate('/')
    } catch (err) {
      setLoginError('Invalid email or password.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegSubmit = async (e) => {
    e.preventDefault()
    setRegError('')
    setRegSuccess('')

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.')
      return
    }

    setRegLoading(true)
    try {
      // Create user
      await api.post('/api/auth/register', { 
        email: regEmail, 
        password: regPassword, 
        fullName: regFullName, 
        role: regRole,
        institution: regInstitution,
        identifier: regIdentifier,
        section: regSection
      })
      setRegSuccess('Registration successful! Redirecting...')
      
      // Trigger wavy animation after mount
      setTimeout(() => setIsWavyFilling(true), 50)
      
      // Clear form and switch to login after delay
      setTimeout(() => {
        handlePanelSwitch(false, false) // Switch to login and clear everything
        setIsWavyFilling(false)
        // Reset success state after transition
        setTimeout(() => setRegSuccess(''), 600)
      }, 2400) // Slightly longer to allow full completion

    } catch (err) {
      setRegError(getApiErrorMessage(err, 'Registration failed.'))
    } finally {
      setRegLoading(false)
    }
  }

  // Removed native selectStyle as we are using a custom animated dropdown now.

  return (
    <div className="auth-master-bg fade-in">
      <div className={`auth-sliding-container ${isRightPanelActive ? 'right-panel-active' : ''}`}>
        
        {/* SIGN UP FORM (Left side, horizontally flows on wide, but stacked inside its panel) */}
        <div className="form-container sign-up-container">
          <form className="auth-form slider-form" onSubmit={handleRegSubmit}>
            <h1 style={{ marginBottom: '0.5rem', fontSize: '1.8rem' }}>Create Account</h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Join the Evalyn Platform</span>
            
            <div className={`reg-success-container ${regSuccess ? 'active' : ''}`}>
              <svg className="wavy-loader-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="wavyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9df" />
                    <stop offset="33%" stopColor="#9fd" />
                    <stop offset="66%" stopColor="#df9" />
                    <stop offset="100%" stopColor="#fd9" />
                  </linearGradient>
                </defs>
                <path 
                  className="wavy-path-bg" 
                  d="M10 20Q20 15 30 20Q40 25 50 20Q60 15 70 20Q80 25 90 20" 
                />
                <path 
                  className={`wavy-path-fill ${isWavyFilling ? 'filling' : ''}`} 
                  d="M10 20Q20 15 30 20Q40 25 50 20Q60 15 70 20Q80 25 90 20"
                  stroke="url(#wavyGradient)"
                />
              </svg>
            </div>

            {regError && <div className="auth-alert error">{regError}</div>}

            {/* Horizontal Grid for Signup to save space */}
            <div className="reg-grid">
              <div className="form-group">
                <input className="auth-input slider-input" type="text" placeholder="Full Name" value={regFullName} onChange={e => setRegFullName(e.target.value)} required />
              </div>
              <div className="form-group">
                <input className="auth-input slider-input" type="email" placeholder="Email Address" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              </div>
              
              <div className="form-group">
                <div className={`role-dropdown ${isRoleDropdownOpen ? 'open' : ''}`}>
                  <div className="role-dropdown-header" onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}>
                    <span>{regRole === Roles.Student ? 'Student Role' : 'Instructor Role'}</span>
                    <span className="role-dropdown-icon">▼</span>
                  </div>
                  <div className="role-dropdown-menu">
                    <div className={`role-dropdown-item ${regRole === Roles.Student ? 'selected' : ''}`} onClick={() => { setRegRole(Roles.Student); setIsRoleDropdownOpen(false); }}>
                      Student Role
                    </div>
                    <div className={`role-dropdown-item ${regRole === Roles.Instructor ? 'selected' : ''}`} onClick={() => { setRegRole(Roles.Instructor); setIsRoleDropdownOpen(false); }}>
                      Instructor Role
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <input className="auth-input slider-input" type="text" placeholder="Institution" value={regInstitution} onChange={e => setRegInstitution(e.target.value)} required />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <input className="auth-input slider-input" type="text" placeholder={regRole === Roles.Student ? 'Roll No. (Registration ID)' : 'Institution Staff ID'} value={regIdentifier} onChange={e => setRegIdentifier(e.target.value)} required />
              </div>

              {regRole === Roles.Student && (
                <div className="form-group fade-in" style={{ gridColumn: '1 / -1' }}>
                  <input 
                    className="auth-input slider-input" 
                    type="text" 
                    placeholder="Section (e.g. 7A, 7B)" 
                    value={regSection} 
                    onChange={e => setRegSection(e.target.value)} 
                    required 
                  />
                </div>
              )}

              <div className="form-group" style={{ position: 'relative' }}>
                <input className="auth-input slider-input" type={showRegPassword ? 'text' : 'password'} placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} style={{ paddingRight: '2.5rem' }} />
                <span onClick={() => setShowRegPassword(!showRegPassword)} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', zIndex: 10 }}>
                  <i className={showRegPassword ? 'bi bi-eye' : 'bi bi-eye-slash'} />
                </span>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <input className="auth-input slider-input" type={showRegConfirmPassword ? 'text' : 'password'} placeholder="Confirm Password" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} required minLength={6} style={{ paddingRight: '2.5rem' }} />
                <span onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', zIndex: 10 }}>
                  <i className={showRegConfirmPassword ? 'bi bi-eye' : 'bi bi-eye-slash'} />
                </span>
              </div>
            </div>

            <button className="auth-btn" style={{ marginTop: '1.5rem' }} type="submit" disabled={regLoading}>
              {regLoading ? 'Creating...' : 'Sign Up'}
            </button>
            <p className="mobile-switch" onClick={() => handlePanelSwitch(false)}>
              Already have an account? Sign In
            </p>
          </form>
        </div>

        {/* SIGN IN FORM (Right side technically, but visually left initially) */}
        <div className="form-container sign-in-container">
          <form className="auth-form slider-form vertical-form" onSubmit={handleLoginSubmit}>
            <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>Welcome Back</h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Please enter your details.</span>
            
            {loginError && <div className="auth-alert error">{loginError}</div>}

            <div className="form-group" style={{ width: '100%' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', alignSelf: 'flex-start', marginBottom: '0.25rem' }}>Email</label>
              <input className="auth-input slider-input" type="email" placeholder="jane@evalyn.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            </div>
            
            <div className="form-group" style={{ width: '100%', marginTop: '0.5rem', position: 'relative' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', alignSelf: 'flex-start', marginBottom: '0.25rem' }}>Password</label>
              <input className="auth-input slider-input" type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ paddingRight: '2.5rem' }} />
              <span onClick={() => setShowLoginPassword(!showLoginPassword)} style={{ position: 'absolute', right: '0.6rem', bottom: '0.8rem', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', zIndex: 10 }}>
                <i className={showLoginPassword ? 'bi bi-eye' : 'bi bi-eye-slash'} />
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: 'var(--accent)' }} /> Remember me
              </label>
              <a href="#" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>Forgot password?</a>
            </div>

            <button className="auth-btn" style={{ marginTop: '2rem', width: '100%' }} type="submit" disabled={loginLoading}>
              {loginLoading ? 'Logging In...' : 'Log In'}
            </button>
            <p className="mobile-switch" onClick={() => handlePanelSwitch(true)}>
              Need an account? Sign Up
            </p>
          </form>
        </div>

        {/* OVERLAY CONTAINER (The moving artwork panel) */}
        <div className="overlay-container">
          <div className="overlay">
            {/* The abstract art background is applied via CSS to .overlay-panel */}
            
            <div className="overlay-panel overlay-left">
              <div className="overlay-content">
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>Already Registered?</h1>
                <p style={{ fontSize: '1rem', marginBottom: '2rem', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Log in to access your dashboard and resume where you left off.</p>
                <button className="btn btn-ghost overlay-btn" onClick={() => handlePanelSwitch(false)}>Log In</button>
              </div>
            </div>
            
            <div className="overlay-panel overlay-right">
              <div className="overlay-content">
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>New Here?</h1>
                <p style={{ fontSize: '1rem', marginBottom: '2rem', textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Create your account and experience adaptive testing powered by behavioral intelligence.</p>
                <button className="btn btn-ghost overlay-btn" onClick={() => handlePanelSwitch(true)}>Get started</button>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
