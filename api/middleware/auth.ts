import { type Request, type Response, type NextFunction } from 'express'
import { getDb } from '../db.js'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    name: string
    phone: string
    role: string
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.headers['x-user-id']

  if (!userId) {
    res.status(401).json({
      success: false,
      error: '未登录，请先登录',
    })
    return
  }

  try {
    const db = await getDb()
    const user = await db.get(
      'SELECT id, username, name, phone, role FROM users WHERE id = ?',
      [userId]
    )
    await db.close()

    if (!user) {
      res.status(401).json({
        success: false,
        error: '用户不存在',
      })
      return
    }

    req.user = user
    next()
  } catch (err) {
    res.status(500).json({
      success: false,
      error: '认证失败',
    })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: '未登录',
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: '权限不足',
      })
      return
    }

    next()
  }
}
