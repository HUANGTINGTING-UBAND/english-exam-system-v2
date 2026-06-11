const express = require('express')
const fs = require('fs/promises')
const multer = require('multer')
const mammoth = require('mammoth')
const pdfParseModule = require('pdf-parse')
const pdfParse = pdfParseModule.default || pdfParseModule
const prisma = require('../lib/prisma')
const { requireAdmin } = require('../middlewares/authMiddleware')

const router = express.Router()
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 150 * 1024 * 1024,
  },
})


const examImportPresets = {
  CET4: {
    name: '大学英语四级',
    timeLimit: 7500,
    totalScore: 710,
    getScore(question) {
      const orderIndex = Number(question.orderIndex || 0)

      if (orderIndex === 1) return 106.5
      if (orderIndex >= 2 && orderIndex <= 8) return 7.1
      if (orderIndex >= 9 && orderIndex <= 16) return 7.1
      if (orderIndex >= 17 && orderIndex <= 26) return 14.2
      if (orderIndex >= 27 && orderIndex <= 36) return 3.55
      if (orderIndex >= 37 && orderIndex <= 46) return 7.1
      if (orderIndex >= 47 && orderIndex <= 56) return 14.2
      if (orderIndex === 57) return 106.5

      return 0
    },
  },
}

const getExamImportPreset = (gradeLevel, examTitle = '', questionCount = 0) => {
  const key = String(gradeLevel || '').trim().toUpperCase()
  const title = String(examTitle || '').trim().toUpperCase()

  if (examImportPresets[key]) {
    return examImportPresets[key]
  }

  if (
    title.includes('CET4') ||
    title.includes('四级') ||
    title.includes('大学英语四级')
  ) {
    return examImportPresets.CET4
  }

  if (Number(questionCount) === 57) {
    return examImportPresets.CET4
  }

  return null
}

const applyExamImportPreset = (questions, preset) => {
  if (!Array.isArray(questions)) {
    return []
  }

  return questions.map((question, index) => {
    const orderIndex = Number(question.orderIndex || index + 1)

    const normalizedQuestion = {
      ...question,
      orderIndex,
    }

    const presetScore = preset?.getScore
      ? Number(preset.getScore(normalizedQuestion) || 0)
      : 0

    return {
      ...normalizedQuestion,
      score: presetScore > 0 ? presetScore : Number(question.score || 0),
    }
  })
}

const calculateQuestionTotalScore = (questions) => {
  const total = questions.reduce((sum, question) => {
    return sum + Number(question.score || 0)
  }, 0)

  return Number(total.toFixed(2))
}

const normalizeQuestionType = (type) => {
  const typeText = String(type || '').trim().toUpperCase()
  const rawText = String(type || '').trim()

  const typeMap = {
    CHOICE: 'CHOICE',
    SINGLE_CHOICE: 'CHOICE',
    单选题: 'CHOICE',
    选择题: 'CHOICE',
    听力选择题: 'CHOICE',
    阅读选择题: 'CHOICE',
    仔细阅读: 'CHOICE',
    长篇阅读: 'CHOICE',
    段落匹配: 'CHOICE',
    选词填空: 'CHOICE',
    完形填空选择题: 'CHOICE',
    READING: 'CHOICE',
    阅读理解: 'CHOICE',
    CLOZE: 'CHOICE',
    完形填空: 'CHOICE',

    TRANSLATION: 'TRANSLATION',
    翻译题: 'TRANSLATION',

    ERROR_CORRECTION: 'ERROR_CORRECTION',
    改错题: 'ERROR_CORRECTION',

    WRITING: 'WRITING',
    写作题: 'WRITING',
  }

  return typeMap[typeText] || typeMap[rawText] || 'CHOICE'
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
    E: 4,
    F: 5,
    G: 6,
    H: 7,
    I: 8,
    J: 9,
    K: 10,
    L: 11,
    M: 12,
    N: 13,
    O: 14,
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

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options
      .map((option) => String(option || '').trim())
      .filter(Boolean)
      .map((option) => option.replace(/^[A-O][\.．、\)]\s*/i, '').trim())
      .filter(Boolean)
  }

  if (typeof options === 'string') {
    return options
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[A-O][\.．、\)]\s*/i, '').trim())
      .filter(Boolean)
  }

  return []
}

const normalizeParsedQuestions = (questions) => {
  if (!Array.isArray(questions)) {
    return []
  }

  const normalized = questions
    .map((question, index) => {
      const finalType = normalizeQuestionType(question.type)
      const options = normalizeOptions(question.options)
      const hasOptions = options.length > 0

      return {
        type: hasOptions ? 'CHOICE' : finalType,
        text: String(question.text || '').trim(),
        options: hasOptions ? options : null,
        answer: hasOptions
          ? normalizeChoiceAnswer(question.answer)
          : question.answer === undefined || question.answer === null
            ? null
            : String(question.answer).trim(),
        score: Number(question.score || 0),
        knowledgePoint: String(question.knowledgePoint || '未分类').trim(),
        referenceAnswer: String(question.referenceAnswer || '').trim(),
        explanation: String(question.explanation || '').trim(),
        orderIndex: Number(question.orderIndex || index + 1),
      }
    })
    .filter((question) => {
      if (!question.text) return false

      const text = question.text.trim().toUpperCase()

      const invalidStarts = [
        '说明',
        '题型标题',
        'PART I',
        'PART II',
        'PART III',
        'PART IV',
        'SECTION A',
        'SECTION B',
        'SECTION C',
        'DIRECTIONS',
        'READING COMPREHENSION',
        'LISTENING COMPREHENSION',
      ]

      return !invalidStarts.some((item) => text.startsWith(item))
    })

  const seen = new Set()

  return normalized.filter((question) => {
    if (seen.has(question.orderIndex)) {
      return false
    }

    seen.add(question.orderIndex)
    return true
  })
}

const getFieldValue = (block, fieldNames) => {
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames]
  const escapedNames = names.map((name) => {
    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })

  const labelPattern = escapedNames.join('|')
  const nextLabelPattern =
    '题号|题型|题干|选项|答案|参考答案|解析|知识点|分值'

  const regex = new RegExp(
    `(?:${labelPattern})\\s*[:：]\\s*([\\s\\S]*?)(?=\\n(?:${nextLabelPattern})\\s*[:：]|$)`,
    'i'
  )

  const match = block.match(regex)

  return match ? match[1].trim() : ''
}

const parseOptionsFromText = (optionsText) => {
  const lines = String(optionsText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const options = []
  let currentOption = ''

  for (const line of lines) {
    const optionMatch = line.match(/^([A-O])[\.\、．\)]\s*(.*)$/i)

    if (optionMatch) {
      if (currentOption) {
        options.push(currentOption.trim())
      }

      currentOption = optionMatch[2].trim()
    } else if (currentOption) {
      currentOption += ` ${line}`
    }
  }

  if (currentOption) {
    options.push(currentOption.trim())
  }

  return options.filter(Boolean)
}

const parseQuestionsFromText = (rawText) => {
  const text = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim()

  if (!text) {
    return []
  }

  const blocks = text
    .split(/(?=\n?题号\s*[:：]\s*\d+)/g)
    .map((block) => block.trim())
    .filter((block) => /^题号\s*[:：]\s*\d+/m.test(block))

  const questions = blocks.map((block, index) => {
    const orderIndexText = getFieldValue(block, '题号')
    const type = getFieldValue(block, '题型') || '单选题'
    const text = getFieldValue(block, '题干')
    const optionsText = getFieldValue(block, '选项')
    const answer = getFieldValue(block, ['答案', '参考答案'])
    const referenceAnswer = getFieldValue(block, '参考答案')
    const explanation = getFieldValue(block, '解析')
    const knowledgePoint = getFieldValue(block, '知识点')
    const scoreText = getFieldValue(block, '分值')

    const options = parseOptionsFromText(optionsText)

    return {
      type,
      text,
      options,
      answer,
      score: Number(scoreText || 0),
      knowledgePoint: knowledgePoint || '未分类',
      referenceAnswer,
      explanation,
      orderIndex: Number(orderIndexText || index + 1),
    }
  })

  return normalizeParsedQuestions(questions)
}

const readUploadedTextFile = async (file) => {
  if (!file) {
    return ''
  }

  const originalName = file.originalname || ''
  const lowerName = originalName.toLowerCase()

  if (lowerName.endsWith('.txt')) {
    return fs.readFile(file.path, 'utf-8')
  }

  if (lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({
      path: file.path,
    })

    return result.value || ''
  }

  if (lowerName.endsWith('.pdf')) {
    const buffer = await fs.readFile(file.path)
    const result = await pdfParse(buffer)

    return result.text || ''
  }

  return ''
}

const removeUploadedFiles = async (files = []) => {
  await Promise.all(
    files
      .filter(Boolean)
      .map((file) => fs.unlink(file.path).catch(() => {}))
  )
}

const detectExamTypeFromImport = ({ fileName = '', paperText = '', questionCount = 0 }) => {
  const text = `${fileName} ${paperText}`.toUpperCase()

  if (
    text.includes('CET4') ||
    text.includes('四级') ||
    text.includes('大学英语四级') ||
    Number(questionCount) === 57
  ) {
    return 'CET4'
  }

  return ''
}

router.get('/admin/exams', requireAdmin, async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
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
    const realTotalScore = calculateQuestionTotalScore(exam.questions)

    return {
      id: exam.id,
      title: exam.title,
      gradeLevel: exam.gradeLevel,
      description: exam.description,
      timeLimit: exam.timeLimit,
      totalScore: realTotalScore,
      isPublished: exam.isPublished,
      questionCount: exam.questions.length,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
    }
  })

    res.json({
      message: 'Admin exams loaded successfully',
      data: formattedExams,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '管理员试卷列表获取失败',
      error: error.message,
    })
  }
})

router.post('/admin/exams', requireAdmin, async (req, res) => {
  try {
    const {
      title,
      gradeLevel,
      description,
      timeLimit,
      totalScore,
      isPublished,
    } = req.body

    if (!title || !gradeLevel) {
      return res.status(400).json({
        message: '试卷标题和试卷分类不能为空',
      })
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        gradeLevel: String(gradeLevel).toUpperCase(),
        description: description || '',
        timeLimit: Number(timeLimit || 3600),
        totalScore: 0,
        isPublished: Boolean(isPublished),
      },
    })

    res.status(201).json({
      message: '试卷创建成功',
      data: exam,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '试卷创建失败',
      error: error.message,
    })
  }
})

router.put('/admin/exams/:examId', requireAdmin, async (req, res) => {
  try {
    const { examId } = req.params

    const {
      title,
      gradeLevel,
      description,
      timeLimit,
      totalScore,
      isPublished,
    } = req.body

    const existingExam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
    })

    if (!existingExam) {
      return res.status(404).json({
        message: '试卷不存在',
      })
    }

    const updatedExam = await prisma.exam.update({
      where: {
        id: examId,
      },
      data: {
        title: title ?? existingExam.title,
        gradeLevel: gradeLevel
          ? String(gradeLevel).toUpperCase()
          : existingExam.gradeLevel,
        description: description ?? existingExam.description,
        timeLimit:
          timeLimit === undefined ? existingExam.timeLimit : Number(timeLimit),
        totalScore: existingExam.totalScore,
        isPublished:
          isPublished === undefined ? existingExam.isPublished : Boolean(isPublished),
      },
    })

    res.json({
      message: '试卷更新成功',
      data: updatedExam,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '试卷更新失败',
      error: error.message,
    })
  }
})

router.delete('/admin/exams/:examId', requireAdmin, async (req, res) => {
  try {
    const { examId } = req.params

    console.log('Deleting exam:', examId)

    const existingExam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
    })

    if (!existingExam) {
      return res.status(404).json({
        message: '试卷不存在',
        examId,
      })
    }

    const questionsBeforeDelete = await prisma.question.count({
      where: {
        examId,
      },
    })

    const attempts = await prisma.examAttempt.findMany({
      where: {
        examId,
      },
      select: {
        id: true,
      },
    })

    const attemptIds = attempts.map((attempt) => attempt.id)

    const wrongQuestionsBeforeDelete = await prisma.wrongQuestion.count({
      where: {
        examId,
      },
    })

    const userAnswersBeforeDelete = attemptIds.length
      ? await prisma.userAnswer.count({
          where: {
            attemptId: {
              in: attemptIds,
            },
          },
        })
      : 0

    await prisma.$transaction(async (tx) => {
      await tx.wrongQuestion.deleteMany({
        where: {
          examId,
        },
      })

      if (attemptIds.length > 0) {
        await tx.userAnswer.deleteMany({
          where: {
            attemptId: {
              in: attemptIds,
            },
          },
        })
      }

      await tx.examAttempt.deleteMany({
        where: {
          examId,
        },
      })

      await tx.question.deleteMany({
        where: {
          examId,
        },
      })

      await tx.exam.delete({
        where: {
          id: examId,
        },
      })
    })

    const examAfterDelete = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
    })

    if (examAfterDelete) {
      return res.status(500).json({
        message: '试卷删除失败：删除后数据库中仍然存在该试卷',
        examId,
      })
    }

    res.json({
      message: '试卷删除成功',
      data: {
        id: existingExam.id,
        title: existingExam.title,
        deletedQuestions: questionsBeforeDelete,
        deletedAttempts: attempts.length,
        deletedUserAnswers: userAnswersBeforeDelete,
        deletedWrongQuestions: wrongQuestionsBeforeDelete,
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '试卷删除失败',
      error: error.message,
    })
  }
})

router.patch('/admin/exams/:examId/publish', requireAdmin, async (req, res) => {
  try {
    const { examId } = req.params
    const { isPublished } = req.body

    const existingExam = await prisma.exam.findUnique({
      where: {
        id: examId,
      },
    })

    if (!existingExam) {
      return res.status(404).json({
        message: '试卷不存在',
      })
    }

    const updatedExam = await prisma.exam.update({
      where: {
        id: examId,
      },
      data: {
        isPublished: Boolean(isPublished),
      },
    })

    res.json({
      message: updatedExam.isPublished ? '试卷已发布' : '试卷已下架',
      data: updatedExam,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '试卷发布状态更新失败',
      error: error.message,
    })
  }
})

router.get('/admin/exams/:examId/questions', requireAdmin, async (req, res) => {
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
      message: '管理员题目列表获取成功',
      data: questions,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '管理员题目列表获取失败',
      error: error.message,
    })
  }
})

router.post('/admin/exams/:examId/questions', requireAdmin, async (req, res) => {
  try {
    const { examId } = req.params

    const {
      type,
      text,
      options,
      answer,
      score,
      knowledgePoint,
      referenceAnswer,
      explanation,
      orderIndex,
    } = req.body

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

    if (!type || !text) {
      return res.status(400).json({
        message: '题型和题干不能为空',
      })
    }

    const questionCount = await prisma.question.count({
      where: {
        examId,
      },
    })

    const finalType = normalizeQuestionType(type)

    const createdQuestion = await prisma.question.create({
      data: {
        examId,
        type: finalType,
        text,
        options: Array.isArray(options) && options.length > 0 ? options : null,
        answer: answer === undefined || answer === '' ? null : answer,
        score: Number(score || 0),
        knowledgePoint: knowledgePoint || '未分类',
        referenceAnswer: referenceAnswer || '',
        explanation: explanation || '',
        orderIndex:
          orderIndex === undefined || orderIndex === ''
            ? questionCount + 1
            : Number(orderIndex),
      },
    })

    res.status(201).json({
      message: '题目创建成功',
      data: createdQuestion,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '题目创建失败',
      error: error.message,
    })
  }
})

router.put('/admin/questions/:questionId', requireAdmin, async (req, res) => {
  try {
    const { questionId } = req.params

    const existingQuestion = await prisma.question.findUnique({
      where: {
        id: questionId,
      },
    })

    if (!existingQuestion) {
      return res.status(404).json({
        message: '题目不存在',
      })
    }

    const {
      type,
      text,
      options,
      answer,
      score,
      knowledgePoint,
      referenceAnswer,
      explanation,
      orderIndex,
    } = req.body

    const updatedQuestion = await prisma.question.update({
      where: {
        id: questionId,
      },
      data: {
        type: type ? normalizeQuestionType(type) : existingQuestion.type,
        text: text ?? existingQuestion.text,
        options:
          options === undefined
            ? existingQuestion.options
            : Array.isArray(options) && options.length > 0
              ? options
              : null,
        answer: answer === undefined ? existingQuestion.answer : answer,
        score: score === undefined ? existingQuestion.score : Number(score),
        knowledgePoint: knowledgePoint ?? existingQuestion.knowledgePoint,
        referenceAnswer: referenceAnswer ?? existingQuestion.referenceAnswer,
        explanation: explanation ?? existingQuestion.explanation,
        orderIndex:
          orderIndex === undefined ? existingQuestion.orderIndex : Number(orderIndex),
      },
    })

    res.json({
      message: '题目更新成功',
      data: updatedQuestion,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '题目更新失败',
      error: error.message,
    })
  }
})

router.delete('/admin/questions/:questionId', requireAdmin, async (req, res) => {
  try {
    const { questionId } = req.params

    const existingQuestion = await prisma.question.findUnique({
      where: {
        id: questionId,
      },
    })

    if (!existingQuestion) {
      return res.status(404).json({
        message: '题目不存在',
      })
    }

    await prisma.question.delete({
      where: {
        id: questionId,
      },
    })

    res.json({
      message: '题目删除成功',
      data: existingQuestion,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '题目删除失败',
      error: error.message,
    })
  }
})

router.post('/admin/ai/parse-questions', requireAdmin, async (req, res) => {
  try {
    const { rawText, gradeLevel, examTitle } = req.body

    if (!rawText || !String(rawText).trim()) {
      return res.status(400).json({
        message: '请提供需要解析的试卷文本',
      })
    }

    const openaiApiKey = String(process.env.OPENAI_API_KEY || '').trim()

    if (
      !openaiApiKey ||
      openaiApiKey.includes('你的') ||
      openaiApiKey.includes('OpenAI API Key')
    ) {
      return res.status(500).json({
        message: '服务器尚未正确配置 OPENAI_API_KEY，请在 backend/.env 中填写真实 API Key',
      })
    }

    const prompt = `
你是一个英语考试系统的试卷解析助手。

请把下面的英语试卷文本解析为结构化 JSON。

要求：
1. 只返回 JSON，不要返回 Markdown，不要返回解释文字。
2. JSON 顶层格式必须是：
{
  "questions": []
}
3. 每道题必须包含：
{
  "type": "CHOICE | TRANSLATION | ERROR_CORRECTION | WRITING | READING | CLOZE",
  "text": "题干",
  "options": ["A选项", "B选项", "C选项", "D选项"] 或 null,
  "answer": 选择题使用 0-based 数字索引，例如 A=0, B=1；主观题可用字符串或 null,
  "score": 数字,
  "knowledgePoint": "知识点",
  "referenceAnswer": "参考答案",
  "explanation": "解析",
  "orderIndex": 数字
}
4. 如果没有解析到分值，默认选择题 2 分，翻译/改错 5 分，写作 10 分。
5. 如果没有解析到知识点，请根据题目内容合理判断。
6. 如果选择题答案是 A/B/C/D，请转换为 0/1/2/3。
7. 如果题目没有解析，请不要编造题目。
8. 适用试卷分类：${gradeLevel || '未指定'}
9. 试卷标题：${examTitle || '未指定'}

试卷文本如下：
${String(rawText).trim()}
`

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a strict JSON parser for English exam papers. Output only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_object',
        },
        temperature: 0.2,
      }),
    })

    const aiResult = await aiResponse.json()

    if (!aiResponse.ok) {
      console.error(aiResult)

      return res.status(500).json({
        message: 'AI 解析请求失败',
        error: aiResult.error?.message || 'OpenAI API error',
      })
    }

    const content = aiResult.choices?.[0]?.message?.content

    if (!content) {
      return res.status(500).json({
        message: 'AI 没有返回可解析内容',
      })
    }

    let parsed

    try {
      parsed = JSON.parse(content)
    } catch (error) {
      console.error('AI raw content:', content)

      return res.status(500).json({
        message: 'AI 返回内容不是合法 JSON',
        error: error.message,
      })
    }

    const questions = normalizeParsedQuestions(parsed.questions)

    res.json({
      message: 'AI 解析成功',
      data: {
        questions,
        raw: parsed,
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: 'AI 解析失败',
      error: error.message,
    })
  }
})

router.post('/admin/exams/:examId/import-questions', requireAdmin, async (req, res) => {
  try {
    const { examId } = req.params
    const { questions } = req.body

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

const normalizedQuestions = normalizeParsedQuestions(questions)

let preset = getExamImportPreset(
  exam.gradeLevel,
  exam.title,
  normalizedQuestions.length
)

// 兜底：只要是 57 题，默认按 CET4 规则处理
if (!preset && normalizedQuestions.length === 57) {
  preset = examImportPresets.CET4
}

const finalQuestions = applyExamImportPreset(normalizedQuestions, preset)

    console.log('===== CET IMPORT DEBUG =====')
    console.log('examId:', examId)
    console.log('exam.title:', exam.title)
    console.log('exam.gradeLevel:', exam.gradeLevel)
    console.log('questionCount:', normalizedQuestions.length)
    console.log('preset:', preset?.name || 'NO_PRESET')
    console.log(
      'score preview:',
      finalQuestions.slice(0, 10).map((question) => ({
        orderIndex: question.orderIndex,
        type: question.type,
        score: question.score,
        text: question.text.slice(0, 30),
      }))
    )
    console.log('total preview:', calculateQuestionTotalScore(finalQuestions))

    if (finalQuestions.length === 0) {
      return res.status(400).json({
        message: '没有可导入的有效题目',
      })
    }

   const missingScoreQuestions = finalQuestions.filter((question) => {
  return !Number(question.score || 0)
})

if (missingScoreQuestions.length > 0 && !preset) {
  return res.status(400).json({
    message: '部分题目缺少分值，请补充分值后再导入',
    data: {
      missingCount: missingScoreQuestions.length,
      missingOrderIndexes: missingScoreQuestions.map((question) => question.orderIndex),
      suggestion: '当前试卷分类没有预设分值规则，请在上传文件中填写分值，或先为该考试类型添加分值规则。',
    },
  })
}

    if (missingScoreQuestions.length > 0) {
      return res.status(400).json({
        message: '部分题目缺少分值，请补充分值后再导入',
        data: {
          missingCount: missingScoreQuestions.length,
          missingOrderIndexes: missingScoreQuestions.map((question) => question.orderIndex),
          suggestion: preset
            ? `当前试卷分类 ${exam.gradeLevel} 已有预设规则，但仍有题目无法匹配分值，请检查题号是否为 1-57。`
            : '当前试卷分类没有预设分值规则，请在上传文件中填写分值，或先为该考试类型添加分值规则。',
        },
      })
    }

    const createdQuestions = await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({
        where: {
          examId,
        },
      })

      const result = []

      for (const question of finalQuestions) {
        const createdQuestion = await tx.question.create({
          data: {
            examId,
            type: question.type,
            text: question.text,
            options: question.options,
            answer: question.answer,
            score: Number(question.score || 0),
            knowledgePoint: question.knowledgePoint || '未分类',
            referenceAnswer: question.referenceAnswer || '',
            explanation: question.explanation || '',
            orderIndex: Number(question.orderIndex || result.length + 1),
          },
        })

        result.push(createdQuestion)
      }

      const totalScore = calculateQuestionTotalScore(result)

      await tx.exam.update({
        where: {
          id: examId,
        },
        data: {
          totalScore,
          timeLimit: preset?.timeLimit || exam.timeLimit,
        },
      })

      return result
    })

    res.status(201).json({
      message: '题目批量导入成功',
      data: createdQuestions,
    })
  } catch (error) {
    console.error('Import questions error:', error)

    res.status(500).json({
      message: '题目批量导入失败',
      error: error.message,
    })
  }
})

router.post('/admin/import/parse-file', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: '请上传 .txt 或 .docx 文件',
      })
    }

    const originalName = req.file.originalname || ''
    const lowerName = originalName.toLowerCase()
    let rawText = ''

    if (lowerName.endsWith('.txt')) {
      rawText = await fs.readFile(req.file.path, 'utf-8')
    } else if (lowerName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({
        path: req.file.path,
      })

      rawText = result.value || ''
    } else {
      await fs.unlink(req.file.path).catch(() => {})

      return res.status(400).json({
        message: '只支持上传 .txt 或 .docx 文件',
      })
    }

    const questions = parseQuestionsFromText(rawText)

    await fs.unlink(req.file.path).catch(() => {})

    res.json({
      message: '文件解析成功',
      data: {
        fileName: originalName,
        questionCount: questions.length,
        questions,
      },
    })
  } catch (error) {
    console.error('Parse question file error:', error)

    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {})
    }

    res.status(500).json({
      message: '文件解析失败',
      error: error.message,
    })
  }
})

router.post(
  '/admin/import/prepare',
  requireAdmin,
  upload.fields([
    { name: 'paperFile', maxCount: 1 },
    { name: 'analysisFile', maxCount: 1 },
    { name: 'audioFile', maxCount: 1 },
    { name: 'transcriptFile', maxCount: 1 },
  ]),
  async (req, res) => {
    const uploadedFiles = [
      req.files?.paperFile?.[0],
      req.files?.analysisFile?.[0],
      req.files?.audioFile?.[0],
      req.files?.transcriptFile?.[0],
    ]

    try {
      const paperFile = req.files?.paperFile?.[0]
      const analysisFile = req.files?.analysisFile?.[0]
      const audioFile = req.files?.audioFile?.[0]
      const transcriptFile = req.files?.transcriptFile?.[0]
      const examType = req.body.examType || ''

      if (!paperFile) {
        await removeUploadedFiles(uploadedFiles)

        return res.status(400).json({
          message: '请上传试卷原题文件',
        })
      }

      const paperText = await readUploadedTextFile(paperFile)

      if (!paperText.trim()) {
        await removeUploadedFiles(uploadedFiles)

        return res.status(400).json({
          message: '未能从试卷文件中提取文字。如果这是扫描版 PDF，请先转成文字版，或后续使用 OCR 功能。',
        })
      }

      const analysisText = await readUploadedTextFile(analysisFile)
      const transcriptText = await readUploadedTextFile(transcriptFile)

      const questions = parseQuestionsFromText(paperText)

      const detectedExamType =
        examType ||
        detectExamTypeFromImport({
          fileName: paperFile.originalname,
          paperText,
          questionCount: questions.length,
        })

      const preset = getExamImportPreset(
        detectedExamType,
        paperFile.originalname,
        questions.length
      )

      const finalQuestions = applyExamImportPreset(questions, preset)
      const totalScore = calculateQuestionTotalScore(finalQuestions)

      await removeUploadedFiles(uploadedFiles)

      res.json({
        message: '文件预处理成功',
        data: {
          fileName: paperFile.originalname,
          detectedExamType: detectedExamType || 'UNKNOWN',
          questionCount: finalQuestions.length,
          materialCount: 0,
          totalScore,
          timeLimit: preset?.timeLimit || 0,
          audioFileName: audioFile?.originalname || '',
          hasAnalysisFile: Boolean(analysisFile),
          hasAudioFile: Boolean(audioFile),
          hasTranscriptFile: Boolean(transcriptFile),
          analysisTextPreview: analysisText.slice(0, 300),
          transcriptTextPreview: transcriptText.slice(0, 300),
          warnings: [],
          questions: finalQuestions,
        },
      })
    } catch (error) {
      console.error('Prepare import error:', error)

      await removeUploadedFiles(uploadedFiles)

      res.status(500).json({
        message: '文件预处理失败',
        error: error.message,
      })
    }
  }
)

module.exports = router