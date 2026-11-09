import { useState } from 'react'
import { DEMO_PASSWORD, findEmployeeByEmail } from '../data/mock'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const employee = findEmployeeByEmail(email)

    if (!employee || password !== DEMO_PASSWORD) {
      setError('Email or password is incorrect.')
      return
    }

    if (!employee.isActive) {
      setError('This account is inactive. Ask HR to restore access.')
      return
    }

    setError('')
    onLogin(employee)
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <p className="eyebrow">Employee Leave Management</p>
        <h1>Sign in</h1>
        <p className="lede">
          Use a mock employee account to apply for leave and open the directory. Every active account uses the password{' '}
          <code>{DEMO_PASSWORD}</code>.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="aung@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password"
              required
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit">Sign in</button>
        </form>

        <p className="demo-hint">Try aung@company.com or zay@company.com.</p>
      </section>
    </main>
  )
}
