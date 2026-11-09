import { useMemo, useState } from 'react'
import { employees } from '../data/mock'

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export default function EmployeesPage({ currentUser }) {
  const [query, setQuery] = useState('')

  const visibleEmployees = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return employees
    }

    return employees.filter((employee) =>
      [
        employee.employeeNumber,
        employee.fullName,
        employee.email,
        employee.department,
        employee.jobTitle,
        employee.manager ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [query])

  const activeCount = employees.filter((employee) => employee.isActive).length

  return (
    <>
      <div className="page-heading">
        <h1>Employees</h1>
      </div>

      <section className="summary">
        <article>
          <span>People</span>
          <strong>{employees.length}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <span>Inactive</span>
          <strong>{employees.length - activeCount}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Directory</h2>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or department"
            aria-label="Search employees"
          />
        </div>

        {visibleEmployees.length === 0 ? (
          <p className="empty">No employees match that search.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Job title</th>
                  <th>Manager</th>
                  <th>Hired</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr
                    key={employee.employeeId}
                    className={employee.employeeId === currentUser.employeeId ? 'is-current' : undefined}
                  >
                    <td>{employee.employeeNumber}</td>
                    <td>
                      <span className="name">{employee.fullName}</span>
                      <span className="role">{employee.role}</span>
                    </td>
                    <td>{employee.email}</td>
                    <td>{employee.department}</td>
                    <td>{employee.jobTitle}</td>
                    <td>{employee.manager ?? '—'}</td>
                    <td>{formatDate(employee.hireDate)}</td>
                    <td>
                      <span className={employee.isActive ? 'badge active' : 'badge inactive'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
