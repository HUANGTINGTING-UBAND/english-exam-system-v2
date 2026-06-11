const express = require('express')
const prisma = require('../lib/prisma')
const { requireTeacherOrAdmin } = require('../middlewares/authMiddleware')

const router = express.Router()

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

const normalizeEnum = (value, allowedValues, fallback = null) => {
  const normalized = String(value || '').trim().toUpperCase()
  return allowedValues.has(normalized) ? normalized : fallback
}

const buildJobWhere = (req, id) => {
  const where = {}

  if (id) {
    where.id = id
  }

  if (req.user.role !== 'ADMIN') {
    where.createdById = req.user.id
  }

  return where
}

const formatImportJob = (job) => {
  return {
    id: job.id,
    title: job.title,
    gradeLevel: job.gradeLevel,
    status: job.status,
    sourceType: job.sourceType,
    rawText: job.rawText,
    createdById: job.createdById,
    creatorName: job.creator?.nickname || job.creator?.username || '',
    draftQuestionCount: job._count?.draftQuestions || job.draftQuestions?.length || 0,
    draftMaterialCount: job._count?.draftMaterials || job.draftMaterials?.length || 0,
    warningCount: job._count?.warnings || job.warnings?.length || 0,
    draftQuestions: job.draftQuestions || undefined,
    draftMaterials: job.draftMaterials || undefined,
    warnings: job.warnings || undefined,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

router.post('/import/jobs', requireTeacherOrAdmin, async (req, res) => {
  try {
    const {
      title,
      gradeLevel,
      sourceType,
      rawText,
      draftQuestions = [],
      draftMaterials = [],
      warnings = [],
    } = req.body

    const finalTitle = title ? String(title).trim() : '未命名导入草稿'

    const createdJob = await prisma.importJob.create({
      data: {
        createdById: req.user.id,
        title: finalTitle,
        gradeLevel: normalizeEnum(gradeLevel, gradeLevels),
        sourceType: sourceType ? String(sourceType).trim() : 'manual',
        rawText: rawText ? String(rawText) : '',
        draftMaterials: {
          create: Array.isArray(draftMaterials)
            ? draftMaterials.map((material, index) => ({
                type: normalizeEnum(material.type, materialTypes, 'READING'),
                title: material.title ? String(material.title).trim() : '',
                content: String(material.content || ''),
                audioUrl: material.audioUrl ? String(material.audioUrl).trim() : '',
                transcript: material.transcript ? String(material.transcript) : '',
                orderIndex: Number(material.orderIndex || index + 1),
              }))
            : [],
        },
        draftQuestions: {
          create: Array.isArray(draftQuestions)
            ? draftQuestions.map((question, index) => ({
                type: normalizeEnum(question.type, questionTypes, 'CHOICE'),
                text: String(question.text || ''),
                options: Array.isArray(question.options) ? question.options : null,
                answer:
                  question.answer === undefined || question.answer === ''
                    ? null
                    : question.answer,
                score:
                  question.score === undefined || question.score === ''
                    ? null
                    : Number(question.score),
                knowledgePoint: question.knowledgePoint || '未分类',
                referenceAnswer: question.referenceAnswer || '',
                explanation: question.explanation || '',
                orderIndex: Number(question.orderIndex || index + 1),
              }))
            : [],
        },
        warnings: {
          create: Array.isArray(warnings)
            ? warnings.map((warning) => ({
                level: warning.level ? String(warning.level) : 'warning',
                field: warning.field ? String(warning.field) : '',
                message: String(warning.message || '导入草稿存在待确认项'),
              }))
            : [],
        },
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
            draftQuestions: true,
            draftMaterials: true,
            warnings: true,
          },
        },
      },
    })

    res.status(201).json({
      message: '导入草稿创建成功',
      data: formatImportJob(createdJob),
    })
  } catch (error) {
    console.error('Create import job error:', error)

    res.status(500).json({
      message: '导入草稿创建失败',
      error: error.message,
    })
  }
})

router.get('/import/jobs', requireTeacherOrAdmin, async (req, res) => {
  try {
    const jobs = await prisma.importJob.findMany({
      where: buildJobWhere(req),
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
            draftQuestions: true,
            draftMaterials: true,
            warnings: true,
          },
        },
      },
    })

    res.json({
      message: '导入草稿列表获取成功',
      data: jobs.map(formatImportJob),
    })
  } catch (error) {
    console.error('Get import jobs error:', error)

    res.status(500).json({
      message: '导入草稿列表获取失败',
      error: error.message,
    })
  }
})

router.get('/import/jobs/:id', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const job = await prisma.importJob.findFirst({
      where: buildJobWhere(req, id),
      include: {
        creator: {
          select: {
            username: true,
            nickname: true,
          },
        },
        draftMaterials: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
        draftQuestions: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
        warnings: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    res.json({
      message: '导入草稿详情获取成功',
      data: formatImportJob(job),
    })
  } catch (error) {
    console.error('Get import job detail error:', error)

    res.status(500).json({
      message: '导入草稿详情获取失败',
      error: error.message,
    })
  }
})

module.exports = router
