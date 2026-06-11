const express = require('express')
const multer = require('multer')
const mammoth = require('mammoth')
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middlewares/authMiddleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

const normalizeQuestionType = (type) => {
  const text = String(type || '').trim().toUpperCase()

  const typeMap = {
    CHOICE: 'CHOICE',
    SINGLE_CHOICE: 'CHOICE',
    单选题: 'CHOICE',
    选择题: 'CHOICE',

    TRANSLATION: 'TRANSLATION',
    翻译题: 'TRANSLATION',

    ERROR_CORRECTION: 'ERROR_CORRECTION',
    改错题: 'ERROR_CORRECTION',

    WRITING: 'WRITING',
    写作题: 'WRITING',

    READING: 'READING',
    阅读理解: 'READING',

    CLOZE: 'CLOZE',
    完形填空: 'CLOZE',
  }

  return typeMap[text] || text || 'CHOICE'
}

const getDefaultScore = (type) => {
  if (type === 'CHOICE') {
    return 2
  }

  if (type === 'TRANSLATION' || type === 'ERROR_CORRECTION') {
    return 5
  }

  if (type === 'WRITING') {
    return 10
  }

  return 2
}

const answerLetterToIndex = (answer) => {
  const text = String(answer || '').trim().toUpperCase()

  const map = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
  }

  if (map[text] !== undefined) {
    return map[text]
  }

  const numberValue = Number(text)

  if (!Number.isNaN(numberValue)) {
    return numberValue
  }

  return answer
}

const getFieldValue = (blockText, labelList) => {
  for (const label of labelList) {
    const regex = new RegExp(`${label}[：:]\\s*(.+)`)
    const match = blockText.match(regex)

    if (match) {
      return match[1].trim()
    }
  }

  return ''
}

const cleanQuestionText = (blockText) => {
  return blockText
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()

      if (/^[A-D][\.．、]\s*/i.test(trimmed)) {
        return false
      }

      if (/^(答案|参考答案|解析|知识点|分值)[：:]/.test(trimmed)) {
        return false
      }

      return true
    })
    .join('\n')
    .replace(/^\d+[\.．、]\s*/, '')
    .trim()
}

const parseOptions = (blockText) => {
  const options = []

  const lines = blockText.split('\n')

  for (const line of lines) {
    const match = line.trim().match(/^([A-D])[\.．、]\s*(.+)$/i)

    if (match) {
      options.push(match[2].trim())
    }
  }

  return options
}

const parseQuestionBlock = (block, type, orderIndex) => {
  const finalType = normalizeQuestionType(type)
  const blockText = block.trim()

  const rawAnswer = getFieldValue(blockText, ['答案', '参考答案'])
  const explanation = getFieldValue(blockText, ['解析'])
  const knowledgePoint = getFieldValue(blockText, ['知识点']) || '未分类'
  const scoreText = getFieldValue(blockText, ['分值'])
  const score = scoreText ? Number(scoreText) : getDefaultScore(finalType)

  const options = finalType === 'CHOICE' ? parseOptions(blockText) : null

  const questionText = cleanQuestionText(blockText)

  return {
    type: finalType,
    text: questionText,
    options: options && options.length > 0 ? options : null,
    answer: finalType === 'CHOICE' ? answerLetterToIndex(rawAnswer) : rawAnswer || null,
    score: Number.isNaN(score) ? getDefaultScore(finalType) : score,
    knowledgePoint,
    referenceAnswer: rawAnswer || '',
    explanation,
    orderIndex,
  }
}

const parseExamText = (rawText) => {
  const text = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const lines = text.split('\n')

  const questions = []
  let currentType = 'CHOICE'
  let currentBlock = []

  const pushCurrentBlock = () => {
    if (currentBlock.length === 0) {
      return
    }

    const blockText = currentBlock.join('\n').trim()

    if (!blockText) {
      currentBlock = []
      return
    }

    const question = parseQuestionBlock(blockText, currentType, questions.length + 1)

    if (question.text) {
      questions.push(question)
    }

    currentBlock = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    const typeMatch = trimmed.match(/^【(.+?)】$/)

    if (typeMatch) {
      pushCurrentBlock()
      currentType = normalizeQuestionType(typeMatch[1])
      continue
    }

    if (/^\d+[\.．、]\s*/.test(trimmed)) {
      pushCurrentBlock()
      currentBlock.push(trimmed)
      continue
    }

    currentBlock.push(trimmed)
  }

  pushCurrentBlock()

  return questions
}

const extractTextFromFile = async (file) => {
  const originalName = file.originalname || ''
  const lowerName = originalName.toLowerCase()

  if (lowerName.endsWith('.txt') || file.mimetype === 'text/plain') {
    return file.buffer.toString('utf8')
  }

  if (
    lowerName.endsWith('.docx') ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    })

    return result.value
  }

  throw new Error('暂时只支持 .txt 和 .docx 文件')
}

router.post(
  '/admin/import/parse-file',
  requireAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: '请上传试卷文件',
        })
      }

      const rawText = await extractTextFromFile(req.file)
      const questions = parseExamText(rawText)

      res.json({
        message: '文件解析成功',
        data: {
          fileName: req.file.originalname,
          rawText,
          questions,
          questionCount: questions.length,
        },
      })
    } catch (error) {
      console.error(error)

      res.status(500).json({
        message: '文件解析失败',
        error: error.message,
      })
    }
  }
)

router.post(
  '/admin/exams/:examId/import-questions',
  requireAdmin,
  async (req, res) => {
    try {
      const { examId } = req.params
      const { questions } = req.body

      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          message: '请提供需要导入的题目',
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

      const currentQuestionCount = await prisma.question.count({
        where: {
          examId,
        },
      })

      const createdQuestions = await prisma.$transaction(
        questions.map((question, index) => {
          const finalType = normalizeQuestionType(question.type)

          return prisma.question.create({
            data: {
              examId,
              type: finalType,
              text: String(question.text || '').trim(),
              options:
                finalType === 'CHOICE' && Array.isArray(question.options)
                  ? question.options
                  : null,
              answer:
                question.answer === undefined || question.answer === ''
                  ? null
                  : question.answer,
              score: Number(question.score || getDefaultScore(finalType)),
              knowledgePoint: question.knowledgePoint || '未分类',
              referenceAnswer: question.referenceAnswer || '',
              explanation: question.explanation || '',
              orderIndex: currentQuestionCount + index + 1,
            },
          })
        })
      )

      res.status(201).json({
        message: '题目批量导入成功',
        data: createdQuestions,
      })
    } catch (error) {
      console.error(error)

      res.status(500).json({
        message: '题目批量导入失败',
        error: error.message,
      })
    }
  }
)

module.exports = router