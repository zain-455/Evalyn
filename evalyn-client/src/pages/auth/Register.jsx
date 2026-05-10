import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { Roles } from '../../constants/appConstants'

function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [institution, setInstitution] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [section, setSection] = useState('')
  const [role, setRole] = useState(Roles.Student)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const getApiErrorMessage = (err, fallback) => {
    const data = err?.response?.data
    if (!data) {
      const status = err?.response?.status
      if (status === 500 || status === 502 || status === 503 || status === 504) {
        return 'Backend API is not reachable. Start Evalyn.API (http://localhost:5230) and refresh the page.'
      }

      if (!err?.response) {
        return 'Network error. Ensure Evalyn.API is running and your API URL/proxy is configured.'
      }

      return err?.message || fallback
    }

    if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      const messages = Object.values(data.errors).flat().filter(Boolean)
      if (messages.length) return messages.join(', ')
    }

    if (Array.isArray(data.errors) && data.errors.length) return data.errors.join(', ')
    if (typeof data.error === 'string' && data.error) return data.error
    if (typeof data.title === 'string' && data.title) return data.title
    if (typeof data.detail === 'string' && data.detail) return data.detail

    return fallback
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      await api.post('/api/auth/register', { email, password, fullName, role, institution, identifier, section })
      setSuccessMsg('Registration successful. Redirecting to login...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed.'))
    } finally {
      setLoading(false)
    }
  }

  // Helper for the custom dropdown styling on the transparent line design
  const selectStyle = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-glass)',
    color: 'white',
    padding: '0.5rem 0',
    appearance: 'auto',
    outline: 'none',
    fontSize: '0.95rem'
  }

  return (
    <div className="auth-split-layout fade-in">
      <div className="auth-hero">
        {/* Colorful background shows through here */}
      </div>

      <div className="auth-panel" style={{ padding: '3rem 5rem' }}>
        <div className="auth-header" style={{ marginBottom: '2rem' }}>
          <h1>Create an account</h1>
          <p className="subtitle">Please enter your details to sign up.</p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} style={{ gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              className="auth-input"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">E-mail</label>
            <input
              id="reg-email"
              className="auth-input"
              type="email"
              placeholder="Enter your e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="institution">Institution</label>
            <input
              id="institution"
              className="auth-input"
              type="text"
              placeholder="Enter your institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="identifier">Identifier</label>
            <input
              id="identifier"
              className="auth-input"
              type="text"
              placeholder={role === Roles.Student ? 'Roll No. / Registration ID' : 'Staff ID'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-password"
                className="auth-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <span
                onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <i className={showPassword ? 'bi bi-eye' : 'bi bi-eye-slash'} style={{ fontSize: '1.1rem' }} />
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirm-password"
                className="auth-input"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <span
                onClick={() => setShowConfirm(p => !p)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <i className={showConfirm ? 'bi bi-eye' : 'bi bi-eye-slash'} style={{ fontSize: '1.1rem' }} />
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="role">I am a...</label>
            <select
              id="role"
              style={selectStyle}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="Student" style={{ background: '#1a1a2e' }}>Student</option>
              <option value="Instructor" style={{ background: '#1a1a2e' }}>Instructor</option>
            </select>
          </div>

          {role === Roles.Student && (
            <div className="form-group fade-in">
              <label className="form-label" htmlFor="section">Section</label>
              <input
                id="section"
                className="auth-input"
                type="text"
                placeholder="Enter your section (e.g. 7A, 7B)"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                required
              />
            </div>
          )}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in here</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
