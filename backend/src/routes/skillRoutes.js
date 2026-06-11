const express = require('express')
const prisma = require('../lib/prisma')
const { requireTeacherOrAdmin } = require('../middlewares/authMiddleware')

const router = express.Router()

const toSkillCode = (value) => {
  const code = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return code || `skill-${Date.now()}`
}

const buildSkillWhere = (req, id) => {
  const where = {}

  if (id) {
    where.id = id
  }

  if (req.user.role !== 'ADMIN') {
    where.OR = [
      {
        createdById: req.user.id,
      },
      {
        createdById: null,
      },
    ]
  }

  return where
}

const formatSkill = (skill) => {
  return {
    id: skill.id,
    name: skill.name,
    code: skill.code,
    description: skill.description,
    isActive: skill.isActive,
    config: skill.config,
    createdById: skill.createdById,
    creatorName: skill.creator?.nickname || skill.creator?.username || '',
    runCount: skill._count?.runs || skill.runs?.length || 0,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }
}

router.post('/skills', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { name, code, description, config, isActive } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: 'Skill 名称不能为空',
      })
    }

    const skill = await prisma.generationSkill.create({
      data: {
        createdById: req.user.id,
        name: String(name).trim(),
        code: toSkillCode(code || name),
        description: description ? String(description).trim() : '',
        config: config || {},
        isActive: isActive === undefined ? true : Boolean(isActive),
      },
      include: {
        creator: {
          select: {
            username: true,
            nickname: true,
          },
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })

    res.status(201).json({
      message: 'Skill 创建成功',
      data: formatSkill(skill),
    })
  } catch (error) {
    console.error('Create skill error:', error)

    res.status(500).json({
      message: 'Skill 创建失败',
      error: error.message,
    })
  }
})

router.get('/skills', requireTeacherOrAdmin, async (req, res) => {
  try {
    const skills = await prisma.generationSkill.findMany({
      where: buildSkillWhere(req),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        creator: {
          select: {
            username: true,
            nickname: true,
          },
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })

    res.json({
      message: 'Skill 列表获取成功',
      data: skills.map(formatSkill),
    })
  } catch (error) {
    console.error('Get skills error:', error)

    res.status(500).json({
      message: 'Skill 列表获取失败',
      error: error.message,
    })
  }
})

const updateSkillActiveStatus = async (req, res, isActive) => {
  try {
    const { id } = req.params

    const existingSkill = await prisma.generationSkill.findFirst({
      where: buildSkillWhere(req, id),
    })

    if (!existingSkill) {
      return res.status(404).json({
        message: 'Skill 不存在或无权访问',
      })
    }

    const skill = await prisma.generationSkill.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
      include: {
        creator: {
          select: {
            username: true,
            nickname: true,
          },
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })

    res.json({
      message: isActive ? 'Skill 已启用' : 'Skill 已停用',
      data: formatSkill(skill),
    })
  } catch (error) {
    console.error('Update skill status error:', error)

    res.status(500).json({
      message: 'Skill 状态更新失败',
      error: error.message,
    })
  }
}

router.patch('/skills/:id/activate', requireTeacherOrAdmin, async (req, res) => {
  await updateSkillActiveStatus(req, res, true)
})

router.patch('/skills/:id/deactivate', requireTeacherOrAdmin, async (req, res) => {
  await updateSkillActiveStatus(req, res, false)
})

module.exports = router
