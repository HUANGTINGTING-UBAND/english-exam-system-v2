const express = require('express')
const prisma = require('../lib/prisma')
const {
  optionalAuth,
  requireAuth,
  requireTeacherOrAdmin,
} = require('../middlewares/authMiddleware')

const router = express.Router()
const examCategoryGroups = {
  K12: ['PRIMARY', 'JUNIOR', 'SENIOR'],
  COLLEGE: ['COLLEGE', 'CET4', 'CET6', 'POSTGRADUATE'],
  ABROAD: ['IELTS', 'TOEFL'],
  OTHER_EXAM: ['BUSINESS', 'ADULT', 'PROFESSIONAL'],
  OTHER: ['GENERAL', 'OTHER'],
}

const normalizeExamCategory = (value) => {
  if (!value) {
    return ''
  }

  return String(value).trim().toUpperCase()
}

const buildExamGradeWhere = ({ grade, group }) => {
  const normalizedGroup = normalizeExamCategory(group)
  const normalizedGrade = normalizeExamCategory(grade)

  if (normalizedGroup && examCategoryGroups[normalizedGroup]) {
    return {
      in: examCategoryGroups[normalizedGroup],
    }
  }

  if (normalizedGrade) {
    return normalizedGrade
  }

  return undefined
}

const normalizeSubmitType = (submitType) => {
  const text = String(submitType || 'MANUAL').trim().toUpperCase()

  const allowedTypes = ['MANUAL', 'AUTO']

  if (allowedTypes.includes(text)) {
    return text
  }

  return 'MANUAL'
}

const parseOptionalDate = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

const normalizeChoiceAnswer = (answer) => {
  if (answer === null || answer === undefined || answer === '') {
    return null
  }

  if (typeof answer === 'number') {
    return answer
  }

  const text = String(answer).trim().toUpperCase()

  if (/^[A-Z]$/.test(text)) {
    return text.charCodeAt(0) - 65
  }

  const numberValue = Number(text)

  if (!Number.isNaN(numberValue)) {
    return numberValue
  }

  return null
}

const gradeLevels = new Set([
  'PRIMARY',
  'JUNIOR',
  'SENIOR',
  'COLLEGE',
  'CET4',
  'CET6',
  'POSTGRADUATE',
  'IELTS',
  'TOEFL',
  'BUSINESS',
  'ADULT',
  'PROFESSIONAL',
  'GENERAL',
  'OTHER',
])

const questionTypes = new Set([
  'CHOICE',
  'TRANSLATION',
  'ERROR_CORRECTION',
  'WRITING',
  'READING',
  'CLOZE',
])

const materialTypes = new Set(['READING', 'LISTENING', 'CLOZE', 'OTHER'])
const examSourceTypes = new Set(['PLATFORM_STANDARD', 'TEACHER_CUSTOM'])
const examVisibilities = new Set(['PUBLIC', 'PRIVATE', 'CLASS_ONLY'])
const examPublishStatuses = new Set(['DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED'])
const diagnosisQualityLevels = new Set(['BASIC', 'STANDARD', 'DETAILED'])

const normalizeEnum = (value, allowedValues, fallback = null) => {
  const normalized = String(value || '').trim().toUpperCase()
  return allowedValues.has(normalized) ? normalized : fallback
}

const parseJsonValue = (value, fallback = null) => {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    return value
  }
}

const normalizeOptionsInput = (options) => {
  if (Array.isArray(options)) {
    return options
      .map((option) => String(option || '').trim())
      .filter(Boolean)
  }

  if (typeof options === 'string') {
    const parsed = parseJsonValue(options, options)

    if (Array.isArray(parsed)) {
      return normalizeOptionsInput(parsed)
    }

    return options
      .split('\n')
      .map((option) => option.trim())
      .filter(Boolean)
  }

  return null
}

const getSafePublishStatus = (exam) => {
  if (exam.isPublished) {
    return 'PUBLISHED'
  }

  return exam.publishStatus || 'READY'
}

const canEditExam = (user, exam) => {
  if (!user || !exam) {
    return false
  }

  if (user.role === 'ADMIN') {
    return true
  }

  return (
    user.role === 'TEACHER' &&
    exam.createdById === user.id &&
    exam.sourceType === 'TEACHER_CUSTOM'
  )
}

const editableExamInclude = {
  creator: {
    select: {
      username: true,
      nickname: true,
      role: true,
    },
  },
  importJob: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  materials: {
    orderBy: {
      orderIndex: 'asc',
    },
    include: {
      _count: {
        select: {
          questions: true,
        },
      },
    },
  },
  questions: {
    orderBy: {
      orderIndex: 'asc',
    },
    include: {
      material: true,
    },
  },
}

const loadEditableExam = async (req, examId, include = editableExamInclude) => {
  const query = {
    where: {
      id: examId,
    },
  }

  if (include && Object.keys(include).length > 0) {
    query.include = include
  }

  const exam = await prisma.exam.findUnique(query)

  if (!exam) {
    return {
      status: 404,
      message: '试卷不存在',
    }
  }

  if (!canEditExam(req.user, exam)) {
    return {
      status: 403,
      message: '你没有权限编辑该试卷',
    }
  }

  return {
    exam,
  }
}

const calculateExamTotalScore = (questions = []) => {
  return questions.reduce((sum, question) => {
    return sum + Number(question.score || 0)
  }, 0)
}

const updateExamTotalScore = async (client, examId) => {
  const questions = await client.question.findMany({
    where: {
      examId,
    },
    select: {
      score: true,
    },
  })

  const totalScore = calculateExamTotalScore(questions)

  await client.exam.update({
    where: {
      id: examId,
    },
    data: {
      totalScore,
    },
  })

  return totalScore
}

const formatEditableExam = (exam) => {
  const totalScore = calculateExamTotalScore(exam.questions || [])

  return {
    id: exam.id,
    title: exam.title,
    gradeLevel: exam.gradeLevel,
    description: exam.description,
    timeLimit: exam.timeLimit,
    totalScore: totalScore || exam.totalScore,
    isPublished: exam.isPublished,
    sourceType: exam.sourceType,
    visibility: exam.visibility,
    publishStatus: getSafePublishStatus(exam),
    diagnosisQuality: exam.diagnosisQuality,
    importJobId: exam.importJobId,
    importJobTitle: exam.importJob?.title || '',
    creatorName: exam.creator?.nickname || exam.creator?.username || '',
    creatorRole: exam.creator?.role || '',
    materialCount: exam.materials?.length || 0,
    questionCount: exam.questions?.length || 0,
    materials: exam.materials || [],
    questions: exam.questions || [],
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  }
}

const getSelectedIndex = (answer) => {
  if (!answer) {
    return null
  }

  if (answer.selectedIndex !== undefined && answer.selectedIndex !== null) {
    return normalizeChoiceAnswer(answer.selectedIndex)
  }

  if (answer.answer !== undefined && answer.answer !== null) {
    return normalizeChoiceAnswer(answer.answer)
  }

  if (answer.value !== undefined && answer.value !== null) {
    return normalizeChoiceAnswer(answer.value)
  }

  return normalizeChoiceAnswer(answer)
}

const getAnswerText = (answer) => {
  if (!answer) {
    return ''
  }

  if (typeof answer === 'string' || typeof answer === 'number') {
    return String(answer)
  }

  if (answer.answerText !== undefined && answer.answerText !== null) {
    return String(answer.answerText)
  }

  if (answer.text !== undefined && answer.text !== null) {
    return String(answer.text)
  }

  if (answer.value !== undefined && answer.value !== null) {
    return String(answer.value)
  }

  if (answer.answer !== undefined && answer.answer !== null) {
    return String(answer.answer)
  }

  return ''
}

const normalizeSubmittedAnswers = (answers) => {
  if (Array.isArray(answers)) {
    return answers.map((item) => ({
      ...item,
      questionId: item.questionId || item.id,
    }))
  }

  if (answers && typeof answers === 'object') {
    return Object.entries(answers).map(([questionId, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {
          questionId,
          ...value,
        }
      }

      return {
        questionId,
        answer: value,
        value,
      }
    })
  }

  return []
}

router.get('/exams', optionalAuth, async (req, res) => {
  try {
    const { grade, group } = req.query
    const gradeWhere = buildExamGradeWhere({ grade, group })
    const userExamWhere =
      req.user?.role === 'TEACHER'
        ? {
            createdById: req.user.id,
            sourceType: 'TEACHER_CUSTOM',
          }
        : req.user?.role === 'ADMIN'
          ? {}
          : {
              visibility: 'PUBLIC',
              OR: [
                {
                  publishStatus: 'PUBLISHED',
                },
                {
                  isPublished: true,
                },
              ],
            }

    const exams = await prisma.exam.findMany({
      where: {
        ...userExamWhere,
        ...(gradeWhere
         ? {
           gradeLevel: gradeWhere,
           }
       : {}),
     },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        questions: {
          select: {
            id: true,
            score: true,
          },
        },
        materials: {
          select: {
            id: true,
          },
        },
        creator: {
          select: {
            username: true,
            nickname: true,
            role: true,
          },
        },
      },
    })

    const formattedExams = exams.map((exam) => {
      const realTotalScore = exam.questions.reduce((sum, question) => {
        return sum + Number(question.score || 0)
      }, 0)

      return {
        id: exam.id,
        title: exam.title,
        gradeLevel: exam.gradeLevel,
        description: exam.description,
        timeLimit: exam.timeLimit,
        totalScore: realTotalScore || exam.totalScore,
        isPublished: exam.isPublished,
        sourceType: exam.sourceType,
        visibility: exam.visibility,
        publishStatus: getSafePublishStatus(exam),
        diagnosisQuality: exam.diagnosisQuality,
        materialCount: exam.materials.length,
        importJobId: exam.importJobId,
        creatorName: exam.creator?.nickname || exam.creator?.username || '',
        creatorRole: exam.creator?.role || '',
        questionCount: exam.questions.length,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt,
      }
    })

    res.json({
      message: 'Exams loaded successfully',
      data: formattedExams,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '试卷列表获取失败',
      error: error.message,
    })
  }
})

router.get('/exams/:examId', async (req, res) => {
  try {
    const { examId } = req.params

    const exam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
      include: {
        materials: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
        questions: {
          select: {
            id: true,
            score: true,
          },
        },
      },
    })

    if (!exam) {
      return res.status(404).json({
        message: '试卷不存在',
      })
    }

    const realTotalScore = exam.questions.reduce((sum, question) => {
      return sum + Number(question.score || 0)
    }, 0)

    res.json({
      message: 'Exam loaded successfully',
      data: {
        id: exam.id,
        title: exam.title,
        gradeLevel: exam.gradeLevel,
        description: exam.description,
        timeLimit: exam.timeLimit,
        totalScore: realTotalScore || exam.totalScore,
        isPublished: exam.isPublished,
        sourceType: exam.sourceType,
        visibility: exam.visibility,
        publishStatus: getSafePublishStatus(exam),
        diagnosisQuality: exam.diagnosisQuality,
        materialCount: exam.materials.length,
        importJobId: exam.importJobId,
        materials: exam.materials,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt,
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '试卷详情获取失败',
      error: error.message,
    })
  }
})

router.get('/exams/:examId/questions', async (req, res) => {
  try {
    const { examId } = req.params

    const exam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
    })

    if (!exam) {
      return res.status(404).json({
        message: '试卷不存在',
      })
    }

    const questions = await prisma.question.findMany({
      where: {
        examId,
      },
      orderBy: {
        orderIndex: 'asc',
      },
      include: {
        material: true,
      },
    })

    res.json({
      message: 'Questions loaded successfully',
      data: questions,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '题目列表获取失败',
      error: error.message,
    })
  }
})

router.get('/exams/:examId/edit', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId } = req.params
    const result = await loadEditableExam(req, examId)

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    res.json({
      message: '正式试卷编辑详情获取成功',
      data: formatEditableExam(result.exam),
    })
  } catch (error) {
    console.error('Get editable exam error:', error)

    res.status(500).json({
      message: '正式试卷编辑详情获取失败',
      error: error.message,
    })
  }
})

router.patch('/exams/:examId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId } = req.params
    const result = await loadEditableExam(req, examId, {
      creator: true,
    })

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    const existingExam = result.exam
    const publishStatus = normalizeEnum(
      req.body.publishStatus,
      examPublishStatuses,
      existingExam.publishStatus
    )
    const sourceType =
      req.user.role === 'ADMIN'
        ? normalizeEnum(req.body.sourceType, examSourceTypes, existingExam.sourceType)
        : 'TEACHER_CUSTOM'
    const visibility = normalizeEnum(
      req.body.visibility,
      examVisibilities,
      existingExam.visibility
    )

    if (req.user.role === 'TEACHER' && visibility === 'PUBLIC') {
      return res.status(400).json({
        message: '教师自建试卷暂不支持设置为公开试卷，请使用私有或仅班级可见',
      })
    }

    const updatedExam = await prisma.exam.update({
      where: {
        id: examId,
      },
      data: {
        title: req.body.title === undefined ? existingExam.title : String(req.body.title || '').trim(),
        description:
          req.body.description === undefined
            ? existingExam.description
            : String(req.body.description || ''),
        gradeLevel:
          req.body.gradeLevel === undefined
            ? existingExam.gradeLevel
            : normalizeEnum(req.body.gradeLevel, gradeLevels, existingExam.gradeLevel),
        timeLimit:
          req.body.timeLimit === undefined
            ? existingExam.timeLimit
            : Number(req.body.timeLimit || existingExam.timeLimit),
        sourceType,
        visibility,
        publishStatus,
        isPublished: publishStatus === 'PUBLISHED',
        diagnosisQuality: normalizeEnum(
          req.body.diagnosisQuality,
          diagnosisQualityLevels,
          existingExam.diagnosisQuality
        ),
      },
      include: editableExamInclude,
    })

    res.json({
      message: '正式试卷信息更新成功',
      data: formatEditableExam(updatedExam),
    })
  } catch (error) {
    console.error('Update editable exam error:', error)

    res.status(500).json({
      message: '正式试卷信息更新失败',
      error: error.message,
    })
  }
})

router.post('/exams/:examId/materials', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId } = req.params
    const result = await loadEditableExam(req, examId, {})

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    const materialCount = await prisma.questionMaterial.count({
      where: {
        examId,
      },
    })

    const material = await prisma.questionMaterial.create({
      data: {
        examId,
        type: normalizeEnum(req.body.type, materialTypes, 'READING'),
        title: req.body.title ? String(req.body.title).trim() : `材料 ${materialCount + 1}`,
        content: String(req.body.content || ''),
        audioUrl: req.body.audioUrl ? String(req.body.audioUrl).trim() : '',
        transcript: req.body.transcript ? String(req.body.transcript) : '',
        orderIndex: Number(req.body.orderIndex || materialCount + 1),
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    })

    res.status(201).json({
      message: '正式材料创建成功',
      data: material,
    })
  } catch (error) {
    console.error('Create exam material error:', error)

    res.status(500).json({
      message: '正式材料创建失败',
      error: error.message,
    })
  }
})

router.patch('/exams/:examId/materials/:materialId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId, materialId } = req.params
    const result = await loadEditableExam(req, examId, {})

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    const existingMaterial = await prisma.questionMaterial.findFirst({
      where: {
        id: materialId,
        examId,
      },
    })

    if (!existingMaterial) {
      return res.status(404).json({
        message: '正式材料不存在',
      })
    }

    const material = await prisma.questionMaterial.update({
      where: {
        id: materialId,
      },
      data: {
        type: req.body.type
          ? normalizeEnum(req.body.type, materialTypes, existingMaterial.type)
          : existingMaterial.type,
        title: req.body.title === undefined ? existingMaterial.title : String(req.body.title || ''),
        content:
          req.body.content === undefined
            ? existingMaterial.content
            : String(req.body.content || ''),
        audioUrl:
          req.body.audioUrl === undefined
            ? existingMaterial.audioUrl
            : String(req.body.audioUrl || ''),
        transcript:
          req.body.transcript === undefined
            ? existingMaterial.transcript
            : String(req.body.transcript || ''),
        orderIndex:
          req.body.orderIndex === undefined
            ? existingMaterial.orderIndex
            : Number(req.body.orderIndex),
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    })

    res.json({
      message: '正式材料更新成功',
      data: material,
    })
  } catch (error) {
    console.error('Update exam material error:', error)

    res.status(500).json({
      message: '正式材料更新失败',
      error: error.message,
    })
  }
})

router.delete('/exams/:examId/materials/:materialId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId, materialId } = req.params
    const result = await loadEditableExam(req, examId, {})

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    const existingMaterial = await prisma.questionMaterial.findFirst({
      where: {
        id: materialId,
        examId,
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    })

    if (!existingMaterial) {
      return res.status(404).json({
        message: '正式材料不存在',
      })
    }

    if (existingMaterial._count.questions > 0) {
      return res.status(400).json({
        message: `该材料已有 ${existingMaterial._count.questions} 道题绑定，请先调整题目绑定后再删除`,
        data: {
          boundQuestionCount: existingMaterial._count.questions,
        },
      })
    }

    await prisma.questionMaterial.delete({
      where: {
        id: materialId,
      },
    })

    res.json({
      message: '正式材料删除成功',
      data: existingMaterial,
    })
  } catch (error) {
    console.error('Delete exam material error:', error)

    res.status(500).json({
      message: '正式材料删除失败',
      error: error.message,
    })
  }
})

router.post('/exams/:examId/questions', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId } = req.params
    const result = await loadEditableExam(req, examId, {})

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    if (req.body.materialId) {
      const material = await prisma.questionMaterial.findFirst({
        where: {
          id: req.body.materialId,
          examId,
        },
      })

      if (!material) {
        return res.status(400).json({
          message: '绑定的正式材料不存在或不属于当前试卷',
        })
      }
    }

    const questionCount = await prisma.question.count({
      where: {
        examId,
      },
    })
    const type = normalizeEnum(req.body.type, questionTypes, 'CHOICE')

    const question = await prisma.$transaction(async (tx) => {
      const createdQuestion = await tx.question.create({
        data: {
          examId,
          materialId: req.body.materialId || null,
          type,
          text: String(req.body.text || `第 ${questionCount + 1} 题`),
          options: normalizeOptionsInput(req.body.options),
          answer:
            req.body.answer === undefined || req.body.answer === ''
              ? null
              : type === 'CHOICE'
                ? normalizeChoiceAnswer(req.body.answer)
                : parseJsonValue(req.body.answer),
          score:
            req.body.score === undefined || req.body.score === ''
              ? 2
              : Number(req.body.score),
          knowledgePoint: req.body.knowledgePoint || '未分类',
          referenceAnswer: req.body.referenceAnswer || '',
          explanation: req.body.explanation || '',
          orderIndex: Number(req.body.orderIndex || questionCount + 1),
        },
        include: {
          material: true,
        },
      })

      await updateExamTotalScore(tx, examId)
      return createdQuestion
    })

    res.status(201).json({
      message: '正式题目创建成功',
      data: question,
    })
  } catch (error) {
    console.error('Create exam question error:', error)

    res.status(500).json({
      message: '正式题目创建失败',
      error: error.message,
    })
  }
})

router.patch('/exams/:examId/questions/:questionId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId, questionId } = req.params
    const result = await loadEditableExam(req, examId, {})

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        examId,
      },
    })

    if (!existingQuestion) {
      return res.status(404).json({
        message: '正式题目不存在',
      })
    }

    if (req.body.materialId) {
      const material = await prisma.questionMaterial.findFirst({
        where: {
          id: req.body.materialId,
          examId,
        },
      })

      if (!material) {
        return res.status(400).json({
          message: '绑定的正式材料不存在或不属于当前试卷',
        })
      }
    }

    const nextType = req.body.type
      ? normalizeEnum(req.body.type, questionTypes, existingQuestion.type)
      : existingQuestion.type

    const question = await prisma.$transaction(async (tx) => {
      const updatedQuestion = await tx.question.update({
        where: {
          id: questionId,
        },
        data: {
          materialId:
            req.body.materialId === undefined
              ? existingQuestion.materialId
              : req.body.materialId || null,
          type: nextType,
          text: req.body.text === undefined ? existingQuestion.text : String(req.body.text),
          options:
            req.body.options === undefined
              ? existingQuestion.options
              : normalizeOptionsInput(req.body.options),
          answer:
            req.body.answer === undefined
              ? existingQuestion.answer
              : req.body.answer === ''
                ? null
                : nextType === 'CHOICE'
                  ? normalizeChoiceAnswer(req.body.answer)
                  : parseJsonValue(req.body.answer),
          score:
            req.body.score === undefined || req.body.score === ''
              ? existingQuestion.score
              : Number(req.body.score),
          knowledgePoint:
            req.body.knowledgePoint === undefined
              ? existingQuestion.knowledgePoint
              : String(req.body.knowledgePoint || '未分类'),
          referenceAnswer:
            req.body.referenceAnswer === undefined
              ? existingQuestion.referenceAnswer
              : String(req.body.referenceAnswer || ''),
          explanation:
            req.body.explanation === undefined
              ? existingQuestion.explanation
              : String(req.body.explanation || ''),
          orderIndex:
            req.body.orderIndex === undefined
              ? existingQuestion.orderIndex
              : Number(req.body.orderIndex),
        },
        include: {
          material: true,
        },
      })

      await updateExamTotalScore(tx, examId)
      return updatedQuestion
    })

    res.json({
      message: '正式题目更新成功',
      data: question,
    })
  } catch (error) {
    console.error('Update exam question error:', error)

    res.status(500).json({
      message: '正式题目更新失败',
      error: error.message,
    })
  }
})

router.delete('/exams/:examId/questions/:questionId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { examId, questionId } = req.params
    const result = await loadEditableExam(req, examId, {})

    if (!result.exam) {
      return res.status(result.status).json({
        message: result.message,
      })
    }

    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        examId,
      },
    })

    if (!existingQuestion) {
      return res.status(404).json({
        message: '正式题目不存在',
      })
    }

    const [userAnswerCount, wrongQuestionCount] = await Promise.all([
      prisma.userAnswer.count({
        where: {
          questionId,
        },
      }),
      prisma.wrongQuestion.count({
        where: {
          questionId,
        },
      }),
    ])

    if (userAnswerCount > 0 || wrongQuestionCount > 0) {
      return res.status(400).json({
        message: '该题目已有历史作答或错题记录，暂不能删除，以免破坏考试历史展示',
        data: {
          userAnswerCount,
          wrongQuestionCount,
        },
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.question.delete({
        where: {
          id: questionId,
        },
      })

      await updateExamTotalScore(tx, examId)
    })

    res.json({
      message: '正式题目删除成功',
      data: existingQuestion,
    })
  } catch (error) {
    console.error('Delete exam question error:', error)

    res.status(500).json({
      message: '正式题目删除失败',
      error: error.message,
    })
  }
})

router.post('/attempts/submit', requireAuth, async (req, res) => {
  try {
    const {
      examId,
      answers,
      submitType: rawSubmitType,
      usedTime,
      pauseCount,
      totalPausedDuration,
      startedAt,
      submittedAt,
      assignmentId,
    } = req.body

    const submitType = normalizeSubmitType(rawSubmitType)
    const finalAssignmentId = assignmentId ? String(assignmentId).trim() : null

    if (!examId) {
      return res.status(400).json({
        message: '缺少试卷 ID',
      })
    }

    const exam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
    })

    if (!exam) {
      return res.status(404).json({
        message: '试卷不存在',
      })
    }

    let assignment = null

    if (finalAssignmentId) {
      assignment = await prisma.assignment.findUnique({
        where: {
          id: finalAssignmentId,
        },
        include: {
          classroom: true,
        },
      })

      if (!assignment) {
        return res.status(404).json({
          message: '班级任务不存在',
        })
      }

      if (assignment.examId !== examId) {
        return res.status(400).json({
          message: '班级任务与当前试卷不匹配',
        })
      }

      if (assignment.status !== 'PUBLISHED') {
        return res.status(400).json({
          message: '当前班级任务尚未发布或已关闭',
        })
      }

      if (req.user.role !== 'STUDENT') {
        return res.status(403).json({
          message: '只有学生可以提交班级任务考试',
        })
      }

      const membership = await prisma.classStudent.findFirst({
        where: {
          classroomId: assignment.classroomId,
          studentId: req.user.id,
          status: 'ACTIVE',
        },
      })

      if (!membership) {
        return res.status(403).json({
          message: '你不属于该任务所在班级，不能提交',
        })
      }
    }

    const questions = await prisma.question.findMany({
      where: {
        examId,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    })

    if (questions.length === 0) {
      return res.status(400).json({
        message: '当前试卷暂无题目，不能提交考试',
      })
    }

    const submittedAnswers = normalizeSubmittedAnswers(answers)

    const submittedAnswerMap = new Map(
      submittedAnswers
        .filter((answer) => answer.questionId)
        .map((answer) => [answer.questionId, answer])
    )

    let objectiveScore = 0
    let subjectiveScore = 0
    let correctCount = 0
    let answeredCount = 0

    const userAnswerData = questions.map((question) => {
      const submittedAnswer = submittedAnswerMap.get(question.id)

      const selectedIndex =
        question.type === 'CHOICE'
          ? getSelectedIndex(submittedAnswer)
          : null

      const answerText =
        question.type === 'CHOICE'
          ? ''
          : getAnswerText(submittedAnswer)

      const hasAnswer =
        question.type === 'CHOICE'
          ? selectedIndex !== null && selectedIndex !== undefined
          : Boolean(answerText.trim())

      if (hasAnswer) {
        answeredCount += 1
      }

      let isCorrect = false
      let score = 0

      if (question.type === 'CHOICE') {
        const correctIndex = normalizeChoiceAnswer(question.answer)

        isCorrect =
          selectedIndex !== null &&
          selectedIndex !== undefined &&
          correctIndex !== null &&
          Number(selectedIndex) === Number(correctIndex)

        if (isCorrect) {
          score = Number(question.score || 0)
          objectiveScore += score
          correctCount += 1
        }
      } else {
        isCorrect = false
        score = 0
        subjectiveScore += 0
      }

      return {
        questionId: question.id,
        answerText,
        selectedIndex,
        score,
        isCorrect,
      }
    })

    const realExamTotalScore = questions.reduce((sum, question) => {
      return sum + Number(question.score || 0)
    }, 0)

    const totalScore = objectiveScore + subjectiveScore

    const accuracyRate =
      questions.length > 0
        ? Math.round((correctCount / questions.length) * 100)
        : 0

    const createdAttempt = await prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.create({
        data: {
          userId: req.user.id,
          examId,
          assignmentId: finalAssignmentId,
          objectiveScore,
          subjectiveScore,
          totalScore,
          accuracyRate,
          submitType,
          usedTime: Number(usedTime || 0),
          pauseCount: Number(pauseCount || 0),
          totalPausedDuration: Number(totalPausedDuration || 0),
          startedAt: parseOptionalDate(startedAt),
          submittedAt: parseOptionalDate(submittedAt) || new Date(),
        },
      })

      for (const answer of userAnswerData) {
        await tx.userAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: answer.questionId,
            answerText: answer.answerText,
            selectedIndex: answer.selectedIndex,
            score: answer.score,
            isCorrect: answer.isCorrect,
          },
        })
      }

      const wrongQuestionData = userAnswerData
        .filter((answer) => answer.isCorrect === false)
        .map((answer) => {
          const question = questions.find((item) => item.id === answer.questionId)

          return {
            userId: req.user.id,
            examId,
            questionId: answer.questionId,
            attemptId: attempt.id,
            questionType: question?.type || 'CHOICE',
            knowledgePoint: question?.knowledgePoint || '未分类',
            reason: '考试作答错误',
            note: '',
          }
        })

      for (const wrongQuestion of wrongQuestionData) {
        await tx.wrongQuestion.create({
          data: wrongQuestion,
        })
      }

      return attempt
    })

    res.status(201).json({
      message: '考试提交成功',
      data: {
        attempt: createdAttempt,
        summary: {
          examTotalScore: realExamTotalScore,
          totalQuestions: questions.length,
          answeredCount,
          correctCount,
          objectiveScore,
          subjectiveScore,
          totalScore,
          scoreRate:
            realExamTotalScore > 0
              ? Math.round((totalScore / realExamTotalScore) * 100)
              : 0,
          accuracyRate,
        },
      },
    })
  } catch (error) {
    console.error('Submit attempt error:', error)

    res.status(500).json({
      message: '考试提交失败',
      error: error.message,
    })
  }
})

router.get('/attempts/history', requireAuth, async (req, res) => {
  try {
    const attempts = await prisma.examAttempt.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        submittedAt: 'desc',
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            gradeLevel: true,
            totalScore: true,
          },
        },
        userAnswers: {
          include: {
            question: {
              select: {
                score: true,
              },
            },
          },
        },
      },
    })

    const formattedAttempts = attempts.map((attempt) => {
      const realExamTotalScore = attempt.userAnswers.reduce((sum, answer) => {
        return sum + Number(answer.question?.score || 0)
      }, 0)

      return {
        id: attempt.id,
        examId: attempt.examId,
        examTitle: attempt.exam?.title || '未知试卷',
        examGradeLevel: attempt.exam?.gradeLevel || '',
        examTotalScore: realExamTotalScore || attempt.exam?.totalScore || 0,
        objectiveScore: attempt.objectiveScore,
        subjectiveScore: attempt.subjectiveScore,
        totalScore: attempt.totalScore,
        accuracyRate: attempt.accuracyRate,
        submitType: attempt.submitType,
        usedTime: attempt.usedTime,
        pauseCount: attempt.pauseCount,
        answerCount: attempt.userAnswers.length,
        submittedAt: attempt.submittedAt,
      }
    })

    res.json({
      message: '考试历史获取成功',
      data: formattedAttempts,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '考试历史获取失败',
      error: error.message,
    })
  }
})

router.delete('/attempts/:attemptId', requireAuth, async (req, res) => {
  try {
    const { attemptId } = req.params

    const attempt = await prisma.examAttempt.findUnique({
      where: {
        id: attemptId,
      },
    })

    if (!attempt) {
      return res.status(404).json({
        message: '考试记录不存在',
      })
    }

    const isOwner = attempt.userId === req.user.id
    const isAdmin = req.user.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: '你无权删除这条考试记录',
      })
    }

    const deletedResult = await prisma.$transaction(async (tx) => {
      const deletedWrongQuestions = await tx.wrongQuestion.deleteMany({
        where: {
          attemptId,
        },
      })

      const deletedUserAnswers = await tx.userAnswer.deleteMany({
        where: {
          attemptId,
        },
      })

      const deletedAttempt = await tx.examAttempt.delete({
        where: {
          id: attemptId,
        },
      })

      return {
        deletedAttempt,
        deletedWrongQuestions: deletedWrongQuestions.count,
        deletedUserAnswers: deletedUserAnswers.count,
      }
    })

    res.json({
      message: '考试记录删除成功',
      data: deletedResult,
    })
  } catch (error) {
    console.error('Delete attempt error:', error)

    res.status(500).json({
      message: '考试记录删除失败',
      error: error.message,
    })
  }
})

router.post('/wrong-questions', requireAuth, async (req, res) => {
  try {
    const { wrongQuestions } = req.body

    if (!Array.isArray(wrongQuestions) || wrongQuestions.length === 0) {
      return res.status(400).json({
        message: '请提供需要保存的错题',
      })
    }

    const data = wrongQuestions.map((item) => ({
      userId: req.user.id,
      examId: item.examId,
      questionId: item.questionId,
      attemptId: item.attemptId || null,
      questionType: item.questionType || item.type || 'CHOICE',
      knowledgePoint: item.knowledgePoint || '未分类',
      reason: item.reason || '考试作答错误',
      note: item.note || '',
    }))

    const created = await prisma.wrongQuestion.createMany({
      data,
      skipDuplicates: false,
    })

    res.status(201).json({
      message: '错题保存成功',
      data: created,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '错题保存失败',
      error: error.message,
    })
  }
})

router.get('/wrong-questions', requireAuth, async (req, res) => {
  try {
    const wrongQuestions = await prisma.wrongQuestion.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
          },
        },
        question: {
          select: {
            id: true,
            text: true,
            type: true,
            referenceAnswer: true,
            explanation: true,
            knowledgePoint: true,
          },
        },
      },
    })

    const formattedWrongQuestions = wrongQuestions.map((item) => ({
      id: item.id,
      examId: item.examId,
      examTitle: item.exam?.title || '未知试卷',
      questionId: item.questionId,
      questionText: item.question?.text || '',
      questionType: item.questionType || item.question?.type || '',
      knowledgePoint: item.knowledgePoint || item.question?.knowledgePoint || '未分类',
      referenceAnswer: item.question?.referenceAnswer || '',
      explanation: item.question?.explanation || '',
      reason: item.reason,
      note: item.note,
      createdAt: item.createdAt,
    }))

    res.json({
      message: '错题本获取成功',
      data: formattedWrongQuestions,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '错题本获取失败',
      error: error.message,
    })
  }
})

module.exports = router
