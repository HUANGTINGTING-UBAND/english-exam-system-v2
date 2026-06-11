import { notifyAuthExpired } from './authApi'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

const parseResponse = async (response, defaultErrorMessage) => {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    console.error('Non-JSON response:', text)

    throw new Error('服务器返回的不是 JSON，请检查 API 地址是否正确')
  }

  const result = await response.json()

  if (!response.ok) {
    const message = result.message || defaultErrorMessage || '请求失败'

    if (response.status === 401) {
      notifyAuthExpired(message || '登录状态已过期，请重新登录')
    }

    if (response.status === 403) {
      throw new Error(message || '你没有权限执行该操作')
    }

    throw new Error(message)
  }

  return result.data
}

export const getExams = async (params = {}) => {
  const searchParams = new URLSearchParams()

  if (typeof params === 'string') {
    if (params) {
      searchParams.set('grade', params)
    }
  } else {
    if (params.group) {
      searchParams.set('group', params.group)
    }

    if (params.grade) {
      searchParams.set('grade', params.grade)
    }
  }

  const query = searchParams.toString()
  const response = await fetch(`${API_BASE_URL}/exams${query ? `?${query}` : ''}`)

  return parseResponse(response, '获取试卷列表失败')
}

export const getExamById = async (examId) => {
  const response = await fetch(`${API_BASE_URL}/exams/${examId}`)

  return parseResponse(response, '获取试卷详情失败')
}

export const getQuestionsByExamId = async (examId) => {
  const response = await fetch(`${API_BASE_URL}/exams/${examId}/questions`)

  return parseResponse(response, '获取题目列表失败')
}

export const submitExamAttempt = async (attemptData) => {
  const response = await fetch(`${API_BASE_URL}/attempts/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(attemptData),
  })

  return parseResponse(response, '提交考试结果失败')
}

export const getAttemptHistory = async () => {
  const response = await fetch(`${API_BASE_URL}/attempts/history`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取考试历史失败')
}

export const getAttemptDetail = async (attemptId) => {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/detail`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取考试结果详情失败')
}

export const deleteAttemptHistory = async (attemptId) => {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '删除考试记录失败')
}

export const deleteExamAttempt = async (attemptId) => {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '删除考试记录失败')
}

export const saveWrongQuestions = async (wrongQuestionData) => {
  const response = await fetch(`${API_BASE_URL}/wrong-questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(wrongQuestionData),
  })

  return parseResponse(response, '保存错题失败')
}

export const getWrongQuestions = async () => {
  const response = await fetch(`${API_BASE_URL}/wrong-questions`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取错题本失败')
}

export const getWrongQuestionPractice = async (wrongQuestionId) => {
  const response = await fetch(`${API_BASE_URL}/wrong-questions/${wrongQuestionId}/practice`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取错题练习详情失败')
}

export const markWrongQuestionMastered = async (wrongQuestionId) => {
  const response = await fetch(`${API_BASE_URL}/wrong-questions/${wrongQuestionId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '标记错题已掌握失败')
}

export const getAdminExams = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/exams`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取管理员试卷列表失败')
}

export const getAdminAttempts = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/attempts`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取管理员考试记录失败')
}

export const createAdminExam = async (examData) => {
  const response = await fetch(`${API_BASE_URL}/admin/exams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(examData),
  })

  return parseResponse(response, '创建试卷失败')
}

export const updateAdminExam = async (examId, examData) => {
  const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(examData),
  })

  return parseResponse(response, '更新试卷失败')
}

export const deleteAdminExam = async (examId) => {
  const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '删除试卷失败')
}

export const updateAdminExamPublishStatus = async (examId, isPublished) => {
  const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/publish`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      isPublished,
    }),
  })

  return parseResponse(response, '更新试卷发布状态失败')
}

export const getAdminExamQuestions = async (examId) => {
  const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/questions`, {
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '获取管理员题目列表失败')
}

export const updateAdminQuestion = async (questionId, questionData) => {
  const response = await fetch(`${API_BASE_URL}/admin/questions/${questionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(questionData),
  })

  return parseResponse(response, '更新题目失败')
}

export const deleteAdminQuestion = async (questionId) => {
  const response = await fetch(`${API_BASE_URL}/admin/questions/${questionId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  })

  return parseResponse(response, '删除题目失败')
}

export const parseQuestionFile = async ({
  paperFile,
  analysisFile,
  audioFile,
  transcriptFile,
  examType,
}) => {
  const formData = new FormData()

  formData.append('paperFile', paperFile)

  if (analysisFile) {
    formData.append('analysisFile', analysisFile)
  }

  if (audioFile) {
    formData.append('audioFile', audioFile)
  }

  if (transcriptFile) {
    formData.append('transcriptFile', transcriptFile)
  }

  if (examType) {
    formData.append('examType', examType)
  }

  const response = await fetch(`${API_BASE_URL}/admin/import/prepare`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })

  return parseResponse(response)
}

export const importQuestionsToExam = async (examId, questions) => {
  const response = await fetch(`${API_BASE_URL}/admin/exams/${examId}/import-questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      questions,
    }),
  })

  return parseResponse(response, '批量导入题目失败')
}
