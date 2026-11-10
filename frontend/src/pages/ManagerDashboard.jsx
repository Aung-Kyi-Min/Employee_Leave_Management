import { useState } from 'react'
import DashboardSummary from '../components/DashboardSummary'
import { employees, leaveTypes, seedLeaveRequests } from '../data/mock'
import { formatDate, statusLabel } from '../format'

const sampleTeam = employees.filter((employee) => employee.manager === 'Aung Kyi Min')
const sampleRequests = seedLeaveRequests.filter((request) =>
  sampleTeam.some((employee) => employee.employeeId === request.employeeId),
)
const filters = ['PENDING', 'ALL', 'APPROVED', 'REJECTED', 'CANCELLED']

export default function ManagerDashboard() {
  const [requests, setRequests] = useState(sampleRequests)
  const [filter, setFilter] = useState('PENDING')
  const [feedback, setFeedback] = useState('')
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length
  const approvedCount = requests.filter((request) => request.status === 'APPROVED').length
  const visibleRequests = filter === 'ALL' ? requests : requests.filter((request) => request.status === filter)

  function reviewRequest(requestId, status) {
    setRequests((previous) => previous.map((request) =>
      request.requestId === requestId && request.status === 'PENDING' ? { ...request, status } : request,
    ))
    setFeedback(`Sample request ${statusLabel(status).toLowerCase()}.`)
  }

  return (
    <>
      <div className="page-heading">
        <div className="dashboard-title">
          <h1>Manager dashboard</h1>
          <span className="badge dashboard-demo">Demo data</span>
        </div>
        <p className="lede">Review sample team leave requests. Demo decisions reset when you leave this dashboard.</p>
      </div>

      <DashboardSummary label="Sample team overview" metrics={[
        { title: 'Team members', value: sampleTeam.length, note: 'Sample direct reports' },
        { title: 'Pending requests', value: pendingCount, note: 'Awaiting review' },
        { title: 'Approved requests', value: approvedCount, note: 'In the sample history' },
      ]} />

      <div className="dashboard-layout">
        <section className="panel" aria-labelledby="team-requests">
          <h2 id="team-requests">Team requests</h2>
          <div className="filters dashboard-filters" role="group" aria-label="Filter team requests by status">
            {filters.map((status) => (
              <button
                key={status}
                type="button"
                className={filter === status ? 'chip active' : 'chip'}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>

          {feedback && <p className="form-success dashboard-feedback" role="status">{feedback}</p>}
          {visibleRequests.length ? (
            <ul className="dashboard-list">
              {visibleRequests.map((request) => {
                const employee = sampleTeam.find((person) => person.employeeId === request.employeeId)
                const type = leaveTypes.find((item) => item.leaveTypeId === request.leaveTypeId)

                return (
                  <li className="dashboard-row" key={request.requestId}>
                    <div className="dashboard-row-head">
                      <div>
                        <strong className="name">{employee.fullName}</strong>
                        <p className="dashboard-meta">{type?.leaveName ?? 'Leave'} · {request.totalDays} {request.totalDays === 1 ? 'day' : 'days'}</p>
                      </div>
                      <span className={`badge ${request.status.toLowerCase()}`}>{statusLabel(request.status)}</span>
                    </div>
                    <p className="dashboard-request-dates">
                      <time dateTime={request.startDate}>{formatDate(request.startDate)}</time>
                      {request.endDate !== request.startDate && (
                        <> – <time dateTime={request.endDate}>{formatDate(request.endDate)}</time></>
                      )}
                    </p>
                    <p className="dashboard-meta">Reason · {request.reason}</p>
                    {request.status === 'PENDING' && (
                      <div className="dashboard-actions">
                        <button type="button" onClick={() => reviewRequest(request.requestId, 'APPROVED')}>Approve</button>
                        <button type="button" className="ghost" onClick={() => reviewRequest(request.requestId, 'REJECTED')}>Reject</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : <p className="empty">No sample requests in this view.</p>}
        </section>

        <section className="panel" aria-labelledby="team-members">
          <h2 id="team-members">Direct reports</h2>
          <ul className="dashboard-list">
            {sampleTeam.map((employee) => (
              <li className="dashboard-row" key={employee.employeeId}>
                <strong className="name">{employee.fullName}</strong>
                <p className="dashboard-meta">{employee.jobTitle} · {employee.department}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
