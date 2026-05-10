import React, { useMemo, useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import './StudentManagement.css'

function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [attemptFilter, setAttemptFilter] = useState('all');

  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [isAttemptsOpen, setIsAttemptsOpen] = useState(false);
  const sectionRef = useRef(null);
  const attemptsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sectionRef.current && !sectionRef.current.contains(event.target)) {
        setIsSectionOpen(false);
      }
      if (attemptsRef.current && !attemptsRef.current.contains(event.target)) {
        setIsAttemptsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canonicalCardStyle = {
    background: '#333335',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/students');
      const payload = res?.data;

      if (!Array.isArray(payload)) {
        setStudents([]);
        setError('Unexpected response while loading students.');
        return;
      }

      setStudents(payload);
      setError(null);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const safeStudents = Array.isArray(students) ? students : []
  const normalizedSearch = searchTerm.trim().toLowerCase()

  const availableSections = useMemo(() => {
    const sections = safeStudents
      .map((student) => (student?.section || '').trim())
      .filter((section) => Boolean(section))

    return Array.from(new Set(sections)).sort((a, b) => a.localeCompare(b))
  }, [safeStudents])

  const filteredStudents = useMemo(() => {
    return safeStudents.filter((student) => {
      const name = student?.fullName?.toLowerCase() ?? ''
      const email = student?.email?.toLowerCase() ?? ''
      const identifier = student?.identifier?.toLowerCase() ?? ''
      const institution = student?.institution?.toLowerCase() ?? ''
      const section = student?.section?.toLowerCase() ?? ''
      const attemptedSessions = typeof student?.attemptedSessions === 'number'
        ? student.attemptedSessions
        : (typeof student?.completedSessions === 'number' ? student.completedSessions : 0)

      const matchesSearch = !normalizedSearch || (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        identifier.includes(normalizedSearch) ||
        institution.includes(normalizedSearch) ||
        section.includes(normalizedSearch)
      )

      const matchesSection = sectionFilter === 'all' || section === sectionFilter.toLowerCase()
      const hasAttempted = attemptedSessions > 0
      const matchesAttempt = attemptFilter === 'all'
        || (attemptFilter === 'attempted' && hasAttempted)
        || (attemptFilter === 'not_attempted' && !hasAttempted)

      return matchesSearch && matchesSection && matchesAttempt
    })
  }, [attemptFilter, normalizedSearch, safeStudents, sectionFilter])

  return (
    <div className="fade-in" style={{ padding: '0', margin: '0 auto', width: '100%' }}>
      <div className="dash-card" style={{ ...canonicalCardStyle, padding: '1.75rem 2.25rem', width: '100%' }}>
        <div className="student-toolbar-top">
          <div className="student-toolbar-left">
            <h2 style={{ fontSize: '1.4rem', color: 'white', fontWeight: 600, margin: 0 }}>Student Directory</h2>
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)' }}></div>
            <div className="student-count">
              <span className="student-count-label">Showing</span>
              <span className="student-count-number">{filteredStudents.length}</span>
              <span className="student-count-label">students</span>
            </div>
          </div>

          <div className="student-toolbar-right">
            <label className="search-bar-container">
              <div className="search-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input 
                type="text" 
                className="search-input" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search student records..." 
              />
            </label>
            <button 
              type="button" 
              onClick={fetchStudents} 
              disabled={loading}
              style={{
                background: '#d98f30',
                color: 'white',
                border: 'none',
                borderRadius: '100px',
                padding: '0.75rem 1.8rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                textAlign: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'filter 0.2s ease',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
              }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {loading ? 'Refreshing...' : 'Refresh Directory'}
            </button>
          </div>
        </div>

        <div className="student-toolbar-filters">
          <div className="student-filter-group">
            <div className="student-filter-label">Section</div>
            <div className="custom-dropdown-container" ref={sectionRef}>
              <div 
                className={`custom-dropdown-trigger ${isSectionOpen ? 'open' : ''}`}
                onClick={() => { setIsSectionOpen(!isSectionOpen); setIsAttemptsOpen(false); }}
              >
                <span>{sectionFilter === 'all' ? 'All Sections' : availableSections.find(s => s.toLowerCase() === sectionFilter) || 'All Sections'}</span>
                <svg className="custom-dropdown-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              {isSectionOpen && (
                <div className="custom-dropdown-menu">
                  <div className={`custom-dropdown-item ${sectionFilter === 'all' ? 'selected' : ''}`} onClick={() => { setSectionFilter('all'); setIsSectionOpen(false); }}>All Sections</div>
                  {availableSections.map((section) => (
                    <div 
                      key={section} 
                      className={`custom-dropdown-item ${sectionFilter === section.toLowerCase() ? 'selected' : ''}`} 
                      onClick={() => { setSectionFilter(section.toLowerCase()); setIsSectionOpen(false); }}
                    >
                      {section}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="student-filter-group">
            <div className="student-filter-label">Attempts</div>
            <div className="custom-dropdown-container" ref={attemptsRef}>
              <div 
                className={`custom-dropdown-trigger ${isAttemptsOpen ? 'open' : ''}`}
                onClick={() => { setIsAttemptsOpen(!isAttemptsOpen); setIsSectionOpen(false); }}
              >
                <span>{attemptFilter === 'all' ? 'All Students' : attemptFilter === 'attempted' ? 'Attempted Sessions' : 'Not Attempted'}</span>
                <svg className="custom-dropdown-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              {isAttemptsOpen && (
                <div className="custom-dropdown-menu">
                  <div className={`custom-dropdown-item ${attemptFilter === 'all' ? 'selected' : ''}`} onClick={() => { setAttemptFilter('all'); setIsAttemptsOpen(false); }}>All Students</div>
                  <div className={`custom-dropdown-item ${attemptFilter === 'attempted' ? 'selected' : ''}`} onClick={() => { setAttemptFilter('attempted'); setIsAttemptsOpen(false); }}>Attempted Sessions</div>
                  <div className={`custom-dropdown-item ${attemptFilter === 'not_attempted' ? 'selected' : ''}`} onClick={() => { setAttemptFilter('not_attempted'); setIsAttemptsOpen(false); }}>Not Attempted</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <div className="student-error">{error}</div>
        ) : loading ? (
          <div className="student-loading">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="student-empty">
            <div style={{ color: 'white', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>No students found</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Try adjusting your search criteria or wait for new enrollments.</div>
          </div>
        ) : (
          <div className="student-table-panel">
            <table className="student-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>ID</th>
                  <th className="student-col-institution">INSTITUTION</th>
                  <th>SECTION</th>
                  <th style={{ textAlign: 'center' }}>SESSIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const sessions = typeof student?.attemptedSessions === 'number'
                    ? student.attemptedSessions
                    : (student?.completedSessions ?? 0)
                  const hasSessions = typeof sessions === 'number' && sessions > 0
                  const assessments = Array.isArray(student?.attemptedAssessments)
                    ? student.attemptedAssessments
                    : []
                  const assessmentPreview = assessments.slice(0, 3)
                  const assessmentTitleList = assessments
                    .map((assessment) => `${assessment.examTitle || 'Untitled'} (${assessment.status || 'Unknown'})`)
                    .join(', ')

                  return (
                    <tr key={student.id}>
                      <td>
                        <div className="student-title-text">{student.fullName || 'Unnamed Student'}</div>
                      </td>
                      <td>
                        <div className="student-meta-item" title={student?.identifier || ''}>
                          <i className="bi bi-person-badge student-meta-icon" aria-hidden="true" />
                          <div className="student-subtext">{student?.identifier || '—'}</div>
                        </div>
                      </td>
                      <td className="student-col-institution">
                        <div className="student-meta-item" title={student.institution || ''}>
                          <i className="bi bi-building student-meta-icon" aria-hidden="true" />
                          <div className="student-subtext">{student.institution || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <div className="student-meta-item" title={student.section || ''}>
                          <i className="bi bi-diagram-3 student-meta-icon" aria-hidden="true" />
                          <div className="student-subtext">{student.section || '—'}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="student-session-value" style={{ color: hasSessions ? '#d98f30' : 'rgba(255, 255, 255, 0.6)' }}>
                          {sessions}
                        </div>
                        {assessments.length > 0 ? (
                          <div className="student-session-assessments" title={assessmentTitleList}>
                            {assessmentPreview.map((assessment, index) => (
                              <span key={`${student.id}-${assessment.examId}-${index}`} className="student-assessment-chip">
                                {assessment.examTitle || 'Untitled'}
                              </span>
                            ))}
                            {assessments.length > assessmentPreview.length ? (
                              <span className="student-assessment-more">+{assessments.length - assessmentPreview.length} more</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="student-session-empty">No assessments yet</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentManagement
