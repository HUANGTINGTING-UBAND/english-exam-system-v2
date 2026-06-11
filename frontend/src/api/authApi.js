const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const clearAuthData = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('currentUser')
}

export const notifyAuthExpired = (message = '登录状态已过期，请重新登录') => {
  clearAuthData()

  window.dispatchEvent(
    new CustomEvent('auth-expired', {
      detail: {
        message,
      },
    })
  )
}

const parseResponse = async (response, defaultErrorMessage = '请求失败') => {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    console.error('Non-JSON response:', text)

    throw new Error('服务器返回的不是 JSON，请检查 API 地址是否正确')
  }

  const result = await response.json()

  if (!response.ok) {
    const message = result.message || defaultErrorMessage

    if (response.status === 401) {
      notifyAuthExpired(message || '登录状态已过期，请重新登录')
    }

    throw new Error(message)
  }

  return result.data
}

export const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  })

  return parseResponse(response, '注册失败')
}

export const loginUser = async (loginData) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(loginData),
  })

  return parseResponse(response, '登录失败')
}

export const getCurrentUser = async () => {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('未登录')
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return parseResponse(response, '获取当前用户失败')
}

export const saveAuthData = ({ token, user }) => {
  localStorage.setItem('token', token)
  localStorage.setItem('currentUser', JSON.stringify(user))
}

export const getSavedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null')
  } catch (error) {
    console.error('Parse saved user error:', error)
    clearAuthData()
    return null
  }
}

export const logoutUser = () => {
  clearAuthData()
}
