const express = require('express')
const prisma = require('../lib/prisma')
const { requireRole } = require('../middlewares/authMiddleware')

const router = express.Router()

const roundNumber = (value, digits = 2) => {
  const numberValue = Number(value || 0)
  const ratio = 10 ** digits

  return Math.round(numberValue * ratio) / ratio
}

const getAnswerIndex = (answer) => {
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
  return Number.isNaN(numberValue) ? null : numberValue
}

const getChoiceAnswerDisplay = (question, answerIndex) => {
  if (answerIndex === null || answerIndex === undefined) {
    return '未作答'
  }

  const index = Number(answerIndex)
  const optionText = Array.isArray(question.options) ? question.options[index] : ''
  const label = Number.isNaN(index) ? String(answerIndex) : String.fromCharCode(65 + index)

  return optionText ? `${label}. ${optionText}` : label
}

const isAnswerFilled = (answer) => {
  if (!answer) {
    return false
  }

  if (answer.selectedIndex !== null && answer.selectedIndex !== undefined) {
    return true
  }

  return Boolean(String(answer.answerText || '').trim())
}

const calculateExamTotalScore = (questions = [], fallback = 0) => {
  const totalScore = questions.reduce((sum, question) => {
    return sum + Number(question.score || 0)
  }, 0)

  return totalScore || Number(fallback || 0)
}

const formatQuestionReportItem = (question, answer) => {
  const isObjective = question.type === 'CHOICE'
  const isAnswered = isAnswerFilled(answer)
  const userScore = Number(answer?.score || 0)
  const questionScore = Number(question.score || 0)
  const selectedIndex = answer?.selectedIndex ?? null
  const correctIndex = getAnswerIndex(question.answer)
  const isCorrect = isObjective
    ? answer?.isCorrect === true
    : null
  const studentAnswer = isObjective
    ? getChoiceAnswerDisplay(question, selectedIndex)
    : String(answer?.answerText || '').trim() || '未作答'
  const correctAnswer = isObjective
    ? getChoiceAnswerDisplay(question, correctIndex)
    : question.referenceAnswer || '暂无参考答案'

  return {
    questionId: question.id,
    answerId: answer?.id || '',
    orderIndex: question.orderIndex,
    type: question.type,
    text: question.text,
    options: question.options,
    studentAnswer,
    correctAnswer,
    isCorrect,
    isAnswered,
    score: questionScore,
    userScore,
    explanation: question.explanation || '',
    knowledgePoint: question.knowledgePoint || '未分类',
    materialId: question.materialId || '',
    materialTitle: question.material?.title || '',
    manual_or_subjective: !isObjective,
    shouldReview: !isAnswered || (isObjective ? !isCorrect : userScore < questionScore),
  }
}

const buildTypeStats = (questionItems) => {
  const typeMap = new Map()

  for (const item of questionItems) {
    if (!typeMap.has(item.type)) {
      typeMap.set(item.type, {
        type: item.type,
        questionCount: 0,
        totalScore: 0,
        studentScore: 0,
        correctCount: 0,
        wrongCount: 0,
        unansweredCount: 0,
        manual_or_subjective: item.manual_or_subjective,
      })
    }

    const stat = typeMap.get(item.type)
    stat.questionCount += 1
    stat.totalScore += Number(item.score || 0)
    stat.studentScore += Number(item.userScore || 0)

    if (!item.isAnswered) {
      stat.unansweredCount += 1
    } else if (item.manual_or_subjective) {
      stat.manual_or_subjective = true
    } else if (item.isCorrect) {
      stat.correctCount += 1
    } else {
      stat.wrongCount += 1
    }
  }

  return [...typeMap.values()].map((stat) => {
    const scoreRate = stat.totalScore > 0
      ? roundNumber((stat.studentScore / stat.totalScore) * 100, 1)
      : 0

    return {
      ...stat,
      totalScore: roundNumber(stat.totalScore, 2),
      studentScore: roundNumber(stat.studentScore, 2),
      scoreRate,
    }
  })
}

const buildBasicAdvice = ({
  scoreRate,
  wrongQuestions,
  unansweredCount,
  weakTypes,
  totalQuestionCount,
}) => {
  if (!totalQuestionCount) {
    return {
      dataSufficient: false,
      summary: '数据不足，暂不生成完整学习建议。',
      suggestions: ['暂无题目数据，请完成考试后再查看报告。'],
    }
  }

  const suggestions = []
  const wrongCountByType = new Map()

  for (const question of wrongQuestions) {
    wrongCountByType.set(question.type, (wrongCountByType.get(question.type) || 0) + 1)
  }

  const priorityType = [...wrongCountByType.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || ''

  if (scoreRate >= 80) {
    suggestions.push('整体掌握较好，建议以查漏补缺为主，重点复盘少量失分题。')
  } else if (scoreRate >= 60) {
    suggestions.push('基础尚可，但需要针对薄弱题型做错题复盘和同类题巩固。')
  } else {
    suggestions.push('本次得分率偏低，建议先处理高频错题和基础题型，再进行综合训练。')
  }

  if (weakTypes.length > 0) {
    suggestions.push(`建议优先复习题型：${weakTypes.map((item) => item.type).join('、')}。`)
  }

  if (priorityType) {
    suggestions.push(`错题数量最多的题型是 ${priorityType}，建议优先整理该题型错因。`)
  }

  if (unansweredCount >= Math.max(2, Math.ceil(totalQuestionCount * 0.2))) {
    suggestions.push('未作答题较多，请注意考试时间分配，先保证基础题完成率。')
  }

  return {
    dataSufficient: true,
    summary: suggestions[0],
    priorityType,
    suggestions,
  }
}

router.get('/student/attempts/:attemptId/report', requireRole('STUDENT', '只有学生可以查看个人学习报告'), async (req, res) => {
  try {
    const { attemptId } = req.params
    const attempt = await prisma.examAttempt.findUnique({
      where: {
        id: attemptId,
      },
      include: {
        exam: {
          include: {
            questions: {
              orderBy: {
                orderIndex: 'asc',
              },
              include: {
                material: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
        assignment: {
          include: {
            classroom: {
              select: {
                id: true,
                name: true,
              },
            },
            teacher: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
        },
        userAnswers: true,
      },
    })

    if (!attempt) {
      return res.status(404).json({
        message: '考试记录不存在',
      })
    }

    if (attempt.userId !== req.user.id) {
      return res.status(403).json({
        message: '你无权查看这份学习报告',
      })
    }

    const questions = attempt.exam?.questions || []
    const answerByQuestionId = new Map(
      (attempt.userAnswers || []).map((answer) => [answer.questionId, answer])
    )
    const questionItems = questions.map((question) => {
      return formatQuestionReportItem(question, answerByQuestionId.get(question.id))
    })
    const totalScore = calculateExamTotalScore(questions, attempt.exam?.totalScore)
    const earnedScore = Number(attempt.totalScore || 0)
    const scoreRate = totalScore > 0 ? roundNumber((earnedScore / totalScore) * 100, 1) : 0
    const correctCount = questionItems.filter((item) => item.isCorrect === true).length
    const unansweredCount = questionItems.filter((item) => !item.isAnswered).length
    const wrongQuestions = questionItems.filter((item) => item.shouldReview)
    const wrongCount = wrongQuestions.filter((item) => item.isAnswered).length
    const typeStats = buildTypeStats(questionItems)
    const weakTypes = typeStats
      .filter((item) => item.scoreRate < 70)
      .sort((a, b) => a.scoreRate - b.scoreRate)
    const reviewPriorityQuestions = wrongQuestions
      .slice()
      .sort((a, b) => {
        const lostA = Number(a.score || 0) - Number(a.userScore || 0)
        const lostB = Number(b.score || 0) - Number(b.userScore || 0)

        if (lostB !== lostA) {
          return lostB - lostA
        }

        return Number(a.orderIndex || 0) - Number(b.orderIndex || 0)
      })
      .slice(0, 5)
    const basicAdvice = buildBasicAdvice({
      scoreRate,
      wrongQuestions,
      unansweredCount,
      weakTypes,
      totalQuestionCount: questionItems.length,
    })

    res.json({
      message: '学生个人学习报告获取成功',
      data: {
        attempt: {
          id: attempt.id,
          submitType: attempt.submitType,
          usedTime: attempt.usedTime,
          submittedAt: attempt.submittedAt || attempt.createdAt,
          objectiveScore: attempt.objectiveScore,
          subjectiveScore: attempt.subjectiveScore,
          totalScore: earnedScore,
          accuracyRate: attempt.accuracyRate,
        },
        exam: {
          id: attempt.exam?.id || '',
          title: attempt.exam?.title || '未知试卷',
          gradeLevel: attempt.exam?.gradeLevel || '',
          totalScore,
        },
        assignment: attempt.assignment
          ? {
              id: attempt.assignment.id,
              title: attempt.assignment.title,
              classroomId: attempt.assignment.classroomId,
              classroomName: attempt.assignment.classroom?.name || '',
              teacherName:
                attempt.assignment.teacher?.nickname ||
                attempt.assignment.teacher?.username ||
                '',
            }
          : null,
        summary: {
          totalScore,
          earnedScore,
          scoreRate,
          correctCount,
          wrongCount,
          unansweredCount,
          usedTime: attempt.usedTime,
          submittedAt: attempt.submittedAt || attempt.createdAt,
        },
        typeStats,
        wrongQuestions,
        weakTypes,
        reviewPriorityQuestions,
        basicAdvice,
      },
    })
  } catch (error) {
    console.error('Get student attempt report error:', error)

    res.status(500).json({
      message: '学生个人学习报告获取失败',
      error: error.message,
    })
  }
})

module.exports = router
