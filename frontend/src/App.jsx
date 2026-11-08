import { useState } from 'react'
import { employees } from './data/mock'
import EmployeesPage from './pages/EmployeesPage'
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

  function handleLogin(employee) {
    sessionStorage.setItem(SESSION_KEY, String(employee.employeeId))
    setCurrentUser(employee)
  }

  function handleSignOut() {
    sessionStorage.removeItem(SESSION_KEY)
    setCurrentUser(null)
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />
  }

  return <EmployeesPage currentUser={currentUser} onSignOut={handleSignOut} />
}

export default App
