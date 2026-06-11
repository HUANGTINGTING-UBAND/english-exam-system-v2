const express = require('express')
const prisma = require('../lib/prisma')
const { requireAuth } = require('../middlewares/authMiddleware')

const router = express.Router()

const formatCorrectAnswer = (question) => {
  if (!question) {
    return ''
  }

  if (question.answer === null || question.answer === undefined || question.answer === '') {
    return question.referenceAnswer || ''
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

router.get('/wrong-questions/:wrongQuestionId/practice', requireAuth, async (req, res) => {
  try {
    const { wrongQuestionId } = req.params

    const wrongQuestion = await prisma.wrongQuestion.findFirst({
      where: {
        id: wrongQuestionId,
        userId: req.user.id,
      },
    })

    if (!wrongQuestion) {
      return res.status(404).json({
        message: '错题不存在或无权访问',
      })
    }

    const question = await prisma.question.findUnique({
      where: {
        id: wrongQuestion.questionId,
      },
    })

    if (!question) {
      return res.status(404).json({
        message: '原题目不存在，可能已被管理员删除',
      })
    }

    const exam = await prisma.exam.findUnique({
      where: {
        id: wrongQuestion.examId,
      },
    })

    res.json({
      message: '错题练习详情获取成功',
      data: {
        wrongQuestion: {
          id: wrongQuestion.id,
          reason: wrongQuestion.reason,
          note: wrongQuestion.note,
          createdAt: wrongQuestion.createdAt,
        },
        exam: exam
          ? {
              id: exam.id,
              title: exam.title,
              gradeLevel: exam.gradeLevel,
            }
          : null,
        question: {
          id: question.id,
          type: question.type,
          text: question.text,
          options: question.options,
          answer: question.answer,
          score: question.score,
          knowledgePoint: question.knowledgePoint,
          referenceAnswer: question.referenceAnswer,
          explanation: question.explanation,
          orderIndex: question.orderIndex,
          correctAnswerDisplay: formatCorrectAnswer(question),
        },
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '错题练习详情获取失败',
      error: error.message,
    })
  }
})

router.delete('/wrong-questions/:wrongQuestionId', requireAuth, async (req, res) => {
  try {
    const { wrongQuestionId } = req.params

    const wrongQuestion = await prisma.wrongQuestion.findFirst({
      where: {
        id: wrongQuestionId,
        userId: req.user.id,
      },
    })

    if (!wrongQuestion) {
      return res.status(404).json({
        message: '错题不存在或无权访问',
      })
    }

    await prisma.wrongQuestion.delete({
      where: {
        id: wrongQuestionId,
      },
    })

    res.json({
      message: '错题已标记为掌握',
      data: wrongQuestion,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '标记错题已掌握失败',
      error: error.message,
    })
  }
})

module.exports = router
