import { useEffect, useState } from 'react'
import { employeeApi } from '../api/client'
import DashboardSummary from '../components/DashboardSummary'

const previewSize = 5

export default function AdminDashboard({ onOpenDirectory }) {
  const [directory, setDirectory] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      employeeApi.list(0, controller.signal),
      employeeApi.departments(controller.signal),
    ])
      .then(([employees, departments]) => {
        if (!controller.signal.aborted) setDirectory({ employees, departments })
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message)
      })
    return () => controller.abort()
  }, [attempt])

  const employees = directory?.employees ?? []
  const departments = directory?.departments ?? []
  const activeCount = employees.filter((employee) => employee.active).length
  const preview = employees.slice(0, previewSize)

  return (
    <>
      <div className="page-heading">
        <h1>Admin dashboard</h1>
        <p className="lede">See employee status and department coverage at a glance.</p>
      </div>

      {directory ? (
        <>
          <DashboardSummary label="Workforce overview" metrics={[
            { title: 'Employee records', value: employees.length, note: 'On the first directory page' },
            { title: 'Active employees', value: activeCount, note: `${employees.length - activeCount} inactive on that page` },
            { title: 'Departments', value: departments.length, note: 'Across the organization' },
          ]} />

          <div className="dashboard-layout">
            <section className="panel" aria-labelledby="directory-preview">
              <div className="panel-head">
                <h2 id="directory-preview">Directory preview</h2>
                <button type="button" className="ghost dashboard-button" onClick={onOpenDirectory}>Open directory</button>
              </div>
              {preview.length ? (
                <>
                  <p className="dashboard-meta">Showing {preview.length} of {employees.length} employees from the first page.</p>
                  <ul className="dashboard-list">
                    {preview.map((employee) => {
                      const department = departments.find((item) => item.id === employee.departmentId)
                      const departmentName = department?.name ?? `Department #${employee.departmentId}`

                      return (
                        <li className="dashboard-row dashboard-row-head" key={employee.id}>
                          <div>
                            <strong className="name">{employee.fullName}</strong>
                            <p className="dashboard-meta">{[employee.jobTitle, departmentName].filter(Boolean).join(' · ')}</p>
                          </div>
                          <span className={employee.active ? 'badge active' : 'badge inactive'}>
                            {employee.active ? 'Active' : 'Inactive'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : <p className="empty">No employees are available in the directory.</p>}
            </section>

            <section className="panel" aria-labelledby="admin-departments">
              <h2 id="admin-departments">Departments</h2>
              <p className="dashboard-meta dashboard-subheading">Employee counts from the first directory page.</p>
              {departments.length ? (
                <ul className="dashboard-list">
                  {departments.map((department) => (
                    <li className="dashboard-row dashboard-row-head" key={department.id}>
                      <strong className="name">{department.name}</strong>
                      <span className="badge dashboard-demo">{employees.filter((employee) => employee.departmentId === department.id).length}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty">No departments are available.</p>}
            </section>
          </div>
        </>
      ) : (
        <section className="panel dashboard-message" aria-label="Dashboard status">
          {error ? (
            <>
              <p className="form-error" role="alert">{error}</p>
              <button type="button" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Retry</button>
            </>
          ) : <p role="status">Loading workforce overview…</p>}
        </section>
      )}
    </>
  )
}
