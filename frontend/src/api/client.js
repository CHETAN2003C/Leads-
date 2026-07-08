const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')[1]
}

async function request(path, options = {}) {
  const { body, headers = {}, method = 'GET', ...rest } = options
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(method !== 'GET' && method !== 'HEAD' ? { 'X-CSRFToken': getCookie('csrftoken') || '' } : {}),
      ...headers,
    },
    body,
    ...rest,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = payload.detail || payload.error || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function bootstrapSession() {
  return request('/auth/csrf/')
}

export async function getCurrentUser() {
  try {
    return await request('/auth/me/')
  } catch (error) {
    if (error.status === 403 || error.status === 401) {
      return null
    }
    throw error
  }
}

export function login(username, password) {
  return request('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return request('/auth/logout/', {
    method: 'POST',
  })
}

export function getDashboardSummary() {
  return request('/dashboard/summary/')
}

export function listUploads() {
  return request('/uploads/csv/')
}

export function listLeads() {
  return request('/leads/')
}

export function generateCopilot(leadId) {
  return request(`/leads/${leadId}/copilot/`, {
    method: 'POST',
  })
}

export function predictLead(leadId) {
  return request(`/leads/${leadId}/predict/`, {
    method: 'POST',
  })
}

export function refreshLeadRecommendations(leadId) {
  return request(`/leads/${leadId}/recommendations/`, {
    method: 'POST',
  })
}

export function updateLeadStatus(leadId, status) {
  return request(`/leads/${leadId}/status/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function uploadCsv(file) {
  const formData = new FormData()
  formData.append('file', file)

  return request('/uploads/csv/', {
    method: 'POST',
    body: formData,
  })
}
