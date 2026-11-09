export const DEMO_PASSWORD = 'password'

export const employees = [
  {
    employeeId: 1,
    employeeNumber: 'EMP-001',
    fullName: 'Aung Kyi Min',
    email: 'aung@company.com',
    jobTitle: 'Engineering Manager',
    department: 'Engineering',
    manager: null,
    hireDate: '2019-03-11',
    isActive: true,
    role: 'Manager',
  },
  {
    employeeId: 2,
    employeeNumber: 'EMP-014',
    fullName: 'Hla Hla Win',
    email: 'hla@company.com',
    jobTitle: 'People Operations Lead',
    department: 'Human Resources',
    manager: null,
    hireDate: '2018-07-02',
    isActive: true,
    role: 'HR',
  },
  {
    employeeId: 3,
    employeeNumber: 'EMP-028',
    fullName: 'Zay Yar Win Htet',
    email: 'zay@company.com',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    manager: 'Aung Kyi Min',
    hireDate: '2022-01-17',
    isActive: true,
    role: 'Employee',
  },
  {
    employeeId: 4,
    employeeNumber: 'EMP-033',
    fullName: 'Su Su Aung',
    email: 'susu@company.com',
    jobTitle: 'Product Designer',
    department: 'Product',
    manager: 'Aung Kyi Min',
    hireDate: '2021-09-06',
    isActive: true,
    role: 'Employee',
  },
  {
    employeeId: 5,
    employeeNumber: 'EMP-041',
    fullName: 'Min Khant',
    email: 'minkhant@company.com',
    jobTitle: 'Accountant',
    department: 'Finance',
    manager: 'Hla Hla Win',
    hireDate: '2020-11-23',
    isActive: true,
    role: 'Employee',
  },
  {
    employeeId: 6,
    employeeNumber: 'EMP-052',
    fullName: 'Ei Ei Phyo',
    email: 'eiei@company.com',
    jobTitle: 'Support Specialist',
    department: 'Customer Support',
    manager: 'Hla Hla Win',
    hireDate: '2023-04-10',
    isActive: false,
    role: 'Employee',
  },
]

export function findEmployeeByEmail(email) {
  const normalized = email.trim().toLowerCase()
  return employees.find((employee) => employee.email === normalized) ?? null
}

export const leaveTypes = [
  { leaveTypeId: 1, leaveName: 'Annual leave', isPaid: true, entitledDays: 18 },
  { leaveTypeId: 2, leaveName: 'Sick leave', isPaid: true, entitledDays: 10 },
  { leaveTypeId: 3, leaveName: 'Personal leave', isPaid: true, entitledDays: 3 },
  { leaveTypeId: 4, leaveName: 'Unpaid leave', isPaid: false, entitledDays: null },
]

const LEAVE_STORAGE_KEY = 'elm-leave-requests'

export const seedLeaveRequests = [
  {
    requestId: 1,
    employeeId: 3,
    leaveTypeId: 1,
    startDate: '2026-03-16',
    endDate: '2026-03-18',
    totalDays: 3,
    reason: 'Family visit',
    status: 'APPROVED',
    submittedAt: '2026-02-20T09:12:00',
  },
  {
    requestId: 2,
    employeeId: 3,
    leaveTypeId: 2,
    startDate: '2026-06-02',
    endDate: '2026-06-02',
    totalDays: 1,
    reason: 'Medical appointment',
    status: 'PENDING',
    submittedAt: '2026-05-28T14:40:00',
  },
  {
    requestId: 3,
    employeeId: 3,
    leaveTypeId: 1,
    startDate: '2025-12-22',
    endDate: '2025-12-24',
    totalDays: 3,
    reason: 'Year-end break',
    status: 'REJECTED',
    submittedAt: '2025-12-01T11:05:00',
  },
  {
    requestId: 4,
    employeeId: 1,
    leaveTypeId: 1,
    startDate: '2026-04-06',
    endDate: '2026-04-10',
    totalDays: 5,
    reason: 'Travel',
    status: 'APPROVED',
    submittedAt: '2026-03-01T08:30:00',
  },
  {
    requestId: 5,
    employeeId: 4,
    leaveTypeId: 3,
    startDate: '2026-08-14',
    endDate: '2026-08-14',
    totalDays: 1,
    reason: 'Personal errand',
    status: 'CANCELLED',
    submittedAt: '2026-08-01T16:20:00',
  },
  {
    requestId: 6,
    employeeId: 5,
    leaveTypeId: 2,
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    totalDays: 2,
    reason: 'Recovery day',
    status: 'PENDING',
    submittedAt: '2026-09-01T10:00:00',
  },
]

export function loadLeaveRequests() {
  const raw = localStorage.getItem(LEAVE_STORAGE_KEY)
  if (!raw) {
    return seedLeaveRequests.map((request) => ({ ...request }))
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return seedLeaveRequests.map((request) => ({ ...request }))
    }
    return parsed
  } catch {
    return seedLeaveRequests.map((request) => ({ ...request }))
  }
}

export function saveLeaveRequests(requests) {
  localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(requests))
}

export function countWeekdays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }

  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      days += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
