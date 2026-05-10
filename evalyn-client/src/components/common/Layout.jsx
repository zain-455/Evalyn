import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Roles } from '../../constants/appConstants'

// High-quality SVG Icons replacing lucide-react
const Icons = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Package: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Book: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H20" />
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
    </svg>
  ),
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  LogOut: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Search: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/></svg>,
  ChevronDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Eye: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  FileText: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  Database: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
}

// Custom NavItem to match the new icon-only sidebar
const NavItem = ({ to, icon: Icon, activeMatcher }) => {
  const location = useLocation()
  const isActive = activeMatcher ? activeMatcher(location.pathname) : location.pathname === to
  
  return (
    <NavLink to={to} className={`nav-item ${isActive ? 'active' : ''}`} title={to}>
      <Icon />
    </NavLink>
  )
}

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Determine title based on route logic
  let pageTitle = "Dashboard"
  if (location.pathname === '/instructor/exams') pageTitle = "Manage Exams"
  else if (location.pathname.includes('/ai')) pageTitle = "AI Question Generation"
  else if (location.pathname.includes('/exams/')) pageTitle = "Exam Builder"
  else if (location.pathname === '/instructor/analytics') pageTitle = "Analytics Dashboard"
  else if (location.pathname.includes('/analytics/')) pageTitle = "Exam Analytics"
  else if (location.pathname.includes('/question-bank')) pageTitle = "Question Bank"
  if (location.pathname === '/assessments') pageTitle = "My Assessments"
  else if (location.pathname === '/performance') pageTitle = "My Performance"
  else if (location.pathname === '/history') pageTitle = "My Results"
  const isExam = /^\/exam\/[^/]+$/.test(location.pathname)
  if (isExam) pageTitle = "Stay Focused, You Are Doing Great"

  const isInstructor = user?.role === Roles.Instructor || user?.role === Roles.Admin
  
  // Random avatar URL based on personas for a younger/cleaner look
  const avatarUrl = `https://api.dicebear.com/7.x/personas/svg?seed=${user?.email || 'default'}`

  return (
    <div className="app-layout premium-layout">
      {/* Floating Sidebar Container */}
      <aside
        className={`sidebar ${isExam ? 'exam-mode-sidebar' : ''}`}
        style={isExam ? { visibility: 'hidden', pointerEvents: 'none', opacity: 0 } : undefined}
      >
        <nav className="sidebar-nav">
          {user?.role === Roles.Student && (
            <>
              <NavItem to="/" icon={Icons.Home} activeMatcher={(p) => p === '/'} />
              <NavItem to="/assessments" icon={Icons.Book} activeMatcher={(p) => p === '/assessments'} />
              <NavItem to="/performance" icon={Icons.BarChart} activeMatcher={(p) => p === '/performance'} />
              <NavItem to="/history" icon={Icons.FileText} activeMatcher={(p) => p === '/history'} />
            </>
          )}

          {(user?.role === Roles.Instructor || user?.role === Roles.Admin) && (
            <>
              <NavItem to="/" icon={Icons.Home} activeMatcher={(p) => p === '/'} />
              <NavItem to="/instructor/exams" icon={Icons.Book} activeMatcher={(p) => p.includes('/exams')} />
              <NavItem to="/instructor/students" icon={Icons.Users} activeMatcher={(p) => p.includes('/students')} />
              <NavItem to="/instructor/analytics" icon={Icons.BarChart} activeMatcher={(p) => p.includes('/analytics')} />
              <NavItem to="/instructor/question-bank" icon={Icons.Database} activeMatcher={(p) => p.includes('/question-bank')} />
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-item">
            <Icons.Settings />
          </div>
          <div className="nav-item" onClick={handleLogout} title="Logout">
            <Icons.LogOut />
          </div>
        </div>
      </aside>

      <div className="dashboard-wrapper fade-in">
        {/* Inner Content Container */}
        <main className="main-content">
          <header className="dashboard-header">
            <h1>{pageTitle}</h1>
            <div className={`header-actions ${isExam ? 'exam-header-actions' : ''}`}>
              <div className="header-icon">
                <img src="/notification%20svg.svg" alt="Notifications" style={{ width: '20px', height: '20px', display: 'block' }} />
              </div>
              
              {/* Profile Dropdown Trigger */}
              <div className="profile-container" ref={dropdownRef}>
                <div 
                  className={`profile-trigger ${isProfileOpen ? 'active' : ''}`}
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                >
                  <div className="profile-avatar-wrapper">
                    <img src={avatarUrl} alt="Avatar" className="user-avatar-img" />
                  </div>
                  <div className="profile-info-mini">
                    <span className="profile-name">{user?.fullName || 'User'}</span>
                    <span className="profile-email">{user?.email || 'user@example.com'}</span>
                  </div>
                  <div className={`chevron-icon ${isProfileOpen ? 'rotate' : ''}`}>
                    <Icons.ChevronDown />
                  </div>
                </div>
 
                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="profile-dropdown-menu fade-in-up">
                    <div className="dropdown-header">
                      <div className="large-avatar">
                        <img src={avatarUrl} alt="Avatar" />
                      </div>
                      <div className="user-details">
                        <div className="user-name">{user?.fullName || 'User'}</div>
                        <div className="user-email">{user?.email || 'user@example.com'}</div>
                      </div>
                    </div>
                    
                    <div className="dropdown-divider"></div>
                    
                    <div className="dropdown-items">
                      <div className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}>
                        <Icons.Eye />
                        <span>Show Profile</span>
                      </div>
                      <div className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/settings'); }}>
                        <Icons.Settings />
                        <span>Settings</span>
                      </div>
                    </div>
                    
                    <div className="dropdown-divider"></div>
                    
                    <div className="dropdown-item logout-item" onClick={handleLogout}>
                      <Icons.LogOut />
                      <span>Sign out</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          
          <div className="header-divider"></div>
          
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
