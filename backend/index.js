const express = require('express')
const cors = require('cors')
require('dotenv').config()

const examRoutes = require('./src/routes/examRoutes')
const authRoutes = require('./src/routes/authRoutes')
const adminRoutes = require('./src/routes/adminRoutes')
const adminImportRoutes = require('./src/routes/adminImportRoutes')
const resultRoutes = require('./src/routes/resultRoutes')
const wrongPracticeRoutes = require('./src/routes/wrongPracticeRoutes')
const adminAttemptRoutes = require('./src/routes/adminAttemptRoutes')

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean)

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true
  }

  if (allowedOrigins.includes(origin)) {
    return true
  }

  if (origin.includes('localhost')) {
    return true
  }

  if (origin.includes('127.0.0.1')) {
    return true
  }

  if (origin.includes('vercel.app')) {
    return true
  }

  if (origin.includes('github.dev')) {
    return true
  }

  if (origin.includes('app.github.dev')) {
    return true
  }

  if (origin.includes('githubpreview.dev')) {
    return true
  }

  return false
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      console.warn('Blocked by CORS:', origin)

      callback(null, false)
    },
    credentials: true,
  })
)

app.use(express.json({
  limit: '10mb',
}))

app.get('/', (req, res) => {
  res.json({
    message: 'English Exam System Backend API',
    status: 'ok',
    docs: {
      health: '/api/health',
      exams: '/api/exams',
      login: '/api/auth/login',
      register: '/api/auth/register',
      adminExams: '/api/admin/exams',
      importFile: '/api/admin/import/parse-file',
      attemptDetail: '/api/attempts/:attemptId/detail',
      wrongPractice: '/api/wrong-questions/:wrongQuestionId/practice',
    },
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    message: 'Backend is running',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

const routeList = [
  ['examRoutes', examRoutes],
  ['authRoutes', authRoutes],
  ['adminRoutes', adminRoutes],
  ['adminImportRoutes', adminImportRoutes],
  ['resultRoutes', resultRoutes],
  ['wrongPracticeRoutes', wrongPracticeRoutes],
  ['adminAttemptRoutes', adminAttemptRoutes],
]

for (const [routeName, routeHandler] of routeList) {
  if (typeof routeHandler !== 'function') {
    console.error(`${routeName} is not a valid Express router. Please check module.exports in that route file.`)
    process.exit(1)
  }

  app.use('/api', routeHandler)
}

app.use((req, res) => {
  res.status(404).json({
    message: '接口不存在',
    path: req.originalUrl,
  })
})

app.use((err, req, res, next) => {
  console.error(err)

  res.status(500).json({
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`)
})