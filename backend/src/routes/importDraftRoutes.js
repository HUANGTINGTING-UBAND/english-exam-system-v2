const express = require('express')
const mammoth = require('mammoth')
const multer = require('multer')
const pdfParseModule = require('pdf-parse')
const prisma = require('../lib/prisma')
const { requireTeacherOrAdmin } = require('../middlewares/authMiddleware')

const pdfParse = pdfParseModule.default || pdfParseModule
const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})

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

const normalizeChoiceAnswer = (answer) => {
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
  return Number.isNaN(numberValue) ? answer : numberValue
}

const getDefaultScore = (type) => {
  if (type === 'WRITING') return 10
  if (type === 'TRANSLATION' || type === 'ERROR_CORRECTION') return 5
  return 2
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

const parseJsonArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value
  }

  if (!value) {
    return fallback
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (error) {
    return fallback
  }
}

const parseJsonValue = (value, fallback = null) => {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    return value
  }
}

const readUploadedText = async (file) => {
  if (!file) {
    return ''
  }

  const originalName = String(file.originalname || '').toLowerCase()
  const mimeType = String(file.mimetype || '').toLowerCase()

  if (originalName.endsWith('.txt') || mimeType.includes('text/plain')) {
    return file.buffer.toString('utf8')
  }

  if (
    originalName.endsWith('.docx') ||
    mimeType.includes('wordprocessingml.document')
  ) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    })

    return result.value || ''
  }

  if (originalName.endsWith('.pdf') || mimeType.includes('pdf')) {
    const result = await pdfParse(file.buffer)
    return result.text || ''
  }

  throw new Error('暂时只支持 TXT、DOCX 和文字型 PDF 文件')
}

const normalizeRawText = (rawText) => {
  return String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim()
}

const extractAnswerMap = (text) => {
  const answerMap = new Map()
  const answerLabelMatch = text.match(/(?:参考答案|答案解析|答案|Answer Key|Answers)\s*[:：]?\s*/i)

  if (!answerLabelMatch) {
    return answerMap
  }

  const answerText = text.slice(answerLabelMatch.index)
  const pairRegex = /(?:^|\s)(\d{1,3})\s*[\.\、．\):：-]?\s*([A-D])(?=\s|$|[，,;；])/gi
  let match = pairRegex.exec(answerText)

  while (match) {
    answerMap.set(Number(match[1]), match[2].toUpperCase())
    match = pairRegex.exec(answerText)
  }

  return answerMap
}

const parseOptionsFromBlock = (blockText) => {
  const textBeforeAnswer = blockText.split(/(?:参考答案|答案|解析|知识点|分值)\s*[:：]/)[0]
  const normalized = textBeforeAnswer.replace(/\n+/g, '\n')
  const optionRegex = /(?:^|\n|\s)([A-D])[\.\、．\)]\s*([\s\S]*?)(?=(?:\n|\s)[A-D][\.\、．\)]\s*|$)/gi
  const options = []
  let match = optionRegex.exec(normalized)

  while (match) {
    const option = String(match[2] || '')
      .replace(/\n+/g, ' ')
      .trim()

    if (option) {
      options.push(option)
    }

    match = optionRegex.exec(normalized)
  }

  return options.slice(0, 4)
}

const strictQuestionFieldNames = [
  '题型标题',
  '题号',
  '原试卷题号',
  '题型',
  '题干',
  '选项',
  '答案',
  '解析',
  '知识点',
  '分值',
]

const strictQuestionFieldLineRegex = new RegExp(
  `^\\s*(${strictQuestionFieldNames.join('|')})\\s*[:：]\\s*(.*)$`
)

const parseStrictQuestionFields = (blockText) => {
  const fields = {}
  let currentField = ''

  for (const line of String(blockText || '').split('\n')) {
    const match = line.match(strictQuestionFieldLineRegex)

    if (match) {
      currentField = match[1]
      fields[currentField] = fields[currentField]
        ? `${fields[currentField]}\n${match[2] || ''}`
        : match[2] || ''
      continue
    }

    if (currentField) {
      fields[currentField] = fields[currentField]
        ? `${fields[currentField]}\n${line}`
        : line
    }
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      return [key, String(value || '').trim()]
    })
  )
}

const normalizeStrictQuestionType = (typeText, titleText = '') => {
  const rawType = String(typeText || '').trim().toUpperCase()
  const rawTitle = String(titleText || '').trim()
  const titleLower = rawTitle.toLowerCase()

  if (questionTypes.has(rawType)) {
    return rawType
  }

  if (rawType.includes('WRITING') || rawTitle.includes('写作') || rawTitle.includes('作文')) {
    return 'WRITING'
  }

  if (rawType.includes('TRANSLATION') || rawTitle.includes('翻译')) {
    return 'TRANSLATION'
  }

  if (rawType.includes('CLOZE') || rawTitle.includes('完形') || rawTitle.includes('选词填空')) {
    return 'CLOZE'
  }

  if (
    rawType.includes('READING') ||
    rawTitle.includes('阅读') ||
    titleLower.includes('reading')
  ) {
    return 'READING'
  }

  if (rawType.includes('ERROR') || rawTitle.includes('改错')) {
    return 'ERROR_CORRECTION'
  }

  if (rawType.includes('CHOICE') || rawTitle.includes('选择') || rawTitle.includes('听力')) {
    return 'CHOICE'
  }

  return null
}

const parseStrictOptions = (optionsText) => {
  const normalized = String(optionsText || '').trim()

  if (!normalized || normalized === '无' || normalized.toUpperCase() === 'NONE') {
    return null
  }

  const optionRegex = /(?:^|\n)\s*([A-O])[\.\、．\)]\s*([\s\S]*?)(?=(?:\n\s*[A-O][\.\、．\)]\s*)|$)/gi
  const options = []
  let match = optionRegex.exec(normalized)

  while (match) {
    const option = String(match[2] || '')
      .replace(/\n+/g, ' ')
      .trim()

    if (option) {
      options.push(option)
    }

    match = optionRegex.exec(normalized)
  }

  if (options.length > 0) {
    return options
  }

  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const parseStrictChineseQuestionFormat = (rawText) => {
  const text = normalizeRawText(rawText)
  const warnings = []
  const blockRegex = /【题目开始】([\s\S]*?)【题目结束】/g
  const blocks = [...text.matchAll(blockRegex)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean)

  if (blocks.length === 0) {
    return {
      draftMaterials: [],
      draftQuestions: [],
      warnings: [
        {
          level: 'error',
          field: 'questions',
          message: '检测到严格题目块标记，但解析字段失败，请检查字段名或解析器规则。',
        },
      ],
    }
  }

  const draftQuestions = blocks.map((blockText, index) => {
    const fields = parseStrictQuestionFields(blockText)
    const orderIndex = Number(fields.题号 || index + 1)
    const originalQuestionNumber = fields.原试卷题号 || ''
    const title = fields.题型标题 || ''
    const type = normalizeStrictQuestionType(fields.题型, title)
    const options = parseStrictOptions(fields.选项)
    const answerText = fields.答案 || ''
    const score = fields.分值 === undefined || fields.分值 === ''
      ? null
      : Number(fields.分值)
    const metadataLines = [
      title ? `题型标题：${title}` : '',
      originalQuestionNumber ? `原试卷题号：${originalQuestionNumber}` : '',
    ].filter(Boolean)
    const explanationParts = [
      ...metadataLines,
      fields.解析 || '',
    ].filter(Boolean)

    if (!type) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.type`,
        message: `第 ${orderIndex} 题题型缺失或无法识别，请人工确认`,
      })
    }

    if (!fields.题干) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.text`,
        message: `第 ${orderIndex} 题题干为空，请人工补充`,
      })
    }

    if (!answerText) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.answer`,
        message: `第 ${orderIndex} 题未填写答案，请人工补充`,
      })
    }

    if (score === null || Number.isNaN(score)) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.score`,
        message: `第 ${orderIndex} 题分值缺失或格式异常，确认入库时将使用默认分值`,
      })
    }

    return {
      type: type || 'CHOICE',
      text: fields.题干 || `第 ${orderIndex} 题`,
      options: options && options.length > 0 ? options : null,
      answer: type === 'CHOICE' || type === 'CLOZE'
        ? normalizeChoiceAnswer(answerText)
        : answerText || null,
      score: score === null || Number.isNaN(score) ? null : score,
      knowledgePoint: fields.知识点 || '未分类',
      referenceAnswer: answerText,
      explanation: explanationParts.join('\n\n'),
      orderIndex: Number.isNaN(orderIndex) ? index + 1 : orderIndex,
    }
  })

  if (draftQuestions.length === 0) {
    warnings.push({
      level: 'error',
      field: 'questions',
      message: '检测到严格题目块标记，但解析字段失败，请检查字段名或解析器规则。',
    })
  }

  return {
    draftMaterials: [],
    draftQuestions,
    warnings,
  }
}

const stripQuestionText = (blockText) => {
  const withoutLabels = blockText
    .replace(/^(?:\s*\d{1,3}[\.\、．\)]\s*)/, '')
    .split(/(?:参考答案|答案|解析|知识点|分值)\s*[:：]/)[0]

  const optionIndex = withoutLabels.search(/(?:^|\n|\s)[A-D][\.\、．\)]\s*/)
  const text = optionIndex >= 0 ? withoutLabels.slice(0, optionIndex) : withoutLabels

  return text.replace(/\n+/g, ' ').trim()
}

const getInlineValue = (blockText, labels) => {
  const labelPattern = labels.join('|')
  const regex = new RegExp(`(?:${labelPattern})\\s*[:：]\\s*([^\\n]+)`, 'i')
  const match = blockText.match(regex)
  return match ? match[1].trim() : ''
}

const inferQuestionType = (blockText, options) => {
  if (options.length > 0) {
    return 'CHOICE'
  }

  const text = blockText.toLowerCase()

  if (text.includes('translate') || blockText.includes('翻译')) {
    return 'TRANSLATION'
  }

  if (text.includes('writing') || blockText.includes('写作') || blockText.includes('作文')) {
    return 'WRITING'
  }

  if (blockText.includes('改错')) {
    return 'ERROR_CORRECTION'
  }

  return 'CHOICE'
}

const parseImportText = (rawText) => {
  const text = normalizeRawText(rawText)
  const warnings = []

  if (!text) {
    return {
      draftMaterials: [],
      draftQuestions: [],
      warnings: [
        {
          level: 'error',
          field: 'rawText',
          message: '未能读取到可解析文本',
        },
      ],
    }
  }

  if (text.includes('【题目开始】') || text.includes('【题目结束】')) {
    return parseStrictChineseQuestionFormat(text)
  }

  const answerMap = extractAnswerMap(text)
  const answerStartMatch = text.match(/\n\s*(?:参考答案|答案解析|答案|Answer Key|Answers)\s*[:：]?/i)
  const questionText = answerStartMatch ? text.slice(0, answerStartMatch.index) : text
  const questionRegex = /(?:^|\n)\s*(\d{1,3})[\.\、．\)]\s+([\s\S]*?)(?=(?:\n\s*\d{1,3}[\.\、．\)]\s+)|$)/g
  const matches = [...questionText.matchAll(questionRegex)]

  if (matches.length === 0) {
    return {
      draftMaterials: [],
      draftQuestions: [],
      warnings: [
        {
          level: 'error',
          field: 'questions',
          message: '未识别到题号，请人工拆分题目',
        },
      ],
    }
  }

  const firstQuestionIndex = matches[0].index || 0
  const preamble = questionText.slice(0, firstQuestionIndex).trim()
  const shouldCreateMaterial =
    preamble.length > 80 ||
    /(passage|read the following|阅读材料|阅读理解|听力材料|材料)/i.test(preamble)

  const materialKey = shouldCreateMaterial ? 'material-1' : null
  const draftMaterials = shouldCreateMaterial
    ? [
        {
          key: materialKey,
          type: /听力/.test(preamble) ? 'LISTENING' : 'READING',
          title: /听力/.test(preamble) ? '听力材料 1' : '阅读材料 1',
          content: preamble,
          orderIndex: 1,
        },
      ]
    : []

  if (!shouldCreateMaterial && preamble.length > 0) {
    warnings.push({
      level: 'warning',
      field: 'materials',
      message: '题目前存在未绑定材料文本，请人工确认是否为阅读或听力材料',
    })
  }

  const draftQuestions = matches.map((match, index) => {
    const orderIndex = Number(match[1] || index + 1)
    const blockText = String(match[2] || '').trim()
    const options = parseOptionsFromBlock(blockText)
    const type = inferQuestionType(blockText, options)
    const inlineAnswer = getInlineValue(blockText, ['参考答案', '答案'])
    const answer = inlineAnswer || answerMap.get(orderIndex) || null
    const scoreText = getInlineValue(blockText, ['分值', 'score'])
    const knowledgePoint = getInlineValue(blockText, ['知识点']) || '未分类'
    const explanation = getInlineValue(blockText, ['解析']) || ''
    const textValue = stripQuestionText(blockText)

    if (!textValue) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.text`,
        message: `第 ${orderIndex} 题题干识别为空，请人工补充`,
      })
    }

    if (type === 'CHOICE' && options.length < 2) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.options`,
        message: `第 ${orderIndex} 题选择题选项不足，请人工确认`,
      })
    }

    if (type === 'CHOICE' && !answer) {
      warnings.push({
        level: 'warning',
        field: `question.${orderIndex}.answer`,
        message: `第 ${orderIndex} 题未识别到答案，请人工补充`,
      })
    }

    if (!scoreText) {
      warnings.push({
        level: 'info',
        field: `question.${orderIndex}.score`,
        message: `第 ${orderIndex} 题未识别到分值，确认入库时将使用默认分值`,
      })
    }

    return {
      materialKey,
      type,
      text: textValue || `第 ${orderIndex} 题`,
      options: options.length > 0 ? options : null,
      answer: type === 'CHOICE' ? normalizeChoiceAnswer(answer) : answer,
      score: scoreText ? Number(scoreText) : null,
      knowledgePoint,
      referenceAnswer: answer || '',
      explanation,
      orderIndex,
    }
  })

  return {
    draftMaterials,
    draftQuestions,
    warnings,
  }
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

const getImportJobForUser = async (req, id, include = {}) => {
  return prisma.importJob.findFirst({
    where: buildJobWhere(req, id),
    include,
  })
}

const getFullImportJobForUser = async (req, id) => {
  return getImportJobForUser(req, id, {
    draftMaterials: {
      orderBy: {
        orderIndex: 'asc',
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    },
    draftQuestions: {
      orderBy: {
        orderIndex: 'asc',
      },
      include: {
        material: true,
      },
    },
    warnings: {
      orderBy: {
        createdAt: 'asc',
      },
    },
  })
}

const buildImportValidation = (job) => {
  const errors = []
  const warnings = []
  const draftQuestions = job?.draftQuestions || []
  const draftMaterials = job?.draftMaterials || []
  const materialIds = new Set(draftMaterials.map((material) => material.id))
  const orderIndexCount = new Map()

  if (draftQuestions.length === 0) {
    errors.push({
      code: 'NO_DRAFT_QUESTIONS',
      message: '至少需要 1 道草稿题目才能确认入库',
    })
  }

  for (const warning of job?.warnings || []) {
    if (warning.level === 'error' && !warning.isResolved) {
      errors.push({
        code: 'UNRESOLVED_ERROR_WARNING',
        message: `存在未处理的严重 warning：${warning.message}`,
      })
    }
  }

  for (const question of draftQuestions) {
    const type = normalizeEnum(question.type, questionTypes, null)
    const orderIndex = Number(question.orderIndex || 0)
    orderIndexCount.set(orderIndex, (orderIndexCount.get(orderIndex) || 0) + 1)

    if (!type) {
      errors.push({
        code: 'MISSING_QUESTION_TYPE',
        questionId: question.id,
        message: `第 ${question.orderIndex} 题题型缺失`,
      })
    }

    if (type === 'CHOICE') {
      const options = Array.isArray(question.options) ? question.options : []

      if (options.length === 0) {
        errors.push({
          code: 'CHOICE_WITHOUT_OPTIONS',
          questionId: question.id,
          message: `第 ${question.orderIndex} 题是选择题，但没有选项`,
        })
      }

      if (question.answer === null || question.answer === undefined || question.answer === '') {
        warnings.push({
          code: 'CHOICE_WITHOUT_ANSWER',
          questionId: question.id,
          message: `第 ${question.orderIndex} 题未填写客观题答案`,
        })
      }
    }

    if (question.score === null || question.score === undefined || Number.isNaN(Number(question.score))) {
      warnings.push({
        code: 'MISSING_SCORE',
        questionId: question.id,
        message: `第 ${question.orderIndex} 题缺少分值，入库时将使用默认分值`,
      })
    }

    if (question.materialId && !materialIds.has(question.materialId)) {
      errors.push({
        code: 'QUESTION_BOUND_TO_MISSING_MATERIAL',
        questionId: question.id,
        message: `第 ${question.orderIndex} 题绑定了不存在的草稿材料`,
      })
    }

    if (!question.materialId && draftMaterials.length > 0) {
      warnings.push({
        code: 'QUESTION_WITHOUT_MATERIAL',
        questionId: question.id,
        message: `第 ${question.orderIndex} 题未绑定材料，请确认是否符合预期`,
      })
    }
  }

  for (const [orderIndex, count] of orderIndexCount.entries()) {
    if (orderIndex && count > 1) {
      errors.push({
        code: 'DUPLICATED_ORDER_INDEX',
        message: `题号/orderIndex ${orderIndex} 重复`,
      })
    }
  }

  for (const material of draftMaterials) {
    const boundQuestionCount = draftQuestions.filter((question) => {
      return question.materialId === material.id
    }).length

    if (boundQuestionCount === 0) {
      warnings.push({
        code: 'UNUSED_MATERIAL',
        materialId: material.id,
        message: `材料「${material.title || `材料 ${material.orderIndex}`}」没有绑定任何题目`,
      })
    }
  }

  return {
    canConfirm: errors.length === 0,
    errors,
    warnings,
  }
}

const createImportJobWithDrafts = async ({
  req,
  title,
  gradeLevel,
  sourceType,
  rawText,
  draftMaterials = [],
  draftQuestions = [],
  warnings = [],
}) => {
  return prisma.$transaction(async (tx) => {
    const job = await tx.importJob.create({
      data: {
        createdById: req.user.id,
        title: title ? String(title).trim() : '未命名导入草稿',
        gradeLevel: normalizeEnum(gradeLevel, gradeLevels),
        status: draftQuestions.length > 0 ? 'PARSED' : 'DRAFT',
        sourceType: sourceType ? String(sourceType).trim() : 'manual',
        rawText: rawText ? String(rawText) : '',
      },
    })

    const materialIdMap = new Map()

    for (const [index, material] of draftMaterials.entries()) {
      const createdMaterial = await tx.importDraftMaterial.create({
        data: {
          importJobId: job.id,
          type: normalizeEnum(material.type, materialTypes, 'READING'),
          title: material.title ? String(material.title).trim() : '',
          content: String(material.content || ''),
          audioUrl: material.audioUrl ? String(material.audioUrl).trim() : '',
          transcript: material.transcript ? String(material.transcript) : '',
          orderIndex: Number(material.orderIndex || index + 1),
        },
      })

      if (material.key) {
        materialIdMap.set(material.key, createdMaterial.id)
      }
    }

    for (const [index, question] of draftQuestions.entries()) {
      await tx.importDraftQuestion.create({
        data: {
          importJobId: job.id,
          materialId:
            question.materialId ||
            (question.materialKey ? materialIdMap.get(question.materialKey) : null) ||
            null,
          type: normalizeEnum(question.type, questionTypes, 'CHOICE'),
          text: String(question.text || `第 ${index + 1} 题`),
          options: Array.isArray(question.options) ? question.options : null,
          answer:
            question.answer === undefined || question.answer === ''
              ? null
              : parseJsonValue(question.answer),
          score:
            question.score === undefined || question.score === ''
              ? null
              : Number(question.score),
          knowledgePoint: question.knowledgePoint || '未分类',
          referenceAnswer: question.referenceAnswer || '',
          explanation: question.explanation || '',
          orderIndex: Number(question.orderIndex || index + 1),
        },
      })
    }

    for (const warning of warnings) {
      await tx.importWarning.create({
        data: {
          importJobId: job.id,
          level: warning.level ? String(warning.level) : 'warning',
          field: warning.field ? String(warning.field) : '',
          message: String(warning.message || '导入草稿存在待确认项'),
        },
      })
    }

    return tx.importJob.findUnique({
      where: {
        id: job.id,
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
  })
}

router.post('/import/jobs', requireTeacherOrAdmin, upload.single('file'), async (req, res) => {
  try {
    const uploadedText = await readUploadedText(req.file)
    const rawText = uploadedText || req.body.rawText || ''
    const parsedDraft = req.file || rawText ? parseImportText(rawText) : null
    const requestDraftQuestions = parseJsonArray(req.body.draftQuestions)
    const requestDraftMaterials = parseJsonArray(req.body.draftMaterials)
    const requestWarnings = parseJsonArray(req.body.warnings)

    const createdJob = await createImportJobWithDrafts({
      req,
      title: req.body.title,
      gradeLevel: req.body.gradeLevel,
      sourceType: req.file ? 'file' : req.body.sourceType,
      rawText,
      draftMaterials:
        requestDraftMaterials.length > 0
          ? requestDraftMaterials
          : parsedDraft?.draftMaterials || [],
      draftQuestions:
        requestDraftQuestions.length > 0
          ? requestDraftQuestions
          : parsedDraft?.draftQuestions || [],
      warnings: [...(parsedDraft?.warnings || []), ...requestWarnings],
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

    const job = await getImportJobForUser(req, id, {
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
        include: {
          _count: {
            select: {
              questions: true,
            },
          },
        },
      },
      draftQuestions: {
        orderBy: {
          orderIndex: 'asc',
        },
        include: {
          material: true,
        },
      },
      warnings: {
        orderBy: {
          createdAt: 'asc',
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

router.post('/import/jobs/:id/draft-questions', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    if (req.body.materialId) {
      const material = await prisma.importDraftMaterial.findFirst({
        where: {
          id: req.body.materialId,
          importJobId: id,
        },
      })

      if (!material) {
        return res.status(400).json({
          message: '绑定的草稿材料不存在或不属于当前导入任务',
        })
      }
    }

    const questionCount = await prisma.importDraftQuestion.count({
      where: {
        importJobId: id,
      },
    })

    const type = normalizeEnum(req.body.type, questionTypes, 'CHOICE')
    const createdQuestion = await prisma.importDraftQuestion.create({
      data: {
        importJobId: id,
        materialId: req.body.materialId || null,
        type,
        text: String(req.body.text || `第 ${questionCount + 1} 题`),
        options: Array.isArray(req.body.options) ? req.body.options : parseJsonValue(req.body.options, null),
        answer:
          req.body.answer === undefined || req.body.answer === ''
            ? null
            : parseJsonValue(req.body.answer),
        score:
          req.body.score === undefined || req.body.score === ''
            ? null
            : Number(req.body.score),
        knowledgePoint: req.body.knowledgePoint || '未分类',
        referenceAnswer: req.body.referenceAnswer || '',
        explanation: req.body.explanation || '',
        orderIndex: Number(req.body.orderIndex || questionCount + 1),
      },
      include: {
        material: true,
      },
    })

    res.status(201).json({
      message: '草稿题目创建成功',
      data: createdQuestion,
    })
  } catch (error) {
    console.error('Create draft question error:', error)

    res.status(500).json({
      message: '草稿题目创建失败',
      error: error.message,
    })
  }
})

router.patch('/import/jobs/:id/draft-questions/:questionId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id, questionId } = req.params
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const existingQuestion = await prisma.importDraftQuestion.findFirst({
      where: {
        id: questionId,
        importJobId: id,
      },
    })

    if (!existingQuestion) {
      return res.status(404).json({
        message: '草稿题目不存在',
      })
    }

    if (req.body.materialId) {
      const material = await prisma.importDraftMaterial.findFirst({
        where: {
          id: req.body.materialId,
          importJobId: id,
        },
      })

      if (!material) {
        return res.status(400).json({
          message: '绑定的草稿材料不存在或不属于当前导入任务',
        })
      }
    }

    const updatedQuestion = await prisma.importDraftQuestion.update({
      where: {
        id: questionId,
      },
      data: {
        materialId:
          req.body.materialId === undefined
            ? existingQuestion.materialId
            : req.body.materialId || null,
        type: req.body.type
          ? normalizeEnum(req.body.type, questionTypes, existingQuestion.type)
          : existingQuestion.type,
        text: req.body.text === undefined ? existingQuestion.text : String(req.body.text),
        options:
          req.body.options === undefined
            ? existingQuestion.options
            : parseJsonValue(req.body.options, null),
        answer:
          req.body.answer === undefined
            ? existingQuestion.answer
            : parseJsonValue(req.body.answer, null),
        score:
          req.body.score === undefined || req.body.score === ''
            ? existingQuestion.score
            : Number(req.body.score),
        knowledgePoint:
          req.body.knowledgePoint === undefined
            ? existingQuestion.knowledgePoint
            : String(req.body.knowledgePoint || '未分类'),
        referenceAnswer:
          req.body.referenceAnswer === undefined
            ? existingQuestion.referenceAnswer
            : String(req.body.referenceAnswer || ''),
        explanation:
          req.body.explanation === undefined
            ? existingQuestion.explanation
            : String(req.body.explanation || ''),
        orderIndex:
          req.body.orderIndex === undefined
            ? existingQuestion.orderIndex
            : Number(req.body.orderIndex),
      },
    })

    res.json({
      message: '草稿题目更新成功',
      data: updatedQuestion,
    })
  } catch (error) {
    console.error('Update draft question error:', error)

    res.status(500).json({
      message: '草稿题目更新失败',
      error: error.message,
    })
  }
})

router.delete('/import/jobs/:id/draft-questions/:questionId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id, questionId } = req.params
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const existingQuestion = await prisma.importDraftQuestion.findFirst({
      where: {
        id: questionId,
        importJobId: id,
      },
    })

    if (!existingQuestion) {
      return res.status(404).json({
        message: '草稿题目不存在',
      })
    }

    await prisma.importDraftQuestion.delete({
      where: {
        id: questionId,
      },
    })

    res.json({
      message: '草稿题目删除成功',
      data: existingQuestion,
    })
  } catch (error) {
    console.error('Delete draft question error:', error)

    res.status(500).json({
      message: '草稿题目删除失败',
      error: error.message,
    })
  }
})

router.post('/import/jobs/:id/draft-materials', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const materialCount = await prisma.importDraftMaterial.count({
      where: {
        importJobId: id,
      },
    })

    const createdMaterial = await prisma.importDraftMaterial.create({
      data: {
        importJobId: id,
        type: normalizeEnum(req.body.type, materialTypes, 'READING'),
        title: req.body.title ? String(req.body.title).trim() : `材料 ${materialCount + 1}`,
        content: String(req.body.content || ''),
        audioUrl: req.body.audioUrl ? String(req.body.audioUrl).trim() : '',
        transcript: req.body.transcript ? String(req.body.transcript) : '',
        orderIndex: Number(req.body.orderIndex || materialCount + 1),
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    })

    res.status(201).json({
      message: '草稿材料创建成功',
      data: createdMaterial,
    })
  } catch (error) {
    console.error('Create draft material error:', error)

    res.status(500).json({
      message: '草稿材料创建失败',
      error: error.message,
    })
  }
})

router.patch('/import/jobs/:id/draft-materials/:materialId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id, materialId } = req.params
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const existingMaterial = await prisma.importDraftMaterial.findFirst({
      where: {
        id: materialId,
        importJobId: id,
      },
    })

    if (!existingMaterial) {
      return res.status(404).json({
        message: '草稿材料不存在',
      })
    }

    const updatedMaterial = await prisma.importDraftMaterial.update({
      where: {
        id: materialId,
      },
      data: {
        type: req.body.type
          ? normalizeEnum(req.body.type, materialTypes, existingMaterial.type)
          : existingMaterial.type,
        title: req.body.title === undefined ? existingMaterial.title : String(req.body.title || ''),
        content:
          req.body.content === undefined
            ? existingMaterial.content
            : String(req.body.content || ''),
        audioUrl:
          req.body.audioUrl === undefined
            ? existingMaterial.audioUrl
            : String(req.body.audioUrl || ''),
        transcript:
          req.body.transcript === undefined
            ? existingMaterial.transcript
            : String(req.body.transcript || ''),
        orderIndex:
          req.body.orderIndex === undefined
            ? existingMaterial.orderIndex
            : Number(req.body.orderIndex),
      },
    })

    res.json({
      message: '草稿材料更新成功',
      data: updatedMaterial,
    })
  } catch (error) {
    console.error('Update draft material error:', error)

    res.status(500).json({
      message: '草稿材料更新失败',
      error: error.message,
    })
  }
})

router.delete('/import/jobs/:id/draft-materials/:materialId', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id, materialId } = req.params
    const force = req.query.force === 'true'
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const existingMaterial = await prisma.importDraftMaterial.findFirst({
      where: {
        id: materialId,
        importJobId: id,
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    })

    if (!existingMaterial) {
      return res.status(404).json({
        message: '草稿材料不存在',
      })
    }

    if (existingMaterial._count.questions > 0 && !force) {
      return res.status(400).json({
        message: `该材料已有 ${existingMaterial._count.questions} 道题绑定，请先调整题目绑定后再删除`,
        data: {
          boundQuestionCount: existingMaterial._count.questions,
        },
      })
    }

    await prisma.importDraftMaterial.delete({
      where: {
        id: materialId,
      },
    })

    res.json({
      message: '草稿材料删除成功',
      data: existingMaterial,
    })
  } catch (error) {
    console.error('Delete draft material error:', error)

    res.status(500).json({
      message: '草稿材料删除失败',
      error: error.message,
    })
  }
})

router.patch('/import/jobs/:id/warnings/:warningId/resolve', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id, warningId } = req.params
    const job = await getImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const existingWarning = await prisma.importWarning.findFirst({
      where: {
        id: warningId,
        importJobId: id,
      },
    })

    if (!existingWarning) {
      return res.status(404).json({
        message: 'Warning 不存在',
      })
    }

    const warning = await prisma.importWarning.update({
      where: {
        id: warningId,
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    })

    res.json({
      message: 'Warning 已标记为处理',
      data: warning,
    })
  } catch (error) {
    console.error('Resolve warning error:', error)

    res.status(500).json({
      message: 'Warning 处理失败',
      error: error.message,
    })
  }
})

router.post('/import/jobs/:id/validate', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const job = await getFullImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const validation = buildImportValidation(job)

    res.json({
      message: validation.canConfirm ? '导入草稿可以确认入库' : '导入草稿存在阻塞问题',
      data: validation,
    })
  } catch (error) {
    console.error('Validate import job error:', error)

    res.status(500).json({
      message: '导入草稿质量检查失败',
      error: error.message,
    })
  }
})

router.post('/import/jobs/:id/confirm', requireTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const job = await getFullImportJobForUser(req, id)

    if (!job) {
      return res.status(404).json({
        message: '导入草稿不存在或无权访问',
      })
    }

    const validation = buildImportValidation(job)

    if (!validation.canConfirm) {
      return res.status(400).json({
        message: '导入草稿存在阻塞问题，请修复后再确认入库',
        data: validation,
      })
    }

    const result = await prisma.$transaction(async (tx) => {
      const materialIdMap = new Map()
      const warningData = []

      for (const question of job.draftQuestions) {
        const type = normalizeEnum(question.type, questionTypes, 'CHOICE')

        if (type === 'CHOICE' && (question.answer === null || question.answer === undefined || question.answer === '')) {
          warningData.push({
            importJobId: job.id,
            draftQuestionId: question.id,
            level: 'warning',
            field: `question.${question.orderIndex}.answer`,
            message: `第 ${question.orderIndex} 题缺少客观题答案，已按空答案入库，请后续补充`,
          })
        }

        if (!question.materialId && job.draftMaterials.length > 0) {
          warningData.push({
            importJobId: job.id,
            draftQuestionId: question.id,
            level: 'info',
            field: `question.${question.orderIndex}.materialId`,
            message: `第 ${question.orderIndex} 题未绑定材料，已允许入库`,
          })
        }
      }

      if (warningData.length > 0) {
        await tx.importWarning.createMany({
          data: warningData,
        })
      }

      const normalizedQuestions = job.draftQuestions.map((question) => {
        const type = normalizeEnum(question.type, questionTypes, 'CHOICE')
        const score =
          question.score === null || question.score === undefined || Number.isNaN(Number(question.score))
            ? getDefaultScore(type)
            : Number(question.score)

        return {
          ...question,
          type,
          score,
        }
      })

      const totalScore = normalizedQuestions.reduce((sum, question) => {
        return sum + Number(question.score || 0)
      }, 0)
      const finalIsPublished =
        req.user.role === 'ADMIN' && req.body.isPublished === true
      const finalPublishStatus = finalIsPublished
        ? 'PUBLISHED'
        : req.user.role === 'ADMIN'
          ? 'READY'
          : 'DRAFT'

      const exam = await tx.exam.create({
        data: {
          createdById: req.user.id,
          importJobId: job.id,
          title: req.body.title ? String(req.body.title).trim() : job.title,
          gradeLevel: normalizeEnum(req.body.gradeLevel || job.gradeLevel, gradeLevels, 'GENERAL'),
          description:
            req.body.description ||
            `由导入草稿 ${job.title} 确认入库生成。`,
          timeLimit: Number(req.body.timeLimit || 3600),
          totalScore,
          isPublished: finalIsPublished,
          sourceType:
            req.user.role === 'ADMIN'
              ? 'PLATFORM_STANDARD'
              : 'TEACHER_CUSTOM',
          visibility:
            req.user.role === 'ADMIN'
              ? 'PUBLIC'
              : 'PRIVATE',
          publishStatus: finalPublishStatus,
          diagnosisQuality: 'BASIC',
        },
      })

      for (const draftMaterial of job.draftMaterials) {
        const material = await tx.questionMaterial.create({
          data: {
            examId: exam.id,
            type: draftMaterial.type,
            title: draftMaterial.title || '',
            content: draftMaterial.content,
            audioUrl: draftMaterial.audioUrl || '',
            transcript: draftMaterial.transcript || '',
            orderIndex: draftMaterial.orderIndex,
          },
        })

        materialIdMap.set(draftMaterial.id, material.id)
      }

      const createdQuestions = []

      for (const question of normalizedQuestions) {
        const createdQuestion = await tx.question.create({
          data: {
            examId: exam.id,
            materialId: question.materialId ? materialIdMap.get(question.materialId) || null : null,
            type: question.type,
            text: question.text || `第 ${question.orderIndex} 题`,
            options: Array.isArray(question.options) ? question.options : null,
            answer:
              question.type === 'CHOICE'
                ? normalizeChoiceAnswer(question.answer)
                : question.answer,
            score: question.score,
            knowledgePoint: question.knowledgePoint || '未分类',
            referenceAnswer: question.referenceAnswer || '',
            explanation: question.explanation || '',
            orderIndex: question.orderIndex,
          },
        })

        createdQuestions.push(createdQuestion)
      }

      await tx.importJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: 'IMPORTED',
        },
      })

      return {
        exam,
        questionCount: createdQuestions.length,
        materialCount: materialIdMap.size,
        warningCount: warningData.length,
        validation,
      }
    })

    res.status(201).json({
      message: '导入草稿已确认入库',
      data: {
        examId: result.exam.id,
        exam: result.exam,
        questionCount: result.questionCount,
        materialCount: result.materialCount,
        warningCount: result.warningCount,
        validation: result.validation,
      },
    })
  } catch (error) {
    console.error('Confirm import job error:', error)

    res.status(500).json({
      message: '导入草稿确认入库失败',
      error: error.message,
    })
  }
})

router.__private = {
  parseImportText,
  parseStrictChineseQuestionFormat,
}

module.exports = router
