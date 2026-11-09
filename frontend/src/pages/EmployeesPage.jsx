import { useEffect, useMemo, useState } from 'react'
import { employeeApi } from '../api/client'

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export default function EmployeesPage({ currentUser }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [departments, setDepartments] = useState([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const isAdmin = currentUser.roles.includes('ADMIN')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      setRows([])
      try {
        if (isAdmin) {
          const [people, teams] = await Promise.all([
            employeeApi.list(page, controller.signal),
            employeeApi.departments(controller.signal),
          ])
          if (!controller.signal.aborted) {
            setRows(people)
            setDepartments(teams)
          }
        } else {
          setRows([currentUser])
        }
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [currentUser, isAdmin, page, attempt])

  const employees = rows.map((employee) => ({
    ...employee,
    employeeId: employee.id,
    isActive: employee.active,
    role: employee.roles.join(', '),
    department: departments.find((d) => d.id === employee.departmentId)?.name
      ?? `Department #${employee.departmentId}`,
    manager: employee.managerId == null ? null
      : rows.find((person) => person.id === employee.managerId)?.fullName
        ?? `Employee #${employee.managerId}`,
  }))

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
  }, [query, employees])

  const activeCount = employees.filter((employee) => employee.isActive).length

  return (
    <>
      <div className="page-heading">
        <h1>{isAdmin ? 'Employees' : 'My profile'}</h1>
      </div>

      <section className="summary">
        <article>
          <span>People on this page</span>
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
          <h2>{isAdmin ? 'Directory' : 'Employee details'}</h2>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or department"
            aria-label="Search employees"
          />
        </div>

        {loading ? <p role="status">Loading employees…</p> : error ? (
          <div><p className="form-error" role="alert">{error}</p>
            <button type="button" onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </div>
        ) : visibleEmployees.length === 0 ? (
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
                    className={employee.employeeId === currentUser.id ? 'is-current' : undefined}
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
        {isAdmin && <nav className="pagination" aria-label="Employee pages">
          <button type="button" disabled={loading || page === 0} onClick={() => { setQuery(''); setPage(page - 1) }}>Previous</button>
          <span>Page {page + 1} · Search applies to this page</span>
          <button type="button" disabled={loading || Boolean(error) || rows.length < 20} onClick={() => { setQuery(''); setPage(page + 1) }}>Next</button>
        </nav>}
      </section>
    </>
  )
}
