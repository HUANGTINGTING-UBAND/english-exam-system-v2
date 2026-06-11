const express = require('express')
const prisma = require('../lib/prisma')
const { requireAuth } = require('../middlewares/authMiddleware')

const router = express.Router()

const formatAnswer = (question, userAnswer) => {
  if (!userAnswer) {
    return ''
  }

  if (question.type === 'CHOICE') {
    if (
      userAnswer.selectedIndex === null ||
      userAnswer.selectedIndex === undefined
    ) {
      return ''
    }

    const option = Array.isArray(question.options)
      ? question.options[userAnswer.selectedIndex]
      : null

    return option
      ? `${String.fromCharCode(65 + userAnswer.selectedIndex)}. ${option}`
      : String(userAnswer.selectedIndex)
  }

  return userAnswer.answerText || ''
}

const formatCorrectAnswer = (question) => {
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

router.get('/attempts/:attemptId/detail', requireAuth, async (req, res) => {
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
        message: '你无权查看这次考试记录',
      })
    }

    const exam = await prisma.exam.findUnique({
      where: {
        id: attempt.examId,
      },
    })

    const answers = await prisma.userAnswer.findMany({
      where: {
        attemptId,
      },
    })

    const questionIds = answers.map((answer) => answer.questionId)

    const questions = await prisma.question.findMany({
      where: {
        id: {
          in: questionIds,
        },
      },
    })

    const questionMap = new Map(
      questions.map((question) => [question.id, question])
    )

    const detailItems = answers
      .map((answer) => {
        const question = questionMap.get(answer.questionId)

        if (!question) {
          return null
        }

        return {
          answerId: answer.id,
          questionId: question.id,
          orderIndex: question.orderIndex,
          type: question.type,
          text: question.text,
          options: question.options,
          score: question.score,
          userScore: answer.score,
          isCorrect: answer.isCorrect,
          selectedIndex: answer.selectedIndex,
          answerText: answer.answerText,
          userAnswerDisplay: formatAnswer(question, answer),
          correctAnswerDisplay: formatCorrectAnswer(question),
          referenceAnswer: question.referenceAnswer,
          explanation: question.explanation,
          knowledgePoint: question.knowledgePoint,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.orderIndex - b.orderIndex)

    res.json({
      message: '考试结果详情获取成功',
      data: {
        attempt: {
          id: attempt.id,
          examId: attempt.examId,
          userId: attempt.userId,
          objectiveScore: attempt.objectiveScore,
          subjectiveScore: attempt.subjectiveScore,
          totalScore: attempt.totalScore,
          accuracyRate: attempt.accuracyRate,
          submitType: attempt.submitType,
          usedTime: attempt.usedTime,
          pauseCount: attempt.pauseCount,
          submittedAt: attempt.submittedAt,
        },
        exam: exam
          ? {
              id: exam.id,
              title: exam.title,
              gradeLevel: exam.gradeLevel,
              description: exam.description,
              totalScore: exam.totalScore,
              timeLimit: exam.timeLimit,
            }
          : null,
        answers: detailItems,
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '考试结果详情获取失败',
      error: error.message,
    })
  }
})

module.exports = router
