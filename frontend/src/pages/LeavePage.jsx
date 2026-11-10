import { useMemo, useState } from 'react'
import {
  countWeekdays,
  leaveTypes,
  loadLeaveRequests,
  saveLeaveRequests,
} from '../data/mock'
import { formatDate, statusLabel } from '../format'

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']
const CURRENT_YEAR = new Date().getFullYear()

function timestamp() {
  return new Date().toISOString()
}

function formatSubmitted(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function rangesOverlap(startDate, endDate, request) {
  return startDate <= request.endDate && request.startDate <= endDate
}

export default function LeavePage({ currentUser }) {
  const [requests, setRequests] = useState(loadLeaveRequests)
  const [leaveTypeId, setLeaveTypeId] = useState(String(leaveTypes[0].leaveTypeId))
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const year = CURRENT_YEAR
  const selectedType = leaveTypes.find((type) => String(type.leaveTypeId) === leaveTypeId)
  const totalDays = startDate && endDate ? countWeekdays(startDate, endDate) : 0

  const myRequests = useMemo(
    () =>
      requests
        .filter((request) => request.employeeId === currentUser.employeeId)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
    [requests, currentUser.employeeId],
  )

  const visibleRequests =
    statusFilter === 'ALL'
      ? myRequests
      : myRequests.filter((request) => request.status === statusFilter)

  const balances = leaveTypes.map((type) => {
    const mine = myRequests.filter(
      (request) => request.leaveTypeId === type.leaveTypeId && request.startDate.startsWith(String(year)),
    )
    const used = mine
      .filter((request) => request.status === 'APPROVED')
      .reduce((sum, request) => sum + request.totalDays, 0)
    const pending = mine
      .filter((request) => request.status === 'PENDING')
      .reduce((sum, request) => sum + request.totalDays, 0)
    const remaining = type.isPaid ? type.entitledDays - used - pending : null
    return { ...type, used, pending, remaining }
  })

  function updateRequests(next) {
    setRequests(next)
    saveLeaveRequests(next)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSuccess('')

    if (!selectedType) {
      setError('Choose a leave type.')
      return
    }

    if (!startDate || !endDate) {
      setError('Choose a start and end date.')
      return
    }

    if (endDate < startDate) {
      setError('End date must be on or after the start date.')
      return
    }

    if (totalDays === 0) {
      setError('That range has no working days.')
      return
    }

    if (totalDays > 30) {
      setError('A request can cover at most 30 working days.')
      return
    }

    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) {
      setError('Add a short reason.')
      return
    }

    const balance = balances.find((item) => item.leaveTypeId === selectedType.leaveTypeId)
    if (selectedType.isPaid && totalDays > balance.remaining) {
      const dayLabel = balance.remaining === 1 ? 'day' : 'days'
      setError(
        `Only ${balance.remaining} ${selectedType.leaveName.toLowerCase()} ${dayLabel} remain this year, including pending requests.`,
      )
      return
    }

    const overlap = myRequests.some(
      (request) =>
        (request.status === 'PENDING' || request.status === 'APPROVED') &&
        rangesOverlap(startDate, endDate, request),
    )
    if (overlap) {
      setError('Those dates overlap a pending or approved request.')
      return
    }

    const requestId = requests.reduce((max, request) => Math.max(max, request.requestId), 0) + 1
    updateRequests([
      {
        requestId,
        employeeId: currentUser.employeeId,
        leaveTypeId: selectedType.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: trimmedReason,
        status: 'PENDING',
        submittedAt: timestamp(),
      },
      ...requests,
    ])
    setStartDate('')
    setEndDate('')
    setReason('')
    setError('')
    setSuccess('Leave request submitted and is pending review.')
    setStatusFilter('ALL')
  }

  function cancelRequest(requestId) {
    updateRequests(
      requests.map((request) =>
        request.requestId === requestId ? { ...request, status: 'CANCELLED' } : request,
      ),
    )
    setSuccess('Pending request cancelled.')
    setError('')
  }

  const reviewer = currentUser.manager ?? 'HR'

  return (
    <>
      <div className="page-heading">
        <h1>Leave</h1>
        <p className="lede">
          Apply for time away. Requests go to {reviewer} and stay in this browser until you clear site data.
        </p>
      </div>

      <section className="summary balances" aria-label={`${year} leave balances`}>
        {balances.map((balance) => (
          <article key={balance.leaveTypeId}>
            <span>{balance.leaveName}</span>
            <strong>
              {balance.isPaid ? (
                <>{balance.remaining} <span className="balance-unit">{balance.remaining === 1 ? 'day left' : 'days left'}</span></>
              ) : 'Open'}
            </strong>
            <small>
              {balance.isPaid
                ? `${balance.used} used · ${balance.pending} pending`
                : 'No yearly cap'}
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
            <label>
              Leave type
              <select value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)}>
                {leaveTypes.map((type) => (
                  <option key={type.leaveTypeId} value={type.leaveTypeId}>
                    {type.leaveName}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label>
                End date
                <input
                  type="date"
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
                maxLength={500}
                placeholder="Why you need this leave"
                required
              />
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {success ? <p className="form-success" role="status">{success}</p> : null}
            <button type="submit">Submit request</button>
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
                    const type = leaveTypes.find((item) => item.leaveTypeId === request.leaveTypeId)
                    return (
                      <tr key={request.requestId}>
                        <td>{type?.leaveName ?? 'Leave'}</td>
                        <td>
                          {formatDate(request.startDate)}
                          {request.endDate === request.startDate ? '' : ` – ${formatDate(request.endDate)}`}
                        </td>
                        <td>{request.totalDays}</td>
                        <td className="reason">{request.reason}</td>
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
                              onClick={() => cancelRequest(request.requestId)}
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
