const TOKEN_KEY = 'elm-access-token'

export const session = {
  token: () => sessionStorage.getItem(TOKEN_KEY),
  save: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem('elm-session')
  },
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const token = session.token()
  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Cannot reach the server. Please try again.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && path !== '/auth/login') {
      session.clear()
      window.dispatchEvent(new Event('elm-session-expired'))
    }
    const error = new Error(response.status === 403
      ? 'You do not have permission to view this resource.'
      : data.message || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return response.status === 204 ? null : response.json()
}

export const employeeApi = {
  me: (signal) => request('/auth/me', { signal }),
  list: (page = 0, signal) => request(`/employees?page=${page}&size=20`, { signal }),
  departments: (signal) => request('/departments', { signal }),
}

export const leaveApi = {
  types: (signal) => request('/leave-types', { signal }),
  balances: (year, signal) => request(`/leave-balances?year=${year}`, { signal }),
  mine: (signal) => request('/leave-requests', { signal }),
  assigned: (signal) => request('/leave-requests/assigned', { signal }),
  create: (body) => request('/leave-requests', { method: 'POST', body }),
  cancel: (id) => request(`/leave-requests/${id}/cancel`, { method: 'POST' }),
  decide: (id, decision, comments) => request(`/leave-requests/${id}/decision`, {
    method: 'POST', body: { decision, comments },
  }),
}
