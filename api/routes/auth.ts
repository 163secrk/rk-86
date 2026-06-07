import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, name, phone, role } = req.body

    if (!username || !password || !name) {
      res.status(400).json({
        success: false,
        error: '用户名、密码、姓名不能为空',
      })
      return
    }

    const db = await getDb()
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username])

    if (existing) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '用户名已存在',
      })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userRole = role === 'worker' ? 'worker' : 'customer'

    const result = await db.run(
      'INSERT INTO users (username, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, name, phone || '', userRole]
    )

    if (userRole === 'worker') {
      await db.run(
        'INSERT INTO workers (user_id, name, phone, skills) VALUES (?, ?, ?, ?)',
        [result.lastID, name, phone || '', '']
      )
    }

    if (userRole === 'customer') {
      await db.run(
        'INSERT INTO members (user_id, level, points, total_spent, total_orders, discount) VALUES (?, ?, ?, ?, ?, ?)',
        [result.lastID, '普通', 0, 0, 0, 1.0]
      )
    }

    const user = await db.get(
      'SELECT id, username, name, phone, role FROM users WHERE id = ?',
      [result.lastID]
    )
    await db.close()

    res.json({
      success: true,
      data: user,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '注册失败',
    })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '用户名和密码不能为空',
      })
      return
    }

    const db = await getDb()
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username])
    await db.close()

    if (!user) {
      res.status(400).json({
        success: false,
        error: '用户名或密码错误',
      })
      return
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      res.status(400).json({
        success: false,
        error: '用户名或密码错误',
      })
      return
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '登录失败',
    })
  }
})

router.post('/logout', authMiddleware, (req: AuthRequest, res: Response): void => {
  res.json({
    success: true,
    message: '已退出登录',
  })
})

router.get('/profile', authMiddleware, (req: AuthRequest, res: Response): void => {
  res.json({
    success: true,
    data: req.user,
  })
})

export default router
