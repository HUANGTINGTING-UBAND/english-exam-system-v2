<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import { examCategoryNameMap, examCategoryOptions } from '../utils/examCategories'
import {
  createAdminExam,
  deleteAdminExam,
  deleteAdminQuestion,
  getAdminExamQuestions,
  getAdminExams,
  importQuestionsToExam,
  parseQuestionFile,
  updateAdminExam,
  updateAdminExamPublishStatus,
  updateAdminQuestion,
} from '../api/examApi'

const currentUser = ref(getSavedUser())

const formatScore = (score) => {
  const value = Number(score || 0)

  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(2)))
}

const isAdmin = computed(() => {
  return currentUser.value?.role === 'ADMIN'
})

const exams = ref([])
const examKeyword = ref('')
const examGradeFilter = ref('ALL')
const examSortType = ref('NEWEST')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const selectedExamId = ref('')
const selectedPaperFile = ref(null)
const selectedAnalysisFile = ref(null)
const selectedAudioFile = ref(null)
const selectedTranscriptFile = ref(null)
const parsedQuestions = ref([])
const parsedFileName = ref('')
const isParsingFile = ref(false)
const isImportingQuestions = ref(false)
const showImportExample = ref(false)

const selectedQuestionExamId = ref('')
const selectedQuestionExamTitle = ref('')
const adminQuestions = ref([])
const questionTypeFilter = ref('ALL')
const questionKeyword = ref('')
const questionSortType = ref('ORDER_ASC')
const isLoadingQuestions = ref(false)

const editingExamId = ref('')
const isUpdatingExam = ref(false)

const editingQuestionId = ref('')
const isUpdatingQuestion = ref(false)

const form = ref({
  title: '',
  gradeLevel: 'JUNIOR',
  description: '',
  timeLimit: 3600,
  totalScore: 0,
  isPublished: true,
})

const editExamForm = ref({
  title: '',
  gradeLevel: 'JUNIOR',
  description: '',
  timeLimit: 3600,
  totalScore: 0,
  isPublished: true,
})

const editQuestionForm = ref({
  type: 'CHOICE',
  text: '',
  optionsText: '',
  answer: '',
  score: 2,
  knowledgePoint: '',
  referenceAnswer: '',
  explanation: '',
  orderIndex: 1,
})

const gradeNameMap = examCategoryNameMap

const typeNameMap = {
  CHOICE: '单选题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

const applyExamPresetToForm = () => {
  if (form.value.gradeLevel === 'CET4') {
    form.value.timeLimit = 7500
  }
}

const filteredExams = computed(() => {
  const keyword = examKeyword.value.trim().toLowerCase()

  const result = exams.value.filter((exam) => {
    const gradeName = gradeNameMap[exam.gradeLevel] || exam.gradeLevel || ''

    const text = [
      exam.title,
      exam.description,
      exam.gradeLevel,
      gradeName,
    ]
      .join(' ')
      .toLowerCase()

    const matchedKeyword = !keyword || text.includes(keyword)

    const matchedGrade =
      examGradeFilter.value === 'ALL' ||
      exam.gradeLevel === examGradeFilter.value

    return matchedKeyword && matchedGrade
  })

  return [...result].sort((a, b) => {
    if (examSortType.value === 'OLDEST') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }

    if (examSortType.value === 'QUESTION_DESC') {
      return Number(b.questionCount || 0) - Number(a.questionCount || 0)
    }

    if (examSortType.value === 'QUESTION_ASC') {
      return Number(a.questionCount || 0) - Number(b.questionCount || 0)
    }

    if (examSortType.value === 'SCORE_DESC') {
      return Number(b.totalScore || 0) - Number(a.totalScore || 0)
    }

    if (examSortType.value === 'SCORE_ASC') {
      return Number(a.totalScore || 0) - Number(b.totalScore || 0)
    }

    if (examSortType.value === 'PUBLISHED_FIRST') {
      return Number(b.isPublished) - Number(a.isPublished)
    }

    if (examSortType.value === 'UNPUBLISHED_FIRST') {
      return Number(a.isPublished) - Number(b.isPublished)
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

const filteredAdminQuestions = computed(() => {
  const keyword = questionKeyword.value.trim().toLowerCase()

  const result = adminQuestions.value.filter((question) => {
    const typeName = typeNameMap[question.type] || question.type || ''

    const text = [
      question.text,
      question.knowledgePoint,
      question.referenceAnswer,
      question.explanation,
      question.answer,
      typeName,
      question.type,
    ]
      .join(' ')
      .toLowerCase()

    const matchedType =
      questionTypeFilter.value === 'ALL' ||
      question.type === questionTypeFilter.value

    const matchedKeyword = !keyword || text.includes(keyword)

    return matchedType && matchedKeyword
  })

  return [...result].sort((a, b) => {
    if (questionSortType.value === 'ORDER_DESC') {
      return Number(b.orderIndex || 0) - Number(a.orderIndex || 0)
    }

    if (questionSortType.value === 'SCORE_DESC') {
      return Number(b.score || 0) - Number(a.score || 0)
    }

    if (questionSortType.value === 'SCORE_ASC') {
      return Number(a.score || 0) - Number(b.score || 0)
    }

    if (questionSortType.value === 'TYPE_ASC') {
      const typeA = typeNameMap[a.type] || a.type || ''
      const typeB = typeNameMap[b.type] || b.type || ''
      return typeA.localeCompare(typeB, 'zh-CN')
    }

    return Number(a.orderIndex || 0) - Number(b.orderIndex || 0)
  })
})

const importExampleText = `【单选题】
1. She ___ to school every day.
A. go
B. goes
C. went
D. going
答案：B
解析：主语 She 是第三人称单数，一般现在时动词要加 s。
知识点：一般现在时
分值：2

【翻译题】
2. 请将下面句子翻译成英文：我喜欢学习英语。
参考答案：I like learning English.
解析：like doing something 表示喜欢做某事。
知识点：翻译
分值：5

【改错题】
3. He go to school yesterday. 请改正。
参考答案：He went to school yesterday.
解析：yesterday 表示过去时间，go 应改为 went。
知识点：一般过去时
分值：5

【写作题】
4. 请以 My Family 为题写一篇不少于 50 词的短文。
参考答案：I have a happy family.
解析：文章应包含家庭成员、人物特点和情感表达。
知识点：写作
分值：10`

const formatTimeLimit = (seconds) => {
  return `${Math.round(Number(seconds || 0) / 60)} 分钟`
}

const formatDateTime = (dateValue) => {
  if (!dateValue) {
    return '暂无'
  }

  return new Date(dateValue).toLocaleString()
}

const formatAnswer = (question) => {
  if (question.answer === null || question.answer === undefined || question.answer === '') {
    return '暂无'
  }

  if (question.type === 'CHOICE' && Array.isArray(question.options)) {
    const index = Number(question.answer)
    const option = question.options[index]

    if (option) {
      return `${String.fromCharCode(65 + index)}. ${option}`
    }
  }

  return String(question.answer)
}

const normalizeChoiceAnswer = (answer) => {
  const text = String(answer || '').trim().toUpperCase()

  const map = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
  }

  if (map[text] !== undefined) {
    return map[text]
  }

  const numberValue = Number(text)

  if (!Number.isNaN(numberValue)) {
    return numberValue
  }

  return answer
}

const optionsArrayToText = (options) => {
  if (!Array.isArray(options)) {
    return ''
  }

  return options.join('\n')
}

const optionsTextToArray = (optionsText) => {
  return String(optionsText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[A-D][\.．、]\s*/i, '').trim())
    .filter(Boolean)
}

const clearExamFilters = () => {
  examKeyword.value = ''
  examGradeFilter.value = 'ALL'
  examSortType.value = 'NEWEST'
}

const clearQuestionFilters = () => {
  questionTypeFilter.value = 'ALL'
  questionKeyword.value = ''
  questionSortType.value = 'ORDER_ASC'
}

const escapeCsvValue = (value) => {
  const text = String(value ?? '')

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

const exportCurrentQuestionsToCsv = () => {
  if (!selectedQuestionExamId.value) {
    window.alert('请先选择一张试卷并查看题目。')
    return
  }

  if (filteredAdminQuestions.value.length === 0) {
    window.alert('当前没有可导出的题目。')
    return
  }

  const headers = [
    '题号',
    '题型',
    '题干',
    '选项',
    '答案',
    '分值',
    '知识点',
    '参考答案',
    '解析',
  ]

  const rows = filteredAdminQuestions.value.map((question) => [
    question.orderIndex ?? '',
    typeNameMap[question.type] || question.type || '',
    question.text || '',
    Array.isArray(question.options) ? question.options.join(' / ') : '',
    formatAnswer(question),
    question.score ?? '',
    question.knowledgePoint || '',
    question.referenceAnswer || '',
    question.explanation || '',
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeTitle = String(selectedQuestionExamTitle.value || '试卷题目')
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 40)
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')

  link.href = url
  link.download = `${safeTitle}-题目导出-${timestamp}.csv`
  link.click()

  URL.revokeObjectURL(url)
}

const loadAdminExams = async () => {
  if (!isAdmin.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    exams.value = await getAdminExams()

    const selectedExamStillExists = exams.value.some(
      (exam) => exam.id === selectedExamId.value
    )

    if (!selectedExamId.value || !selectedExamStillExists) {
      selectedExamId.value = exams.value[0]?.id || ''
    }

    const selectedQuestionExamStillExists = exams.value.some(
      (exam) => exam.id === selectedQuestionExamId.value
    )

    if (selectedQuestionExamId.value && !selectedQuestionExamStillExists) {
      selectedQuestionExamId.value = ''
      selectedQuestionExamTitle.value = ''
      adminQuestions.value = []
      clearQuestionFilters()
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '管理员试卷列表加载失败'
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = {
    title: '',
    gradeLevel: 'JUNIOR',
    description: '',
    timeLimit: 3600,
    totalScore: 0,
    isPublished: true,
  }
}

const handleCreateExam = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.value.title.trim()) {
    errorMessage.value = '请输入试卷标题'
    return
  }

  try {
    const createdExam = await createAdminExam({
      title: form.value.title.trim(),
      gradeLevel: form.value.gradeLevel,
      description: form.value.description.trim(),
      timeLimit: Number(form.value.timeLimit),
      totalScore: 0,
      isPublished: Boolean(form.value.isPublished),
    })

    successMessage.value = '试卷创建成功'
    resetForm()
    await loadAdminExams()
    selectedExamId.value = createdExam.id
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '试卷创建失败'
  }
}

const openEditExam = (exam) => {
  editingExamId.value = exam.id

  editExamForm.value = {
    title: exam.title || '',
    gradeLevel: exam.gradeLevel || 'JUNIOR',
    description: exam.description || '',
    timeLimit: exam.timeLimit || 3600,
    totalScore: exam.totalScore || 0,
    isPublished: Boolean(exam.isPublished),
  }
}

const closeEditExam = () => {
  editingExamId.value = ''

  editExamForm.value = {
    title: '',
    gradeLevel: 'JUNIOR',
    description: '',
    timeLimit: 3600,
    totalScore: 0,
    isPublished: true,
  }
}

const handleUpdateExam = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!editingExamId.value) {
    errorMessage.value = '请先选择要编辑的试卷'
    return
  }

  if (!editExamForm.value.title.trim()) {
    errorMessage.value = '试卷标题不能为空'
    return
  }

  isUpdatingExam.value = true

  try {
    await updateAdminExam(editingExamId.value, {
      title: editExamForm.value.title.trim(),
      gradeLevel: editExamForm.value.gradeLevel,
      description: editExamForm.value.description.trim(),
      timeLimit: Number(editExamForm.value.timeLimit),
      totalScore: Number(editExamForm.value.totalScore),
      isPublished: Boolean(editExamForm.value.isPublished),
    })

    successMessage.value = '试卷更新成功'
    closeEditExam()
    await loadAdminExams()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '试卷更新失败'
  } finally {
    isUpdatingExam.value = false
  }
}

const handleDeleteExam = async (exam) => {
  const confirmed = window.confirm(
    `确认删除试卷《${exam.title}》吗？\n\n删除后，该试卷下的题目、考试记录、用户答案和错题记录都会被删除。此操作不可恢复。`
  )

  if (!confirmed) {
    return
  }

  const secondConfirmed = window.confirm(
    '请再次确认：你真的要删除这张试卷及其所有相关数据吗？'
  )

  if (!secondConfirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteAdminExam(exam.id)

    successMessage.value = '试卷删除成功'

    exams.value = exams.value.filter((item) => item.id !== exam.id)

    if (selectedExamId.value === exam.id) {
      selectedExamId.value = exams.value[0]?.id || ''
      parsedQuestions.value = []
      parsedFileName.value = ''
    }

    if (selectedQuestionExamId.value === exam.id) {
      selectedQuestionExamId.value = ''
      selectedQuestionExamTitle.value = ''
      adminQuestions.value = []
      clearQuestionFilters()
    }

    if (editingExamId.value === exam.id) {
      closeEditExam()
    }

    await loadAdminExams()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '试卷删除失败'
  }
}

const handleTogglePublish = async (exam) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await updateAdminExamPublishStatus(exam.id, !exam.isPublished)

    successMessage.value = exam.isPublished ? '试卷已下架' : '试卷已发布'
    await loadAdminExams()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '试卷发布状态更新失败'
  }
}

const resetParsedImportResult = () => {
  parsedQuestions.value = []
  parsedFileName.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

const handlePaperFileChange = (event) => {
  selectedPaperFile.value = event.target.files?.[0] || null
  resetParsedImportResult()
}

const handleAnalysisFileChange = (event) => {
  selectedAnalysisFile.value = event.target.files?.[0] || null
  resetParsedImportResult()
}

const handleAudioFileChange = (event) => {
  selectedAudioFile.value = event.target.files?.[0] || null
  resetParsedImportResult()
}

const handleTranscriptFileChange = (event) => {
  selectedTranscriptFile.value = event.target.files?.[0] || null
  resetParsedImportResult()
}

const handleParseFile = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!selectedPaperFile.value) {
    errorMessage.value = '请先上传试卷原题文件'
    return
  }

  isParsingFile.value = true

  try {
    const result = await parseQuestionFile({
      paperFile: selectedPaperFile.value,
      analysisFile: selectedAnalysisFile.value,
      audioFile: selectedAudioFile.value,
      transcriptFile: selectedTranscriptFile.value,
      examType: form.value.gradeLevel,
    })

    parsedFileName.value = result.fileName || selectedPaperFile.value.name
    parsedQuestions.value = result.questions || []

    const materialCount = result.materialCount || 0
    const detectedExamType = result.detectedExamType || '未识别'
    const totalScore = result.totalScore || 0
    const timeLimit = result.timeLimit || 0

    successMessage.value = `预处理成功：识别 ${parsedQuestions.value.length} 道题，材料 ${materialCount} 组，考试类型 ${detectedExamType}，预计总分 ${totalScore} 分，预计时间 ${Math.round(timeLimit / 60)} 分钟。`
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '文件预处理失败'
  } finally {
    isParsingFile.value = false
  }
}

const handleImportQuestions = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!selectedExamId.value) {
    errorMessage.value = '请选择要导入题目的试卷'
    return
  }

  if (parsedQuestions.value.length === 0) {
    errorMessage.value = '当前没有可导入的题目'
    return
  }

  const confirmed = window.confirm(
    `确认将 ${parsedQuestions.value.length} 道题导入所选试卷吗？`
  )

  if (!confirmed) {
    return
  }

  isImportingQuestions.value = true

  try {
    const createdQuestions = await importQuestionsToExam(
      selectedExamId.value,
      parsedQuestions.value
    )

    const importedTotalScore = createdQuestions.reduce((sum, question) => {
      return sum + Number(question.score || 0)
    }, 0)

    successMessage.value = `题目导入成功，共导入 ${createdQuestions.length} 道题，当前题目总分 ${importedTotalScore} 分。`

    parsedQuestions.value = []
    selectedPaperFile.value = null
    selectedAnalysisFile.value = null
    selectedAudioFile.value = null
    selectedTranscriptFile.value = null
    parsedFileName.value = ''

    await loadAdminExams()

    if (selectedQuestionExamId.value === selectedExamId.value) {
      await handleLoadQuestionsByExamId(selectedExamId.value)
    }
  } catch (error) {
    console.error(error)

    if (String(error.message || '').includes('缺少分值')) {
      errorMessage.value = `${error.message}。请在上传文件中补充分值，或先为该考试类型添加分值规则。`
      return
    }

    errorMessage.value = error.message || '题目导入失败'
  } finally {
    isImportingQuestions.value = false
  }
}

const copyImportExample = async () => {
  try {
    await navigator.clipboard.writeText(importExampleText)
    successMessage.value = '标准导入格式已复制，可以粘贴到 txt 或 docx 文件中。'
  } catch (error) {
    console.error(error)
    errorMessage.value = '复制失败，请手动复制示例文本。'
  }
}

const handleLoadQuestions = async (exam) => {
  selectedQuestionExamId.value = exam.id
  selectedQuestionExamTitle.value = exam.title
  editingQuestionId.value = ''
  clearQuestionFilters()
  await handleLoadQuestionsByExamId(exam.id)
}

const handleLoadQuestionsByExamId = async (examId) => {
  errorMessage.value = ''
  successMessage.value = ''
  isLoadingQuestions.value = true

  try {
    adminQuestions.value = await getAdminExamQuestions(examId)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '题目列表加载失败'
  } finally {
    isLoadingQuestions.value = false
  }
}

const openEditQuestion = (question) => {
  editingQuestionId.value = question.id

  editQuestionForm.value = {
    type: question.type || 'CHOICE',
    text: question.text || '',
    optionsText: optionsArrayToText(question.options),
    answer:
      question.answer === null || question.answer === undefined
        ? ''
        : String(question.answer),
    score: question.score || 0,
    knowledgePoint: question.knowledgePoint || '',
    referenceAnswer: question.referenceAnswer || '',
    explanation: question.explanation || '',
    orderIndex: question.orderIndex || 1,
  }
}

const closeEditQuestion = () => {
  editingQuestionId.value = ''
  editQuestionForm.value = {
    type: 'CHOICE',
    text: '',
    optionsText: '',
    answer: '',
    score: 2,
    knowledgePoint: '',
    referenceAnswer: '',
    explanation: '',
    orderIndex: 1,
  }
}

const applyExamPresetToEditForm = () => {
  if (editExamForm.value.gradeLevel === 'CET4') {
    editExamForm.value.timeLimit = 7500
  }
}

const handleUpdateQuestion = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!editingQuestionId.value) {
    errorMessage.value = '请先选择要编辑的题目'
    return
  }

  if (!editQuestionForm.value.text.trim()) {
    errorMessage.value = '题干不能为空'
    return
  }

  isUpdatingQuestion.value = true

  try {
    const finalType = editQuestionForm.value.type

    await updateAdminQuestion(editingQuestionId.value, {
      type: finalType,
      text: editQuestionForm.value.text.trim(),
      options:
        finalType === 'CHOICE'
          ? optionsTextToArray(editQuestionForm.value.optionsText)
          : null,
      answer:
        finalType === 'CHOICE'
          ? normalizeChoiceAnswer(editQuestionForm.value.answer)
          : editQuestionForm.value.answer,
      score: Number(editQuestionForm.value.score || 0),
      knowledgePoint: editQuestionForm.value.knowledgePoint.trim() || '未分类',
      referenceAnswer: editQuestionForm.value.referenceAnswer.trim(),
      explanation: editQuestionForm.value.explanation.trim(),
      orderIndex: Number(editQuestionForm.value.orderIndex || 1),
    })

    successMessage.value = '题目更新成功，试卷满分已自动刷新'
    closeEditQuestion()

    await loadAdminExams()

    if (selectedQuestionExamId.value) {
      await handleLoadQuestionsByExamId(selectedQuestionExamId.value)
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '题目更新失败'
  } finally {
    isUpdatingQuestion.value = false
  }
}

const handleDeleteQuestion = async (question) => {
  const confirmed = window.confirm(
    `确认删除第 ${question.orderIndex} 题吗？删除后学生端将不再显示这道题。`
  )

  if (!confirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteAdminQuestion(question.id)

    successMessage.value = '题目删除成功'
    await loadAdminExams()

    if (selectedQuestionExamId.value) {
      await handleLoadQuestionsByExamId(selectedQuestionExamId.value)
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '题目删除失败'
  }
}

onMounted(() => {
  loadAdminExams()
})
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <p class="tag">Admin</p>
      <h1>管理员后台</h1>
      <p class="desc">
        管理员后台用于维护试卷、题目、用户数据和系统配置。
      </p>
    </div>

    <section v-if="!currentUser" class="admin-guard-card">
      <h2>请先登录</h2>
      <p>你当前未登录。管理员后台需要登录后才能访问。</p>

      <RouterLink class="primary-btn" to="/login">
        去登录
      </RouterLink>
    </section>

    <section v-else-if="!isAdmin" class="admin-guard-card">
      <h2>暂无管理员权限</h2>
      <p>当前账号：{{ currentUser.nickname || currentUser.username }}</p>
      <p>你的角色是 {{ currentUser.role }}，暂时不能访问管理员后台。</p>

      <RouterLink class="secondary-btn" to="/">
        返回首页
      </RouterLink>
    </section>

    <section v-else class="admin-section">
      <div class="admin-welcome-card">
        <h2>欢迎，{{ currentUser.nickname || currentUser.username }}</h2>
        <p>
          你当前拥有管理员权限。现在可以查看数据库试卷、新增试卷、编辑试卷，并通过文件批量导入题目。
        </p>
      </div>

      <div class="admin-shortcut-actions">
        <RouterLink class="secondary-btn" to="/admin/attempts">
          查看学生考试记录
        </RouterLink>
      </div>

      <div v-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="api-success">
        {{ successMessage }}
      </div>

      <div class="admin-panel-grid">
        <div class="admin-form-card">
          <h2>新增试卷</h2>

          <label>
            试卷标题
            <input
              v-model="form.title"
              type="text"
              placeholder="例如：2026 初中英语模拟卷 003"
            />
          </label>

          <label>
            试卷分类
            <select v-model="form.gradeLevel" @change="applyExamPresetToForm">
              <optgroup
                v-for="group in examCategoryOptions"
                :key="group.group"
                :label="group.group"
              >
                <option
                  v-for="option in group.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </optgroup>
            </select>
          </label>

          <label>
            试卷说明
            <textarea
              v-model="form.description"
              rows="4"
              placeholder="请输入试卷说明"
            ></textarea>
          </label>

          <label>
            考试时间，单位：秒
            <input
              v-model="form.timeLimit"
              type="number"
              min="60"
            />
          </label>

          <p class="form-tip">
            试卷满分将根据题目分值自动统计，无需手动填写。
          </p>

          <label class="checkbox-label">
            <input
              v-model="form.isPublished"
              type="checkbox"
            />
            创建后直接发布
          </label>

          <button class="primary-btn" @click="handleCreateExam">
            新增试卷
          </button>
        </div>

        <div class="admin-import-card">
          <h2>批量导入题目</h2>

          <p class="import-tip">
            支持上传 .txt 或 .docx 文件。建议使用标准格式：题型标题、题号、选项、答案、解析、知识点、分值。
          </p>

          <div class="import-example-actions">
            <button
              class="secondary-btn"
              @click="showImportExample = !showImportExample"
            >
              {{ showImportExample ? '收起格式示例' : '查看标准格式示例' }}
            </button>

            <button
              class="secondary-btn"
              @click="copyImportExample"
            >
              复制示例文本
            </button>
          </div>

          <div v-if="showImportExample" class="import-example-box">
            <pre>{{ importExampleText }}</pre>
          </div>

          <label>
            选择目标试卷
            <select v-model="selectedExamId">
              <option
                v-for="exam in exams"
                :key="exam.id"
                :value="exam.id"
              >
                {{ exam.title }}
              </option>
            </select>
          </label>

         <label>
  试卷原题文件，必填
  <input
    type="file"
    accept=".txt,.docx,.pdf"
    @change="handlePaperFileChange"
  />
</label>

<label>
  答案 / 解析文件，选填
  <input
    type="file"
    accept=".txt,.docx,.pdf"
    @change="handleAnalysisFileChange"
  />
</label>

<label>
  听力音频文件，选填
  <input
    type="file"
    accept=".mp3,.wav,.m4a"
    @change="handleAudioFileChange"
  />
</label>

          <label>
            听力原文文件，选填
            <input
              type="file"
              accept=".txt,.docx,.pdf"
              @change="handleTranscriptFileChange"
            />
          </label>

          <div class="admin-import-actions">
            <button
              class="secondary-btn"
              :disabled="isParsingFile"
              @click="handleParseFile"
            >
              {{ isParsingFile ? '解析中……' : '解析文件' }}
            </button>

            <button
              class="primary-btn"
              :disabled="isImportingQuestions || parsedQuestions.length === 0"
              @click="handleImportQuestions"
            >
              {{ isImportingQuestions ? '导入中……' : '确认导入题目' }}
            </button>
          </div>

          <p v-if="parsedFileName" class="import-file-name">
            当前文件：{{ parsedFileName }}
          </p>

          <div v-if="parsedQuestions.length > 0" class="parsed-question-list">
            <h3>解析预览：{{ parsedQuestions.length }} 道题</h3>

            <div
              v-for="question in parsedQuestions"
              :key="question.orderIndex"
              class="parsed-question-item"
            >
              <p class="tag">
                {{ typeNameMap[question.type] || question.type }}
              </p>

              <h4>{{ question.orderIndex }}. {{ question.text }}</h4>

              <ul v-if="question.options && question.options.length > 0">
                <li
                  v-for="(option, index) in question.options"
                  :key="option"
                >
                  {{ String.fromCharCode(65 + index) }}. {{ option }}
                </li>
              </ul>

              <p>答案：{{ question.answer }}</p>
              <p>知识点：{{ question.knowledgePoint }}</p>
              <p>分值：{{ question.score }}</p>
              <p v-if="question.explanation">解析：{{ question.explanation }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-list-card admin-full-card">
        <div class="section-title-row">
          <div>
            <h2>数据库试卷列表</h2>
            <p class="section-subtitle">
              当前显示 {{ filteredExams.length }} / {{ exams.length }} 张试卷
            </p>
          </div>

          <div class="admin-exam-search-actions">
            <input
              v-model="examKeyword"
              class="admin-exam-search-input"
              type="text"
              placeholder="搜索试卷标题、说明或分类"
            />

            <select
              v-model="examGradeFilter"
              class="admin-exam-grade-select"
            >
              <option value="ALL">全部试卷分类</option>
              <optgroup
                v-for="group in examCategoryOptions"
                :key="group.group"
                :label="group.group"
              >
                <option
                  v-for="option in group.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </optgroup>
            </select>

            <select
              v-model="examSortType"
              class="admin-exam-grade-select"
            >
              <option value="NEWEST">最新创建优先</option>
              <option value="OLDEST">最早创建优先</option>
              <option value="QUESTION_DESC">题目数量多到少</option>
              <option value="QUESTION_ASC">题目数量少到多</option>
              <option value="SCORE_DESC">满分高到低</option>
              <option value="SCORE_ASC">满分低到高</option>
              <option value="PUBLISHED_FIRST">已发布优先</option>
              <option value="UNPUBLISHED_FIRST">未发布优先</option>
            </select>

            <button
              v-if="examKeyword || examGradeFilter !== 'ALL' || examSortType !== 'NEWEST'"
              class="secondary-btn"
              @click="clearExamFilters"
            >
              清空筛选
            </button>

            <button class="secondary-btn" @click="loadAdminExams">
              刷新
            </button>
          </div>
        </div>

        <div v-if="isLoading" class="loading-box">
          正在加载管理员试卷列表……
        </div>

        <div v-else-if="filteredExams.length > 0" class="admin-exam-list">
          <div
            v-for="exam in filteredExams"
            :key="exam.id"
            class="admin-exam-item"
          >
            <div class="admin-exam-main">
              <template v-if="editingExamId === exam.id">
                <div class="edit-question-form">
                  <h3>编辑试卷</h3>

                  <label>
                    试卷标题
                    <input v-model="editExamForm.title" type="text" />
                  </label>

                  <label>
                    试卷分类
                    <select v-model="editExamForm.gradeLevel" @change="applyExamPresetToEditForm">
                      <optgroup
                        v-for="group in examCategoryOptions"
                        :key="group.group"
                        :label="group.group"
                      >
                        <option
                          v-for="option in group.options"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </optgroup>
                    </select>
                  </label>

                  <label>
                    试卷说明
                    <textarea v-model="editExamForm.description" rows="3"></textarea>
                  </label>

                  <label>
                    考试时间，单位：秒
                    <input v-model="editExamForm.timeLimit" type="number" min="60" />
                  </label>

                  <p class="form-tip">
                    试卷满分将根据题目分值自动统计，无需手动填写。
                  </p>

                  <label class="checkbox-label">
                    <input v-model="editExamForm.isPublished" type="checkbox" />
                    发布试卷
                  </label>

                  <div class="edit-question-actions">
                    <button
                      class="primary-btn"
                      :disabled="isUpdatingExam"
                      @click="handleUpdateExam"
                    >
                      {{ isUpdatingExam ? '保存中……' : '保存试卷' }}
                    </button>

                    <button class="secondary-btn" @click="closeEditExam">
                      取消
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <h3>{{ exam.title }}</h3>
                <p>{{ exam.description || '暂无说明' }}</p>

                <div class="admin-exam-meta">
                  <span>分类：{{ gradeNameMap[exam.gradeLevel] || exam.gradeLevel }}</span>
                  <span>题目：{{ exam.questionCount }} 题</span>
                  <span>满分：{{ Number(exam.totalScore || 0).toFixed(2).replace(/\.00$/, '') }} 分</span>
                  <span>时长：{{ formatTimeLimit(exam.timeLimit) }}</span>
                  <span>状态：{{ exam.isPublished ? '已发布' : '已下架' }}</span>
                  <span>创建：{{ formatDateTime(exam.createdAt) }}</span>
                </div>
              </template>
            </div>

            <div class="admin-exam-actions">
              <button class="secondary-btn" @click="handleLoadQuestions(exam)">
                查看题目
              </button>

              <button class="secondary-btn" @click="openEditExam(exam)">
                编辑试卷
              </button>

              <button class="secondary-btn" @click="handleTogglePublish(exam)">
                {{ exam.isPublished ? '下架' : '发布' }}
              </button>

              <button class="danger-btn" @click="handleDeleteExam(exam)">
                删除试卷
              </button>
            </div>
          </div>
        </div>

        <p v-else class="empty-text">
          {{ examKeyword || examGradeFilter !== 'ALL' || examSortType !== 'NEWEST' ? '暂无符合筛选条件的试卷。' : '暂无试卷。' }}
        </p>
      </div>

      <div v-if="selectedQuestionExamId" class="admin-question-card">
        <div class="section-title-row">
          <div>
            <h2>题目列表：{{ selectedQuestionExamTitle }}</h2>
            <p class="section-subtitle">
              当前显示 {{ filteredAdminQuestions.length }} / {{ adminQuestions.length }} 道题
            </p>
          </div>

          <div class="admin-exam-search-actions">
            <input
              v-model="questionKeyword"
              class="admin-exam-search-input"
              type="text"
              placeholder="搜索题干、知识点、解析或答案"
            />

            <select
              v-model="questionTypeFilter"
              class="admin-exam-grade-select"
            >
              <option value="ALL">全部题型</option>
              <option value="CHOICE">单选题</option>
              <option value="TRANSLATION">翻译题</option>
              <option value="ERROR_CORRECTION">改错题</option>
              <option value="WRITING">写作题</option>
              <option value="READING">阅读理解</option>
              <option value="CLOZE">完形填空</option>
            </select>

            <select
              v-model="questionSortType"
              class="admin-exam-grade-select"
            >
              <option value="ORDER_ASC">题号从小到大</option>
              <option value="ORDER_DESC">题号从大到小</option>
              <option value="SCORE_DESC">分值高到低</option>
              <option value="SCORE_ASC">分值低到高</option>
              <option value="TYPE_ASC">题型排序</option>
            </select>

            <button
              v-if="questionTypeFilter !== 'ALL' || questionKeyword || questionSortType !== 'ORDER_ASC'"
              class="secondary-btn"
              @click="clearQuestionFilters"
            >
              清空筛选
            </button>

            <button
              class="secondary-btn"
              @click="exportCurrentQuestionsToCsv"
            >
              导出题目 CSV
            </button>

            <button
              class="secondary-btn"
              @click="handleLoadQuestionsByExamId(selectedQuestionExamId)"
            >
              刷新题目
            </button>
          </div>
        </div>

        <div v-if="isLoadingQuestions" class="loading-box">
          正在加载题目……
        </div>

        <div v-else-if="filteredAdminQuestions.length > 0" class="admin-question-list">
          <div
            v-for="question in filteredAdminQuestions"
            :key="question.id"
            class="admin-question-item"
          >
            <div class="admin-question-header">
              <span class="question-order">第 {{ question.orderIndex }} 题</span>
              <span class="question-type">{{ typeNameMap[question.type] || question.type }}</span>
              <span class="question-score">{{ question.score }} 分</span>
            </div>

            <template v-if="editingQuestionId === question.id">
              <div class="edit-question-form">
                <h3>编辑题目</h3>

                <label>
                  题型
                  <select v-model="editQuestionForm.type">
                    <option value="CHOICE">单选题</option>
                    <option value="TRANSLATION">翻译题</option>
                    <option value="ERROR_CORRECTION">改错题</option>
                    <option value="WRITING">写作题</option>
                    <option value="READING">阅读理解</option>
                    <option value="CLOZE">完形填空</option>
                  </select>
                </label>

                <label>
                  题干
                  <textarea v-model="editQuestionForm.text" rows="4"></textarea>
                </label>

                <label v-if="editQuestionForm.type === 'CHOICE'">
                  选项，每行一个选项
                  <textarea v-model="editQuestionForm.optionsText" rows="5"></textarea>
                </label>

                <label>
                  答案
                  <input v-model="editQuestionForm.answer" type="text" />
                </label>

                <label>
                  分值
                  <input v-model="editQuestionForm.score" type="number" min="0" />
                </label>

                <label>
                  知识点
                  <input v-model="editQuestionForm.knowledgePoint" type="text" />
                </label>

                <label>
                  参考答案
                  <textarea v-model="editQuestionForm.referenceAnswer" rows="3"></textarea>
                </label>

                <label>
                  解析
                  <textarea v-model="editQuestionForm.explanation" rows="3"></textarea>
                </label>

                <label>
                  题目顺序
                  <input v-model="editQuestionForm.orderIndex" type="number" min="1" />
                </label>

                <div class="edit-question-actions">
                  <button
                    class="primary-btn"
                    :disabled="isUpdatingQuestion"
                    @click="handleUpdateQuestion"
                  >
                    {{ isUpdatingQuestion ? '保存中……' : '保存修改' }}
                  </button>

                  <button class="secondary-btn" @click="closeEditQuestion">
                    取消
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <h3>{{ question.text }}</h3>

              <ul v-if="question.options && question.options.length > 0">
                <li v-for="(option, index) in question.options" :key="option">
                  {{ String.fromCharCode(65 + index) }}. {{ option }}
                </li>
              </ul>

              <p><strong>答案：</strong>{{ formatAnswer(question) }}</p>
              <p><strong>知识点：</strong>{{ question.knowledgePoint || '未分类' }}</p>

              <p v-if="question.referenceAnswer">
                <strong>参考答案：</strong>{{ question.referenceAnswer }}
              </p>

              <p v-if="question.explanation">
                <strong>解析：</strong>{{ question.explanation }}
              </p>

              <div class="admin-question-actions">
                <button class="secondary-btn" @click="openEditQuestion(question)">
                  编辑题目
                </button>

                <button class="danger-btn" @click="handleDeleteQuestion(question)">
                  删除题目
                </button>
              </div>
            </template>
          </div>
        </div>

        <p v-else class="empty-text">
          {{ questionTypeFilter === 'ALL' && !questionKeyword ? '当前试卷暂无题目。' : '当前筛选条件下暂无题目。' }}
        </p>
      </div>
    </section>
  </div>
</template>
