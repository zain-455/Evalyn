import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/common/Layout'
import ErrorBoundary from './components/common/ErrorBoundary'
import { Roles } from './constants/appConstants'

const AuthPage = lazy(() => import('./pages/auth/AuthPage'))

// Student
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'))
const TakeExam = lazy(() => import('./pages/student/TakeExam'))
const ExamResult = lazy(() => import('./pages/student/ExamResult'))
const Assessments = lazy(() => import('./pages/student/Assessments'))
const Performance = lazy(() => import('./pages/student/Performance'))
const History = lazy(() => import('./pages/student/History'))

// Instructor
const InstructorDashboard = lazy(() => import('./pages/instructor/InstructorDashboard'))
const ExamBuilder = lazy(() => import('./pages/instructor/ExamBuilder'))
const ExamAnalytics = lazy(() => import('./pages/instructor/ExamAnalytics'))
const ExamList = lazy(() => import('./pages/instructor/ExamList'))
const CreateExam = lazy(() => import('./pages/instructor/CreateExam'))
const AIQuestionGen = lazy(() => import('./pages/instructor/AIQuestionGen'))
const StudentManagement = lazy(() => import('./pages/instructor/StudentManagement'))
const AnalyticsDashboard = lazy(() => import('./pages/instructor/AnalyticsDashboard'))
const QuestionBank = lazy(() => import('./pages/instructor/QuestionBank'))

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />
  return children
}

function App() {
  const { user } = useAuth()

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={!user ? <AuthPage /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <AuthPage /> : <Navigate to="/" />} />

          {/* Protected */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            {/* Redirect based on role */}
            <Route index element={
              user?.role === Roles.Student ? <StudentDashboard /> :
              user?.role === Roles.Instructor ? <InstructorDashboard /> :
              <StudentDashboard />
            } />

            {/* Student Routes */}
            <Route path="exam/:examId" element={
              <ProtectedRoute roles={[Roles.Student]}>
                <TakeExam />
              </ProtectedRoute>
            } />
            <Route path="result/:sessionId" element={
              <ProtectedRoute roles={[Roles.Student, Roles.Instructor, Roles.Admin]}>
                <ExamResult />
              </ProtectedRoute>
            } />
            <Route path="assessments" element={
              <ProtectedRoute roles={[Roles.Student]}>
                <Assessments />
              </ProtectedRoute>
            } />
            <Route path="performance" element={
              <ProtectedRoute roles={[Roles.Student]}>
                <Performance />
              </ProtectedRoute>
            } />
            <Route path="history" element={
              <ProtectedRoute roles={[Roles.Student]}>
                <History />
              </ProtectedRoute>
            } />

            {/* Instructor Routes */}
            <Route path="instructor/exams" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <ExamList />
              </ProtectedRoute>
            } />
            <Route path="instructor/exams/create" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <CreateExam />
              </ProtectedRoute>
            } />
            <Route path="instructor/exams/:examId" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <ExamBuilder />
              </ProtectedRoute>
            } />
            <Route path="instructor/exams/:examId/ai" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <AIQuestionGen />
              </ProtectedRoute>
            } />
            <Route path="instructor/analytics/:examId" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <ExamAnalytics />
              </ProtectedRoute>
            } />
            <Route path="instructor/students" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <StudentManagement />
              </ProtectedRoute>
            } />
            <Route path="instructor/analytics" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <AnalyticsDashboard />
              </ProtectedRoute>
            } />
            <Route path="instructor/question-bank" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <QuestionBank />
              </ProtectedRoute>
            } />
            <Route path="instructor/ai-question-gen" element={
              <ProtectedRoute roles={[Roles.Instructor, Roles.Admin]}>
                <AIQuestionGen />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
