const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const getUserFromToken = async (req) => {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.replace('Bearer ', '')
  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  const user = await prisma.user.findUnique({
    where: {
      id: decoded.userId,
    },
  })

  return user
}

const optionalAuth = async (req, res, next) => {
  try {
    const user = await getUserFromToken(req)
    req.user = user
    next()
  } catch (error) {
    req.user = null
    next()
  }
}

const requireAuth = async (req, res, next) => {
  try {
    const user = await getUserFromToken(req)

    if (!user) {
      return res.status(401).json({
        message: '请先登录',
      })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({
      message: '登录状态无效或已过期',
    })
  }
}

const requireRole = (allowedRoles, message = '当前账号没有访问权限') => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  return async (req, res, next) => {
    try {
      const user = await getUserFromToken(req)

      if (!user) {
        return res.status(401).json({
          message: '请先登录',
        })
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          message,
        })
      }

      req.user = user
      next()
    } catch (error) {
      return res.status(401).json({
        message: '登录状态无效或已过期',
      })
    }
  }
}

const requireTeacher = requireRole('TEACHER', '当前账号没有教师权限')

const requireTeacherOrAdmin = requireRole(
  ['TEACHER', 'ADMIN'],
  '当前账号没有教师或管理员权限'
)

const requireAdmin = async (req, res, next) => {
  try {
    const user = await getUserFromToken(req)

    if (!user) {
      return res.status(401).json({
        message: '请先登录管理员账号',
      })
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        message: '当前账号没有管理员权限',
      })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({
      message: '登录状态无效或已过期',
    })
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireRole,
  requireTeacher,
  requireTeacherOrAdmin,
  requireAdmin,
}
