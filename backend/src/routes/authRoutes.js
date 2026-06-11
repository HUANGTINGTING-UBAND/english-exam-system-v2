const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const router = express.Router()

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    }
  )
}

const formatUser = (user) => {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    gradeLevel: user.gradeLevel,
    createdAt: user.createdAt,
  }
}

router.post('/auth/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body

    if (!username || !password) {
      return res.status(400).json({
        message: '用户名和密码不能为空',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: '密码长度不能少于 6 位',
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        username,
      },
    })

    if (existingUser) {
      return res.status(409).json({
        message: '用户名已存在',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        nickname: nickname || username,
        role: 'STUDENT',
        gradeLevel: 'PRIMARY',
      },
    })

    const token = createToken(user)

    res.status(201).json({
      message: '注册成功',
      data: {
        token,
        user: formatUser(user),
      },
    })
  } catch (error) {
    console.error('Register error:', error)

    res.status(500).json({
      message: '注册失败',
      error: error.message,
    })
  }
})

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        message: '用户名和密码不能为空',
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    })

    if (!user) {
      return res.status(401).json({
        message: '用户名或密码错误',
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return res.status(401).json({
        message: '用户名或密码错误',
      })
    }

    const token = createToken(user)

    res.json({
      message: '登录成功',
      data: {
        token,
        user: formatUser(user),
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    res.status(500).json({
      message: '登录失败',
      error: error.message,
    })
  }
})

router.get('/auth/me', async (req, res) => {
  try {
    const authorization = req.headers.authorization

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        message: '未登录',
      })
    }

    const token = authorization.replace('Bearer ', '')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
    })

    if (!user) {
      return res.status(401).json({
        message: '用户不存在',
      })
    }

    res.json({
      message: '当前用户获取成功',
      data: formatUser(user),
    })
  } catch (error) {
    console.error('Auth me error:', error)

    res.status(401).json({
      message: '登录状态无效或已过期',
    })
  }
})

module.exports = router