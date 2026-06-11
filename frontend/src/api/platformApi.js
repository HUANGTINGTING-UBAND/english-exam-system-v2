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

export const createTeacherClassroom = async (classroomData) => {
  const response = await fetch(`${API_BASE_URL}/teacher/classrooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(classroomData),
  })

  return parseResponse(response, '创建班级失败')
}

export const getTeacherClassrooms = async () => {
  const response = await fetch(`${API_BASE_URL}/teacher/classrooms`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取教师班级失败')
}

export const getTeacherClassroomStudents = async (classroomId) => {
  const response = await fetch(`${API_BASE_URL}/teacher/classrooms/${classroomId}/students`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取班级学生失败')
}

export const joinClassroomByInviteCode = async (inviteCode) => {
  const response = await fetch(`${API_BASE_URL}/student/classrooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      inviteCode,
    }),
  })

  return parseResponse(response, '加入班级失败')
}

export const getStudentClassrooms = async () => {
  const response = await fetch(`${API_BASE_URL}/student/classrooms`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取我的班级失败')
}

export const createTeacherAssignment = async (assignmentData) => {
  const response = await fetch(`${API_BASE_URL}/teacher/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(assignmentData),
  })

  return parseResponse(response, '发布班级任务失败')
}

export const getTeacherAssignments = async () => {
  const response = await fetch(`${API_BASE_URL}/teacher/assignments`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取教师任务失败')
}

export const getTeacherAssignmentSubmissions = async (assignmentId) => {
  const response = await fetch(`${API_BASE_URL}/teacher/assignments/${assignmentId}/submissions`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取任务提交情况失败')
}

export const getStudentAssignments = async () => {
  const response = await fetch(`${API_BASE_URL}/student/assignments`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取我的班级任务失败')
}

export const createImportJob = async (jobData) => {
  if (jobData.file) {
    const formData = new FormData()

    formData.append('file', jobData.file)
    formData.append('title', jobData.title || '')
    formData.append('gradeLevel', jobData.gradeLevel || '')
    formData.append('sourceType', jobData.sourceType || 'file')

    const response = await fetch(`${API_BASE_URL}/import/jobs`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    })

    return parseResponse(response, '创建导入草稿失败')
  }

  const response = await fetch(`${API_BASE_URL}/import/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(jobData),
  })

  return parseResponse(response, '创建导入草稿失败')
}

export const getImportJobs = async () => {
  const response = await fetch(`${API_BASE_URL}/import/jobs`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取导入草稿失败')
}

export const getImportJob = async (jobId) => {
  const response = await fetch(`${API_BASE_URL}/import/jobs/${jobId}`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取导入草稿详情失败')
}

export const updateImportDraftQuestion = async (jobId, questionId, questionData) => {
  const response = await fetch(`${API_BASE_URL}/import/jobs/${jobId}/draft-questions/${questionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(questionData),
  })

  return parseResponse(response, '更新草稿题目失败')
}

export const updateImportDraftMaterial = async (jobId, materialId, materialData) => {
  const response = await fetch(`${API_BASE_URL}/import/jobs/${jobId}/draft-materials/${materialId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(materialData),
  })

  return parseResponse(response, '更新草稿材料失败')
}

export const resolveImportWarning = async (jobId, warningId) => {
  const response = await fetch(`${API_BASE_URL}/import/jobs/${jobId}/warnings/${warningId}/resolve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '处理 warning 失败')
}

export const confirmImportJob = async (jobId, confirmData = {}) => {
  const response = await fetch(`${API_BASE_URL}/import/jobs/${jobId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(confirmData),
  })

  return parseResponse(response, '确认入库失败')
}

export const createSkill = async (skillData) => {
  const response = await fetch(`${API_BASE_URL}/skills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(skillData),
  })

  return parseResponse(response, '创建 Skill 失败')
}

export const getSkills = async () => {
  const response = await fetch(`${API_BASE_URL}/skills`, {
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '获取 Skill 列表失败')
}

export const activateSkill = async (skillId) => {
  const response = await fetch(`${API_BASE_URL}/skills/${skillId}/activate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '启用 Skill 失败')
}

export const deactivateSkill = async (skillId) => {
  const response = await fetch(`${API_BASE_URL}/skills/${skillId}/deactivate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  })

  return parseResponse(response, '停用 Skill 失败')
}
