const express = require('express')
const prisma = require('../lib/prisma')
const { requireRole, requireTeacher } = require('../middlewares/authMiddleware')

const router = express.Router()

const roundNumber = (value, digits = 2) => {
  const numberValue = Number(value || 0)
  const ratio = 10 ** digits

  return Math.round(numberValue * ratio) / ratio
}

const calculateExamTotalScore = (questions = [], fallback = 0) => {
  const totalScore = questions.reduce((sum, question) => {
    return sum + Number(question.score || 0)
  }, 0)

  return totalScore || Number(fallback || 0)
}

const getAnswerLabel = (answer) => {
  if (answer === null || answer === undefined || answer === '') {
    return '未作答'
  }

  const numberValue = Number(answer)

  if (!Number.isNaN(numberValue)) {
    return String.fromCharCode(65 + numberValue)
  }

  return String(answer)
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

const getAttemptAnswerSummary = (attempt) => {
  const answers = attempt?.userAnswers || []
  const objectiveAnswers = answers.filter((answer) => {
    return answer.question?.type === 'CHOICE'
  })

  return {
    answeredCount: answers.filter(isAnswerFilled).length,
    correctCount: objectiveAnswers.filter((answer) => answer.isCorrect === true).length,
    wrongCount: objectiveAnswers.filter((answer) => {
      return isAnswerFilled(answer) && answer.isCorrect === false
    }).length,
  }
}

const formatAssignment = (assignment, currentUserId = '') => {
  const attempts = assignment.attempts || []
  const latestAttempt = attempts[0] || null
  const latestAttemptAnswerSummary = getAttemptAnswerSummary(latestAttempt)

  return {
    id: assignment.id,
    classroomId: assignment.classroomId,
    classroomName: assignment.classroom?.name || '',
    teacherId: assignment.teacherId,
    teacherName: assignment.teacher?.nickname || assignment.teacher?.username || '',
    examId: assignment.examId,
    examTitle: assignment.exam?.title || '',
    examGradeLevel: assignment.exam?.gradeLevel || '',
    examTotalScore: assignment.exam?.totalScore || 0,
    title: assignment.title,
    description: assignment.description,
    status: assignment.status,
    dueAt: assignment.dueAt,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    submissionCount: assignment._count?.attempts || attempts.length || 0,
    latestAttempt: latestAttempt
      ? {
          id: latestAttempt.id,
          userId: latestAttempt.userId || currentUserId,
          totalScore: latestAttempt.totalScore,
          accuracyRate: latestAttempt.accuracyRate,
          submitType: latestAttempt.submitType,
          usedTime: latestAttempt.usedTime,
          submittedAt: latestAttempt.submittedAt,
          createdAt: latestAttempt.createdAt,
          answeredCount: latestAttemptAnswerSummary.answeredCount,
          correctCount: latestAttemptAnswerSummary.correctCount,
          wrongCount: latestAttemptAnswerSummary.wrongCount,
        }
      : null,
  }
}

const buildLatestAttemptByUser = (attempts = [], allowedStudentIds = new Set()) => {
  const latestAttemptByUser = new Map()

  for (const attempt of attempts) {
    if (allowedStudentIds.size > 0 && !allowedStudentIds.has(attempt.userId)) {
      continue
    }

    if (!latestAttemptByUser.has(attempt.userId)) {
      latestAttemptByUser.set(attempt.userId, attempt)
    }
  }

  return latestAttemptByUser
}

const getAttemptScoreForType = (attempt, type) => {
  return (attempt.userAnswers || [])
    .filter((answer) => answer.question?.type === type)
    .reduce((sum, answer) => {
      return sum + Number(answer.score || 0)
    }, 0)
}

const buildBasicOverview = ({
  summary,
  questionStats,
  typeStats,
}) => {
  if (!summary.submittedCount || questionStats.length === 0) {
    return {
      dataSufficient: false,
      overallSummary: '数据不足，暂不生成完整概览。',
      weakQuestionTypes: [],
      lowestAccuracyQuestions: [],
      priorityReviewQuestions: [],
      recommendedReviewTypes: [],
      notes: ['等待更多学生提交后，可生成更稳定的班级学情概览。'],
    }
  }

  const scoreRate = summary.examTotalScore > 0
    ? (summary.averageScore / summary.examTotalScore) * 100
    : 0
  const overallLevel = scoreRate >= 80 ? '整体表现较好'
    : scoreRate >= 60 ? '整体表现中等'
      : '整体表现偏弱'
  const weakQuestionTypes = typeStats
    .filter((item) => item.scoreRate !== null && item.scoreRate < 70)
    .sort((a, b) => a.scoreRate - b.scoreRate)
    .slice(0, 3)
  const objectiveQuestionStats = questionStats
    .filter((item) => !item.manual_or_subjective && item.answeredCount > 0)
  const lowestAccuracyQuestions = objectiveQuestionStats
    .slice()
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 5)
  const priorityReviewQuestions = lowestAccuracyQuestions
    .filter((item) => item.isHighFrequencyWrong || item.correctRate < 60)
    .slice(0, 5)
  const recommendedReviewTypes = weakQuestionTypes.map((item) => item.type)

  return {
    dataSufficient: summary.submittedCount >= 2,
    overallSummary: summary.submittedCount >= 2
      ? `${overallLevel}：提交率 ${summary.submissionRate}%，平均分 ${summary.averageScore}/${summary.examTotalScore}，及格率 ${summary.passRate}%。`
      : '数据不足，暂不生成完整概览。',
    weakQuestionTypes,
    lowestAccuracyQuestions,
    priorityReviewQuestions,
    recommendedReviewTypes,
    notes: summary.submittedCount >= 2
      ? [
          priorityReviewQuestions.length > 0
            ? '建议优先讲评高频错题和正确率最低题目。'
            : '当前暂无明显高频错题，可结合课堂目标做常规讲评。',
          recommendedReviewTypes.length > 0
            ? `建议学生复习题型：${recommendedReviewTypes.join('、')}。`
            : '题型表现暂无明显短板。',
        ]
      : ['当前提交样本较少，建议等待更多学生提交后再做完整讲评。'],
  }
}

const buildAssignmentAnalytics = ({
  assignment,
  memberships,
  attempts,
}) => {
  const memberIds = new Set(memberships.map((membership) => membership.studentId))
  const latestAttemptByUser = buildLatestAttemptByUser(attempts, memberIds)
  const latestAttempts = [...latestAttemptByUser.values()]
  const questions = (assignment.exam?.questions || []).slice().sort((a, b) => {
    return Number(a.orderIndex || 0) - Number(b.orderIndex || 0)
  })
  const examTotalScore = calculateExamTotalScore(questions, assignment.exam?.totalScore)
  const scores = latestAttempts.map((attempt) => Number(attempt.totalScore || 0))
  const classSize = memberships.length
  const submittedCount = latestAttempts.length
  const notSubmittedCount = Math.max(classSize - submittedCount, 0)
  const passLine = examTotalScore * 0.6
  const passedCount = scores.filter((score) => score >= passLine).length
  const summary = {
    classSize,
    submittedCount,
    notSubmittedCount,
    submissionRate: classSize > 0 ? roundNumber((submittedCount / classSize) * 100, 1) : 0,
    averageScore: submittedCount > 0
      ? roundNumber(scores.reduce((sum, score) => sum + score, 0) / submittedCount, 2)
      : 0,
    highestScore: submittedCount > 0 ? Math.max(...scores) : null,
    lowestScore: submittedCount > 0 ? Math.min(...scores) : null,
    passRate: submittedCount > 0 ? roundNumber((passedCount / submittedCount) * 100, 1) : 0,
    passLine: roundNumber(passLine, 2),
    examTotalScore,
  }
  const students = memberships.map((membership) => {
    const attempt = latestAttemptByUser.get(membership.studentId)
    const answerSummary = getAttemptAnswerSummary(attempt)

    return {
      studentId: membership.studentId,
      username: membership.student?.username || '',
      nickname: membership.student?.nickname || '',
      gradeLevel: membership.student?.gradeLevel || '',
      status: attempt ? 'SUBMITTED' : 'NOT_SUBMITTED',
      attemptId: attempt?.id || '',
      totalScore: attempt?.totalScore ?? null,
      examTotalScore,
      accuracyRate: attempt?.accuracyRate ?? null,
      submitType: attempt?.submitType || '',
      usedTime: attempt?.usedTime ?? null,
      submittedAt: attempt?.submittedAt || attempt?.createdAt || null,
      answeredCount: answerSummary.answeredCount,
      correctCount: answerSummary.correctCount,
      wrongCount: answerSummary.wrongCount,
    }
  })
  const questionStats = questions.map((question) => {
    const records = latestAttempts
      .map((attempt) => {
        return (attempt.userAnswers || []).find((answer) => answer.questionId === question.id)
      })
      .filter(Boolean)
    const answeredRecords = records.filter(isAnswerFilled)
    const isObjective = question.type === 'CHOICE'
    const correctCount = isObjective
      ? answeredRecords.filter((answer) => answer.isCorrect === true).length
      : null
    const wrongRecords = isObjective
      ? answeredRecords.filter((answer) => answer.isCorrect === false)
      : []
    const wrongAnswerCount = new Map()

    for (const answer of wrongRecords) {
      const answerText = answer.selectedIndex !== null && answer.selectedIndex !== undefined
        ? getAnswerLabel(answer.selectedIndex)
        : String(answer.answerText || '').trim() || '未作答'

      wrongAnswerCount.set(answerText, (wrongAnswerCount.get(answerText) || 0) + 1)
    }

    const commonWrongAnswers = [...wrongAnswerCount.entries()]
      .map(([answer, count]) => ({
        answer,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    const correctRate = isObjective && answeredRecords.length > 0
      ? roundNumber((correctCount / answeredRecords.length) * 100, 1)
      : null

    return {
      questionId: question.id,
      orderIndex: question.orderIndex,
      type: question.type,
      score: question.score,
      text: question.text,
      correctAnswer: isObjective ? getAnswerLabel(question.answer) : question.referenceAnswer || '',
      answeredCount: answeredRecords.length,
      correctCount,
      wrongCount: isObjective ? wrongRecords.length : null,
      correctRate,
      commonWrongAnswers,
      isHighFrequencyWrong: isObjective && answeredRecords.length > 0 && correctRate < 60,
      manual_or_subjective: !isObjective,
    }
  })
  const typeMap = new Map()

  for (const question of questions) {
    if (!typeMap.has(question.type)) {
      typeMap.set(question.type, {
        type: question.type,
        questionCount: 0,
        totalScore: 0,
      })
    }

    const stat = typeMap.get(question.type)
    stat.questionCount += 1
    stat.totalScore += Number(question.score || 0)
  }

  const typeStats = [...typeMap.values()].map((stat) => {
    const totalAttemptScore = latestAttempts.reduce((sum, attempt) => {
      return sum + getAttemptScoreForType(attempt, stat.type)
    }, 0)
    const classAverageScore = submittedCount > 0
      ? roundNumber(totalAttemptScore / submittedCount, 2)
      : 0
    const scoreRate = stat.totalScore > 0 && submittedCount > 0
      ? roundNumber((classAverageScore / stat.totalScore) * 100, 1)
      : null

    return {
      ...stat,
      totalScore: roundNumber(stat.totalScore, 2),
      classAverageScore,
      scoreRate,
      errorRate: scoreRate === null ? null : roundNumber(100 - scoreRate, 1),
      manual_or_subjective: stat.type !== 'CHOICE',
    }
  })
  const basicOverview = buildBasicOverview({
    summary,
    questionStats,
    typeStats,
  })

  return {
    assignment: formatAssignment({
      ...assignment,
      _count: {
        attempts: latestAttempts.length,
      },
    }),
    classInfo: {
      id: assignment.classroomId,
      name: assignment.classroom?.name || '',
      description: assignment.classroom?.description || '',
      teacherId: assignment.teacherId,
      teacherName: assignment.teacher?.nickname || assignment.teacher?.username || '',
      studentCount: classSize,
    },
    summary,
    students,
    questionStats,
    typeStats,
    basicOverview,
  }
}

const getTeacherAssignment = async (assignmentId, teacherId) => {
  return prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId,
    },
    include: {
      classroom: true,
      exam: {
        include: {
          questions: {
            select: {
              score: true,
            },
          },
        },
      },
    },
  })
}

router.post('/teacher/assignments', requireTeacher, async (req, res) => {
  try {
    const { classroomId, examId, title, description, dueAt, status } = req.body

    if (!classroomId || !examId) {
      return res.status(400).json({
        message: '班级和试卷不能为空',
      })
    }

    const classroom = await prisma.classroom.findFirst({
      where: {
        id: classroomId,
        teacherId: req.user.id,
      },
    })

    if (!classroom) {
      return res.status(404).json({
        message: '班级不存在或无权访问',
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

    const assignment = await prisma.assignment.create({
      data: {
        classroomId,
        teacherId: req.user.id,
        examId,
        title: title ? String(title).trim() : exam.title,
        description: description ? String(description).trim() : '',
        status: status === 'DRAFT' || status === 'CLOSED' ? status : 'PUBLISHED',
        dueAt: dueAt ? new Date(dueAt) : null,
      },
      include: {
        classroom: true,
        exam: true,
        _count: {
          select: {
            attempts: true,
          },
        },
      },
    })

    res.status(201).json({
      message: '班级任务发布成功',
      data: formatAssignment(assignment),
    })
  } catch (error) {
    console.error('Create assignment error:', error)

    res.status(500).json({
      message: '班级任务发布失败',
      error: error.message,
    })
  }
})

router.get('/teacher/assignments', requireTeacher, async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        teacherId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        classroom: true,
        exam: true,
        _count: {
          select: {
            attempts: true,
          },
        },
      },
    })

    res.json({
      message: '教师任务获取成功',
      data: assignments.map((assignment) => formatAssignment(assignment)),
    })
  } catch (error) {
    console.error('Get teacher assignments error:', error)

    res.status(500).json({
      message: '教师任务获取失败',
      error: error.message,
    })
  }
})

router.get('/teacher/assignments/:assignmentId/submissions', requireTeacher, async (req, res) => {
  try {
    const { assignmentId } = req.params
    const assignment = await getTeacherAssignment(assignmentId, req.user.id)

    if (!assignment) {
      return res.status(404).json({
        message: '任务不存在或无权访问',
      })
    }

    const memberships = await prisma.classStudent.findMany({
      where: {
        classroomId: assignment.classroomId,
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            id: true,
            username: true,
            nickname: true,
            gradeLevel: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    })

    const attempts = await prisma.examAttempt.findMany({
      where: {
        assignmentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            gradeLevel: true,
          },
        },
      },
    })

    const latestAttemptByUser = new Map()

    for (const attempt of attempts) {
      if (!latestAttemptByUser.has(attempt.userId)) {
        latestAttemptByUser.set(attempt.userId, attempt)
      }
    }

    const examTotalScore = assignment.exam.questions.reduce((sum, question) => {
      return sum + Number(question.score || 0)
    }, 0)

    const submissions = memberships.map((membership) => {
      const attempt = latestAttemptByUser.get(membership.studentId)

      return {
        studentId: membership.studentId,
        username: membership.student?.username || '',
        nickname: membership.student?.nickname || '',
        gradeLevel: membership.student?.gradeLevel || '',
        status: attempt ? 'SUBMITTED' : 'NOT_SUBMITTED',
        attemptId: attempt?.id || '',
        totalScore: attempt?.totalScore ?? null,
        examTotalScore: examTotalScore || assignment.exam.totalScore || 0,
        accuracyRate: attempt?.accuracyRate ?? null,
        submitType: attempt?.submitType || '',
        usedTime: attempt?.usedTime ?? null,
        submittedAt: attempt?.submittedAt || attempt?.createdAt || null,
      }
    })

    res.json({
      message: '任务提交情况获取成功',
      data: {
        assignment: formatAssignment({
          ...assignment,
          _count: {
            attempts: attempts.length,
          },
        }),
        submissions,
      },
    })
  } catch (error) {
    console.error('Get assignment submissions error:', error)

    res.status(500).json({
      message: '任务提交情况获取失败',
      error: error.message,
    })
  }
})

router.get('/teacher/assignments/:assignmentId/analytics', requireRole(['TEACHER', 'ADMIN'], '当前账号没有教师或管理员权限'), async (req, res) => {
  try {
    const { assignmentId } = req.params
    const assignmentWhere = {
      id: assignmentId,
    }

    if (req.user.role === 'TEACHER') {
      assignmentWhere.teacherId = req.user.id
    }

    const assignment = await prisma.assignment.findFirst({
      where: assignmentWhere,
      include: {
        classroom: {
          include: {
            students: {
              where: {
                status: 'ACTIVE',
              },
              include: {
                student: {
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                    gradeLevel: true,
                  },
                },
              },
              orderBy: {
                joinedAt: 'asc',
              },
            },
          },
        },
        teacher: {
          select: {
            username: true,
            nickname: true,
          },
        },
        exam: {
          include: {
            questions: {
              orderBy: {
                orderIndex: 'asc',
              },
            },
          },
        },
      },
    })

    if (!assignment) {
      return res.status(404).json({
        message: '任务不存在或无权访问',
      })
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        assignmentId,
      },
      orderBy: [
        {
          submittedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            gradeLevel: true,
          },
        },
        userAnswers: {
          include: {
            question: {
              select: {
                id: true,
                type: true,
                score: true,
              },
            },
          },
        },
      },
    })

    const analytics = buildAssignmentAnalytics({
      assignment,
      memberships: assignment.classroom?.students || [],
      attempts,
    })

    res.json({
      message: '任务统计分析获取成功',
      data: analytics,
    })
  } catch (error) {
    console.error('Get assignment analytics error:', error)

    res.status(500).json({
      message: '任务统计分析获取失败',
      error: error.message,
    })
  }
})

router.get('/student/assignments', requireRole('STUDENT', '只有学生可以查看班级任务'), async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        status: 'PUBLISHED',
        classroom: {
          students: {
            some: {
              studentId: req.user.id,
              status: 'ACTIVE',
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        classroom: {
          include: {
            teacher: {
              select: {
                username: true,
                nickname: true,
              },
            },
          },
        },
        teacher: {
          select: {
            username: true,
            nickname: true,
          },
        },
        exam: true,
        attempts: {
          where: {
            userId: req.user.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            userAnswers: {
              include: {
                question: {
                  select: {
                    id: true,
                    type: true,
                    score: true,
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
    })

    res.json({
      message: '我的班级任务获取成功',
      data: assignments.map((assignment) => formatAssignment(assignment, req.user.id)),
    })
  } catch (error) {
    console.error('Get student assignments error:', error)

    res.status(500).json({
      message: '我的班级任务获取失败',
      error: error.message,
    })
  }
})

module.exports = router
