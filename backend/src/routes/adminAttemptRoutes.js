const express = require('express')
const prisma = require('../lib/prisma')
const { requireAuth } = require('../middlewares/authMiddleware')

const router = express.Router()

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      message: '只有管理员可以访问该接口',
    })
  }

  next()
}

router.get('/admin/attempts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const attempts = await prisma.examAttempt.findMany({
      orderBy: {
        submittedAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            role: true,
            gradeLevel: true,
          },
        },
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
                id: true,
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

      const fullScore = realExamTotalScore || Number(attempt.exam?.totalScore || 0)
      const totalScore = Number(attempt.totalScore || 0)

      const scoreRate =
        fullScore > 0
          ? Math.round((totalScore / fullScore) * 100)
          : 0

      return {
        id: attempt.id,
        userId: attempt.userId,
        username: attempt.user?.username || '未知用户',
        nickname: attempt.user?.nickname || '',
        userGradeLevel: attempt.user?.gradeLevel || '',
        examId: attempt.examId,
        examTitle: attempt.exam?.title || '未知试卷',
        examGradeLevel: attempt.exam?.gradeLevel || '',
        totalScore,
        examTotalScore: fullScore,
        scoreRate,
        accuracyRate: attempt.accuracyRate,
        objectiveScore: attempt.objectiveScore,
        subjectiveScore: attempt.subjectiveScore,
        submitType: attempt.submitType,
        usedTime: attempt.usedTime,
        pauseCount: attempt.pauseCount,
        answerCount: attempt.userAnswers.length,
        submittedAt: attempt.submittedAt,
      }
    })

    res.json({
      message: '管理员考试记录获取成功',
      data: formattedAttempts,
    })
  } catch (error) {
    console.error('Get admin attempts error:', error)

    res.status(500).json({
      message: '管理员考试记录获取失败',
      error: error.message,
    })
  }
})

module.exports = router