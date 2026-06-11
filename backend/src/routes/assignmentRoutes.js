const express = require('express')
const prisma = require('../lib/prisma')
const { requireRole, requireTeacher } = require('../middlewares/authMiddleware')

const router = express.Router()

const formatAssignment = (assignment, currentUserId = '') => {
  const attempts = assignment.attempts || []
  const latestAttempt = attempts[0] || null

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
        }
      : null,
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
