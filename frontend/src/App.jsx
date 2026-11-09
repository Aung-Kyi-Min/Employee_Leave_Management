import { useEffect, useState } from 'react'
import { employeeApi, request, session } from './api/client'
import EmployeesPage from './pages/EmployeesPage'
import LoginPage from './pages/LoginPage'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(session.token()))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

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
  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    <EmployeesPage currentUser={currentUser} onSignOut={handleSignOut} />
  </>
}

export default App
