import { Router, type Request, type Response } from 'express'
import { getDb, calculateMemberLevel, calculatePointsDeduction, MEMBER_LEVELS } from '../db.js'
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/profile', authMiddleware, requireRole('customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const db = await getDb()

    const member = await db.get('SELECT * FROM members WHERE user_id = ?', [userId])

    if (!member) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '会员信息不存在',
      })
      return
    }

    const currentLevelConfig = MEMBER_LEVELS.find(l => l.level === member.level) || MEMBER_LEVELS[0]
    const nextLevelIndex = MEMBER_LEVELS.findIndex(l => l.level === member.level) + 1
    const nextLevel = nextLevelIndex < MEMBER_LEVELS.length ? MEMBER_LEVELS[nextLevelIndex] : null

    let progress = 100
    if (nextLevel) {
      const levelRange = nextLevel.minSpent - currentLevelConfig.minSpent
      const currentProgress = member.total_spent - currentLevelConfig.minSpent
      progress = Math.min(100, Math.round((currentProgress / levelRange) * 100))
    }

    const memberWithDetails = {
      ...member,
      currentLevelConfig,
      nextLevel,
      progress,
    }

    await db.close()

    res.json({
      success: true,
      data: memberWithDetails,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取会员信息失败',
    })
  }
})

router.get('/points', authMiddleware, requireRole('customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 20
    const offset = (page - 1) * pageSize

    const db = await getDb()

    const member = await db.get('SELECT id FROM members WHERE user_id = ?', [userId])
    if (!member) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '会员信息不存在',
      })
      return
    }

    const records = await db.all(
      `SELECT pr.*, o.order_no, s.name as service_name
       FROM points_records pr
       LEFT JOIN orders o ON pr.order_id = o.id
       LEFT JOIN services s ON o.service_id = s.id
       WHERE pr.user_id = ?
       ORDER BY pr.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    )

    const total = await db.get('SELECT COUNT(*) as count FROM points_records WHERE user_id = ?', [userId])

    await db.close()

    res.json({
      success: true,
      data: {
        records,
        total: total.count,
        page,
        pageSize,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取积分记录失败',
    })
  }
})

router.get('/orders', authMiddleware, requireRole('customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 20
    const offset = (page - 1) * pageSize

    const db = await getDb()

    const orders = await db.all(
      `SELECT o.*, s.name as service_name, s.image as service_image
       FROM orders o
       LEFT JOIN services s ON o.service_id = s.id
       WHERE o.customer_id = ? AND o.status = 'completed'
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    )

    const total = await db.get(
      'SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND status = ?',
      [userId, 'completed']
    )

    const totalSpent = await db.get(
      'SELECT COALESCE(SUM(price), 0) as total FROM orders WHERE customer_id = ? AND status = ?',
      [userId, 'completed']
    )

    await db.close()

    res.json({
      success: true,
      data: {
        orders,
        total: total.count,
        total_spent: totalSpent.total,
        page,
        pageSize,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取消费记录失败',
    })
  }
})

router.post('/calculate-deduction', authMiddleware, requireRole('customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { points, order_amount } = req.body
    const userId = req.user!.id

    if (!points || points <= 0) {
      res.status(400).json({
        success: false,
        error: '请输入有效的积分数',
      })
      return
    }

    const db = await getDb()
    const member = await db.get('SELECT points, level, discount FROM members WHERE user_id = ?', [userId])

    if (!member) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '会员信息不存在',
      })
      return
    }

    if (points > member.points) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '积分余额不足',
      })
      return
    }

    const deductionAmount = calculatePointsDeduction(points)
    const maxDeduction = order_amount ? Math.floor(order_amount * 0.5) : deductionAmount
    const finalDeduction = Math.min(deductionAmount, maxDeduction)
    const pointsUsed = finalDeduction * 100

    await db.close()

    res.json({
      success: true,
      data: {
        points_available: member.points,
        points_requested: points,
        points_used: pointsUsed,
        deduction_amount: finalDeduction,
        max_deduction: maxDeduction,
        member_level: member.level,
        member_discount: member.discount,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '计算积分抵扣失败',
    })
  }
})

router.get('/levels', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: MEMBER_LEVELS,
  })
})

export default router
