const prisma = require('../src/lib/prisma')

const exams = [
  {
    id: 'primary_mock_2026_001',
    title: '2026 小学英语模拟卷 001',
    gradeLevel: 'PRIMARY',
    questionCount: 6,
    totalScore: 100,
    timeLimit: 1800,
    description: '适合小学英语基础词汇、简单句和阅读入门训练。',
  },
  {
    id: 'primary_mock_2026_002',
    title: '2026 小学英语模拟卷 002',
    gradeLevel: 'PRIMARY',
    questionCount: 6,
    totalScore: 100,
    timeLimit: 1800,
    description: '适合巩固小学阶段常见语法和日常表达。',
  },
  {
    id: 'junior_mock_2026_001',
    title: '2026 初中英语模拟卷 001',
    gradeLevel: 'JUNIOR',
    questionCount: 8,
    totalScore: 100,
    timeLimit: 3600,
    description: '适合中考英语综合模拟训练，覆盖单选、阅读、完形和写作。',
  },
  {
    id: 'junior_mock_2026_002',
    title: '2026 初中英语模拟卷 002',
    gradeLevel: 'JUNIOR',
    questionCount: 8,
    totalScore: 100,
    timeLimit: 3600,
    description: '适合检测初中阶段动词时态、阅读理解和基础写作能力。',
  },
  {
    id: 'senior_mock_2026_001',
    title: '2026 高中英语模拟卷 001',
    gradeLevel: 'SENIOR',
    questionCount: 10,
    totalScore: 150,
    timeLimit: 7200,
    description: '适合高中英语综合能力训练，侧重阅读、语法填空和写作。',
  },
  {
    id: 'senior_mock_2026_002',
    title: '2026 高中英语模拟卷 002',
    gradeLevel: 'SENIOR',
    questionCount: 10,
    totalScore: 150,
    timeLimit: 7200,
    description: '适合高考英语模拟练习，训练阅读速度和写作结构。',
  },
  {
    id: 'college_mock_2026_001',
    title: '2026 大学英语模拟卷 001',
    gradeLevel: 'CET4',
    questionCount: 10,
    totalScore: 100,
    timeLimit: 5400,
    description: '适合大学英语四级方向练习，强化词汇、阅读、翻译和写作。',
  },
  {
    id: 'college_mock_2026_002',
    title: '2026 大学英语模拟卷 002',
    gradeLevel: 'CET6',
    questionCount: 10,
    totalScore: 100,
    timeLimit: 5400,
    description: '适合大学英语六级方向练习，强化长阅读、翻译表达和写作能力。',
  },
]

const questions = [
  {
    id: 'junior_mock_2026_001_q001',
    examId: 'junior_mock_2026_001',
    type: 'CHOICE',
    text: 'What is the past tense of "run"?',
    options: ['ran', 'run', 'running', 'runned'],
    answer: 0,
    score: 2,
    knowledgePoint: '动词时态',
    referenceAnswer: 'ran',
    explanation: 'run 的过去式是不规则变化 ran。',
    orderIndex: 1,
  },
  {
    id: 'junior_mock_2026_001_q002',
    examId: 'junior_mock_2026_001',
    type: 'TRANSLATION',
    text: '请将以下句子翻译成英文：我喜欢学习英语。',
    answer: 'I like learning English.',
    score: 5,
    knowledgePoint: '翻译',
    referenceAnswer: 'I like learning English.',
    explanation: '注意“喜欢做某事”可以表达为 like doing something。',
    orderIndex: 2,
  },
  {
    id: 'junior_mock_2026_001_q003',
    examId: 'junior_mock_2026_001',
    type: 'ERROR_CORRECTION',
    text: '原句：He go to school yesterday. 请改正。',
    answer: 'He went to school yesterday.',
    score: 5,
    knowledgePoint: '动词过去式',
    referenceAnswer: 'He went to school yesterday.',
    explanation: 'yesterday 表示过去时间，动词 go 应改为 went。',
    orderIndex: 3,
  },
  {
    id: 'junior_mock_2026_001_q004',
    examId: 'junior_mock_2026_001',
    type: 'WRITING',
    text: '写一篇关于“My Family”的短文，不少于 50 词。',
    answer: '示例答案略',
    score: 10,
    knowledgePoint: '写作',
    referenceAnswer:
      'I have a happy family. There are three people in my family. My parents love me very much, and I love them too.',
    explanation: '写作应包含家庭成员、人物特点和情感表达。',
    orderIndex: 4,
  },
  {
    id: 'primary_mock_2026_001_q001',
    examId: 'primary_mock_2026_001',
    type: 'CHOICE',
    text: 'Which word means “苹果”?',
    options: ['apple', 'banana', 'orange', 'pear'],
    answer: 0,
    score: 2,
    knowledgePoint: '基础词汇',
    referenceAnswer: 'apple',
    explanation: 'apple 的意思是苹果。',
    orderIndex: 1,
  },
  {
    id: 'primary_mock_2026_001_q002',
    examId: 'primary_mock_2026_001',
    type: 'CHOICE',
    text: 'Choose the correct sentence.',
    options: ['I am a student.', 'I is a student.', 'I are a student.', 'I be a student.'],
    answer: 0,
    score: 2,
    knowledgePoint: 'be 动词',
    referenceAnswer: 'I am a student.',
    explanation: '主语 I 搭配 am。',
    orderIndex: 2,
  },
]

const seedDatabase = async () => {
  try {
    console.log('Start seeding database...')

    for (const exam of exams) {
      await prisma.exam.upsert({
        where: {
          id: exam.id,
        },
        update: {
          title: exam.title,
          gradeLevel: exam.gradeLevel,
          description: exam.description,
          timeLimit: exam.timeLimit,
          totalScore: exam.totalScore,
          isPublished: true,
        },
        create: {
          id: exam.id,
          title: exam.title,
          gradeLevel: exam.gradeLevel,
          description: exam.description,
          timeLimit: exam.timeLimit,
          totalScore: exam.totalScore,
          isPublished: true,
        },
      })
    }

    for (const question of questions) {
      await prisma.question.upsert({
        where: {
          id: question.id,
        },
        update: {
          examId: question.examId,
          type: question.type,
          text: question.text,
          options: question.options || null,
          answer: question.answer,
          score: question.score,
          knowledgePoint: question.knowledgePoint,
          referenceAnswer: question.referenceAnswer,
          explanation: question.explanation,
          orderIndex: question.orderIndex,
        },
        create: {
          id: question.id,
          examId: question.examId,
          type: question.type,
          text: question.text,
          options: question.options || null,
          answer: question.answer,
          score: question.score,
          knowledgePoint: question.knowledgePoint,
          referenceAnswer: question.referenceAnswer,
          explanation: question.explanation,
          orderIndex: question.orderIndex,
        },
      })
    }

    const examCount = await prisma.exam.count()
    const questionCount = await prisma.question.count()

    console.log('Database seeding successful.')
    console.log(`Exams: ${examCount}`)
    console.log(`Questions: ${questionCount}`)
  } catch (error) {
    console.error('Database seeding failed.')
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

seedDatabase()