const express = require('express')
const prisma = require('../lib/prisma')
const { requireAuth } = require('../middlewares/authMiddleware')

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

  const allowedTypes = ['MANUAL', 'AUTO', 'TIMEOUT']

  if (allowedTypes.includes(text)) {
    return text
  }

  return 'MANUAL'
}

const normalizeChoiceAnswer = (answer) => {
  if (answer === null || answer === undefined || answer === '') {
    return null
  }

  if (typeof answer === 'number') {
    return answer
  }

  const text = String(answer).trim().toUpperCase()

  const letterMap = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
  }

  if (letterMap[text] !== undefined) {
    return letterMap[text]
  }

  const numberValue = Number(text)

  if (!Number.isNaN(numberValue)) {
    return numberValue
  }

  return null
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

router.get('/exams', async (req, res) => {
  try {
    const { grade, group } = req.query
    const gradeWhere = buildExamGradeWhere({ grade, group })

    const exams = await prisma.exam.findMany({
      where: {
       isPublished: true,
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

router.post('/attempts/submit', requireAuth, async (req, res) => {
  try {
    const {
      examId,
      answers,
      submitType: rawSubmitType,
      usedTime,
      pauseCount,
    } = req.body

    const submitType = normalizeSubmitType(rawSubmitType)

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
          objectiveScore,
          subjectiveScore,
          totalScore,
          accuracyRate,
          submitType,
          usedTime: Number(usedTime || 0),
          pauseCount: Number(pauseCount || 0),
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