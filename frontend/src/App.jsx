import { useEffect, useState } from 'react'
import { employeeApi, request, session } from './api/client'
import AdminDashboard from './pages/AdminDashboard'
import EmployeesPage from './pages/EmployeesPage'
import LeavePage from './pages/LeavePage'
import LoginPage from './pages/LoginPage'
import ManagerDashboard from './pages/ManagerDashboard'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(session.token()))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const expired = () => {
      setCurrentUser(null)
      setError('Your session has expired. Please sign in again.')
    }
    window.addEventListener('elm-session-expired', expired)
    if (session.token()) {
      employeeApi.me(controller.signal)
        .then(setCurrentUser)
        .catch((err) => {
          if (err.name !== 'AbortError') setError(err.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }
    return () => {
      controller.abort()
      window.removeEventListener('elm-session-expired', expired)
    }
  }, [attempt])

  function handleLogin(employee) {
    setError('')
    setPage(null)
    setCurrentUser(employee)
  }

  async function handleSignOut() {
    try {
      await request('/auth/logout', { method: 'POST' })
      session.clear()
      setCurrentUser(null)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <main className="login-screen" role="status">Checking your session…</main>
  if (!currentUser && session.token()) return (
    <main className="login-screen"><section className="login-card">
      <p role="alert">{error}</p>
      <button onClick={() => { setLoading(true); setAttempt(attempt + 1) }}>Retry</button>
    </section></main>
  )
  if (!currentUser) return <LoginPage onLogin={handleLogin} sessionError={error} />

  const isAdmin = currentUser.roles.includes('ADMIN')
  const isManager = currentUser.roles.includes('MANAGER')
  const pages = [
    ...(isAdmin ? [{ id: 'admin', label: isManager ? 'Admin' : 'Dashboard' }] : []),
    ...(isManager ? [{ id: 'manager', label: isAdmin ? 'Manager' : 'Dashboard' }] : []),
    { id: 'leave', label: 'Leave' },
    { id: 'employees', label: isAdmin ? 'Employees' : 'My profile' },
  ]
  const activePage = pages.find((item) => item.id === page)?.id ?? pages[0].id

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <p>Employee Leave Management</p>
      </div>
      <div className="session">
        <div className="session-identity"><strong>{currentUser.fullName}</strong><span>{currentUser.roles.join(', ')}</span></div>
        <button type="button" className="ghost" onClick={handleSignOut}>Sign out</button>
      </div>
    </header>
    <nav className="nav" aria-label="Main navigation">
      {pages.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={activePage === id ? 'nav-link active' : 'nav-link'}
          aria-current={activePage === id ? 'page' : undefined}
          onClick={() => setPage(id)}
        >
          {label}
        </button>
      ))}
    </nav>
    {error && <p className="form-error" role="alert">{error}</p>}
    <main>
      {activePage === 'admin' && <AdminDashboard onOpenDirectory={() => setPage('employees')} />}
      {activePage === 'manager' && <ManagerDashboard />}
      {activePage === 'leave' && <LeavePage key={currentUser.id} />}
      {activePage === 'employees' && <EmployeesPage currentUser={currentUser} />}
    </main>
  </div>
}

export default App
