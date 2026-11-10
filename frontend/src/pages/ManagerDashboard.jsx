import { useEffect, useState } from 'react'
import { leaveApi } from '../api/client'
import DashboardSummary from '../components/DashboardSummary'
import { formatDate, statusLabel } from '../format'

export default function ManagerDashboard() {
  const [requests, setRequests] = useState([])
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    leaveApi.assigned(controller.signal).then(setRequests).catch((err) => {
      if (err.name !== 'AbortError') setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])

  async function reviewRequest(id, decision) {
    setBusy(id)
    setError('')
    setFeedback('')
    try {
      await leaveApi.decide(id, decision, comments[id]?.trim() || '')
      setRequests((previous) => previous.filter((item) => item.id !== id))
      setFeedback(`Request ${statusLabel(decision).toLowerCase()}.`)
    } catch (err) { setError(err.message) }
    finally { setBusy(null) }
  }

  return <>
    <div className="page-heading">
      <h1>Manager dashboard</h1>
      <p className="lede">Review pending leave requests assigned to you.</p>
    </div>
    <DashboardSummary label="Approval queue" metrics={[
      { title: 'Pending requests', value: loading ? '…' : requests.length, note: 'Awaiting your decision' },
      { title: 'Requested days', value: loading ? '…' : requests.reduce((sum, item) => sum + item.totalDays, 0), note: 'Weekdays in pending requests' },
    ]} />
    <section className="panel" aria-labelledby="team-requests">
      <div className="panel-head">
        <h2 id="team-requests">Assigned requests</h2>
        <button className="ghost" disabled={loading || busy !== null} onClick={() => { setLoading(true); setError(''); setAttempt((value) => value + 1) }}>Refresh</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {feedback && <p className="form-success" role="status">{feedback}</p>}
      {loading ? <p role="status">Loading requests…</p> : requests.length ? <ul className="dashboard-list">
        {requests.map((item) => <li className="dashboard-row" key={item.id}>
          <div className="dashboard-row-head">
            <strong className="name">{item.employeeName}</strong>
            <span className="badge pending">Pending</span>
          </div>
          <p className="dashboard-meta">{item.leaveType} · {item.totalDays} days</p>
          <p>{formatDate(item.startDate)} – {formatDate(item.endDate)}</p>
          <p className="reason">{item.reason || 'No reason provided'}</p>
          <label>Review comments
            <textarea maxLength={2000} value={comments[item.id] || ''}
              onChange={(event) => setComments((previous) => ({ ...previous, [item.id]: event.target.value }))} />
          </label>
          <div className="dashboard-actions">
            <button disabled={busy !== null} onClick={() => reviewRequest(item.id, 'APPROVED')}>Approve</button>
            <button className="ghost" disabled={busy !== null} onClick={() => reviewRequest(item.id, 'REJECTED')}>Reject</button>
          </div>
        </li>)}
      </ul> : <p className="empty">No pending requests assigned to you.</p>}
    </section>
  </>
}
