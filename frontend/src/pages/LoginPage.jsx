import { useState } from 'react'
import { request, session } from '../api/client'

export default function LoginPage({ onLogin, sessionError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [pending, setPending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const result = await request('/auth/login', {
        method: 'POST', body: { email: email.trim(), password },
      })
      session.save(result.accessToken)
      onLogin(result.employee)
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="brand">
          <p>Employee Leave Management</p>
        </div>
        <h1>Sign in</h1>
        <p className="lede">
          Sign in with your employee account to access your profile and leave requests.
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
              required
            />
          </label>
          {(error || sessionError) ? <p className="form-error" role="alert">{error || sessionError}</p> : null}
          <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  )
}
