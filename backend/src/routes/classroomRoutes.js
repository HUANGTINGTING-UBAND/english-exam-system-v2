const crypto = require('crypto')
const express = require('express')
const prisma = require('../lib/prisma')
const { requireRole, requireTeacher } = require('../middlewares/authMiddleware')

const router = express.Router()

const generateInviteCode = () => {
  return `CLASS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

const createUniqueInviteCode = async () => {
  for (let index = 0; index < 10; index += 1) {
    const inviteCode = generateInviteCode()
    const existing = await prisma.classroom.findUnique({
      where: {
        inviteCode,
      },
    })

    if (!existing) {
      return inviteCode
    }
  }

  return `CLASS-${Date.now().toString(36).toUpperCase()}`
}

const formatClassroom = (classroom) => {
  return {
    id: classroom.id,
    name: classroom.name,
    description: classroom.description,
    inviteCode: classroom.inviteCode,
    teacherId: classroom.teacherId,
    teacherName: classroom.teacher?.nickname || classroom.teacher?.username || '',
    studentCount: classroom._count?.students || classroom.students?.length || 0,
    assignmentCount: classroom._count?.assignments || classroom.assignments?.length || 0,
    createdAt: classroom.createdAt,
    updatedAt: classroom.updatedAt,
  }
}

router.post('/teacher/classrooms', requireTeacher, async (req, res) => {
  try {
    const { name, description } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: '班级名称不能为空',
      })
    }

    const inviteCode = await createUniqueInviteCode()

    const classroom = await prisma.classroom.create({
      data: {
        teacherId: req.user.id,
        name: String(name).trim(),
        description: description ? String(description).trim() : '',
        inviteCode,
      },
      include: {
        _count: {
          select: {
            students: true,
            assignments: true,
          },
        },
      },
    })

    res.status(201).json({
      message: '班级创建成功',
      data: formatClassroom(classroom),
    })
  } catch (error) {
    console.error('Create classroom error:', error)

    res.status(500).json({
      message: '班级创建失败',
      error: error.message,
    })
  }
})

router.get('/teacher/classrooms', requireTeacher, async (req, res) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      where: {
        teacherId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            students: true,
            assignments: true,
          },
        },
      },
    })

    res.json({
      message: '教师班级获取成功',
      data: classrooms.map(formatClassroom),
    })
  } catch (error) {
    console.error('Get teacher classrooms error:', error)

    res.status(500).json({
      message: '教师班级获取失败',
      error: error.message,
    })
  }
})

router.get('/teacher/classrooms/:id/students', requireTeacher, async (req, res) => {
  try {
    const { id } = req.params

    const classroom = await prisma.classroom.findFirst({
      where: {
        id,
        teacherId: req.user.id,
      },
    })

    if (!classroom) {
      return res.status(404).json({
        message: '班级不存在或无权访问',
      })
    }

    const students = await prisma.classStudent.findMany({
      where: {
        classroomId: id,
        status: 'ACTIVE',
      },
      orderBy: {
        joinedAt: 'desc',
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
    })

    res.json({
      message: '班级学生获取成功',
      data: students.map((item) => ({
        id: item.id,
        classroomId: item.classroomId,
        studentId: item.studentId,
        username: item.student?.username || '',
        nickname: item.student?.nickname || '',
        gradeLevel: item.student?.gradeLevel || '',
        status: item.status,
        joinedAt: item.joinedAt,
      })),
    })
  } catch (error) {
    console.error('Get classroom students error:', error)

    res.status(500).json({
      message: '班级学生获取失败',
      error: error.message,
    })
  }
})

router.post('/student/classrooms/join', requireRole('STUDENT', '只有学生可以加入班级'), async (req, res) => {
  try {
    const { inviteCode } = req.body

    if (!inviteCode || !String(inviteCode).trim()) {
      return res.status(400).json({
        message: '班级邀请码不能为空',
      })
    }

    const classroom = await prisma.classroom.findUnique({
      where: {
        inviteCode: String(inviteCode).trim().toUpperCase(),
      },
      include: {
        teacher: {
          select: {
            username: true,
            nickname: true,
          },
        },
      },
    })

    if (!classroom) {
      return res.status(404).json({
        message: '班级邀请码不存在',
      })
    }

    const membership = await prisma.classStudent.upsert({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId: req.user.id,
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        classroomId: classroom.id,
        studentId: req.user.id,
        status: 'ACTIVE',
      },
    })

    res.status(201).json({
      message: '加入班级成功',
      data: {
        membership,
        classroom: formatClassroom(classroom),
      },
    })
  } catch (error) {
    console.error('Join classroom error:', error)

    res.status(500).json({
      message: '加入班级失败',
      error: error.message,
    })
  }
})

router.get('/student/classrooms', requireRole('STUDENT', '只有学生可以查看自己的班级'), async (req, res) => {
  try {
    const memberships = await prisma.classStudent.findMany({
      where: {
        studentId: req.user.id,
        status: 'ACTIVE',
      },
      orderBy: {
        joinedAt: 'desc',
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
            _count: {
              select: {
                students: true,
                assignments: true,
              },
            },
          },
        },
      },
    })

    res.json({
      message: '我的班级获取成功',
      data: memberships.map((item) => ({
        membershipId: item.id,
        joinedAt: item.joinedAt,
        ...formatClassroom(item.classroom),
      })),
    })
  } catch (error) {
    console.error('Get student classrooms error:', error)

    res.status(500).json({
      message: '我的班级获取失败',
      error: error.message,
    })
  }
})

module.exports = router
