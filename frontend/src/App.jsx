import { useState } from 'react'
import { employees } from './data/mock'
import EmployeesPage from './pages/EmployeesPage'
import LeavePage from './pages/LeavePage'
import LoginPage from './pages/LoginPage'
import './App.css'

const SESSION_KEY = 'elm-session'

function readSession() {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }

  const employeeId = Number(raw)
  return employees.find((employee) => employee.employeeId === employeeId && employee.isActive) ?? null
}

function App() {
  const [currentUser, setCurrentUser] = useState(readSession)
  const [page, setPage] = useState('leave')

  function handleLogin(employee) {
    sessionStorage.setItem(SESSION_KEY, String(employee.employeeId))
    setCurrentUser(employee)
  }

  function handleSignOut() {
    sessionStorage.removeItem(SESSION_KEY)
    setCurrentUser(null)
    setPage('leave')
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Employee Leave Management</p>
          <nav className="nav" aria-label="Primary">
            <button
              type="button"
              className={page === 'leave' ? 'nav-link active' : 'nav-link'}
              onClick={() => setPage('leave')}
            >
              Leave
            </button>
            <button
              type="button"
              className={page === 'employees' ? 'nav-link active' : 'nav-link'}
              onClick={() => setPage('employees')}
            >
              Directory
            </button>
          </nav>
        </div>
        <div className="session">
          <div>
            <strong>{currentUser.fullName}</strong>
            <span>{currentUser.role} · {currentUser.department}</span>
          </div>
          <button type="button" className="ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {page === 'employees' ? (
        <EmployeesPage currentUser={currentUser} />
      ) : (
        <LeavePage currentUser={currentUser} />
      )}
    </div>
  )
}

export default App
