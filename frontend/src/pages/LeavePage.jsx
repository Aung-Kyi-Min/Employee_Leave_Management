import { useCallback, useEffect, useState } from 'react'
import { leaveApi } from '../api/client'
import { formatDate, statusLabel } from '../format'

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const CURRENT_YEAR = Number(TODAY.slice(0, 4))

function countWeekdays(start, end) {
  let days = 0
  for (const date = new Date(`${start}T00:00:00Z`); date <= new Date(`${end}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days++
  }
  return days
}

function formatSubmitted(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function LeavePage() {
  const [requests, setRequests] = useState([])
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [leaveTypes, setLeaveTypes] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const year = startDate ? Number(startDate.slice(0, 4)) : CURRENT_YEAR
  const totalDays = startDate && endDate ? countWeekdays(startDate, endDate) : 0

  const refresh = useCallback(async (signal) => {
    const [types, mine, balanceRows] = await Promise.all([
      leaveApi.types(signal), leaveApi.mine(signal), leaveApi.balances(year, signal),
    ])
    if (signal?.aborted) return
    setLeaveTypes(types)
    setRequests(mine)
    setBalances(balanceRows)
    setLeaveTypeId((previous) => previous || String(types[0]?.id ?? ''))
  }, [year])

  useEffect(() => {
    const controller = new AbortController()
    // State updates inside refresh run after the API responses arrive.
    // oxlint-disable-next-line react/set-state-in-effect
    refresh(controller.signal).catch((err) => {
      if (err.name !== 'AbortError') setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh, attempt])

  const visibleRequests = statusFilter === 'ALL' ? requests : requests.filter((item) => item.status === statusFilter)

  async function handleSubmit(event) {
    event.preventDefault()
    setSuccess('')
    setError('')
    if (startDate < TODAY || endDate < startDate || startDate.slice(0, 4) !== endDate.slice(0, 4) || totalDays < 1) {
      setError('Choose dates from today within one calendar year, including at least one weekday.')
      return
    }
    setBusy(true)
    try {
      const created = await leaveApi.create({ leaveTypeId: Number(leaveTypeId), startDate, endDate, reason: reason.trim() })
      setSuccess(created.status === 'APPROVED' ? 'Leave request automatically approved.' : 'Leave request submitted for review.')
      setReason('')
      setStatusFilter('ALL')
      await refresh()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function cancelRequest(id) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await leaveApi.cancel(id)
      setSuccess('Pending request cancelled.')
      await refresh()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-heading">
        <h1>Leave</h1>
        <p className="lede">
          Apply for time away and track your requests and yearly balances.
        </p>
      </div>

      {loading && <p role="status">Loading leave data…</p>}
      {error && <p className="form-error" role="alert">{error} <button type="button" onClick={() => { setLoading(true); setError(''); setAttempt((value) => value + 1) }}>Reload</button></p>}
      {!loading && balances.length === 0 && <p className="empty">No leave balances allocated for {year}. Contact your administrator.</p>}
      <section className="summary balances" aria-label={`${year} leave balances`}>
        {balances.map((balance) => (
          <article key={balance.leaveTypeId}>
            <span>{balance.leaveType}</span>
            <strong>
              {balance.availableDays} <span className="balance-unit">{balance.availableDays === 1 ? 'day left' : 'days left'}</span>
            </strong>
            <small>
              {balance.usedDays} used · {balance.pendingDays} pending
            </small>
          </article>
        ))}
      </section>

      <div className="leave-layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Request leave</h2>
          </div>
          <form className="leave-form" onSubmit={handleSubmit}>
            <fieldset disabled={busy || loading} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
            <label>
              Leave type
              <select value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)}>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Start date
                <input
                  type="date"
                  min={TODAY}
                  value={startDate}
                  onChange={(event) => { if ((Number(event.target.value.slice(0, 4)) || CURRENT_YEAR) !== year) setLoading(true); setStartDate(event.target.value) }}
                  required
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  min={startDate || TODAY}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
            </div>
            <p className="days-preview">
              {startDate && endDate
                ? `${totalDays} working ${totalDays === 1 ? 'day' : 'days'}`
                : 'Working days exclude weekends.'}
            </p>
            <label>
              Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
                placeholder="Why you need this leave (optional)"
              />
            </label>

            {success ? <p className="form-success" role="status">{success}</p> : null}
            <button type="submit" disabled={busy || loading || !leaveTypeId}>{busy ? 'Saving…' : 'Submit request'}</button>
            </fieldset>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 id="leave-history">History</h2>
            <div className="filters" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={statusFilter === status ? 'chip active' : 'chip'}
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'ALL' ? 'All' : statusLabel(status)}
                </button>
              ))}
            </div>
          </div>

          {visibleRequests.length === 0 ? (
            <p className="empty">No leave requests in this view.</p>
          ) : (
            <div className="table-wrap" role="region" aria-labelledby="leave-history" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.map((request) => {
                    const type = leaveTypes.find((item) => item.id === request.leaveTypeId)
                    return (
                      <tr key={request.id}>
                        <td>{request.leaveType || type?.name || 'Leave'}</td>
                        <td>
                          {formatDate(request.startDate)}
                          {request.endDate === request.startDate ? '' : ` – ${formatDate(request.endDate)}`}
                        </td>
                        <td>{request.totalDays}</td>
                        <td className="reason">{request.reason || '—'}{request.approvalComments && <small> · Reviewer: {request.approvalComments}</small>}</td>
                        <td>{formatSubmitted(request.submittedAt)}</td>
                        <td>
                          <span className={`badge ${request.status.toLowerCase()}`}>
                            {statusLabel(request.status)}
                          </span>
                        </td>
                        <td>
                          {request.status === 'PENDING' ? (
                            <button
                              type="button"
                              className="ghost"
                              disabled={busy}
                              onClick={() => cancelRequest(request.id)}
                            >
                              Cancel
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
