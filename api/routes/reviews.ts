import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { worker_id, order_id } = req.query
    const db = await getDb()

    let sql = `
      SELECT r.*,
             o.order_no, o.price, o.appointment_time, o.status as order_status,
             s.name as service_name,
             c.name as customer_name,
             w.name as worker_name
      FROM reviews r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN services s ON o.service_id = s.id
      LEFT JOIN users c ON r.customer_id = c.id
      LEFT JOIN workers wk ON r.worker_id = wk.id
      LEFT JOIN users w ON wk.user_id = w.id
    `
    const params: any[] = []
    const conditions: string[] = []

    if (worker_id) {
      conditions.push('r.worker_id = ?')
      params.push(Number(worker_id))
    }
    if (order_id) {
      conditions.push('r.order_id = ?')
      params.push(Number(order_id))
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY r.created_at DESC'

    const reviews = await db.all(sql, params)
    await db.close()

    res.json({
      success: true,
      data: reviews,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取评价列表失败',
    })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()

    const review = await db.get(
      `
      SELECT r.*,
             o.order_no, o.price, o.appointment_time, o.status as order_status,
             s.name as service_name,
             c.name as customer_name,
             w.name as worker_name
      FROM reviews r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN services s ON o.service_id = s.id
      LEFT JOIN users c ON r.customer_id = c.id
      LEFT JOIN workers wk ON r.worker_id = wk.id
      LEFT JOIN users w ON wk.user_id = w.id
      WHERE r.id = ?
      `,
      [Number(id)]
    )
    await db.close()

    if (!review) {
      res.status(404).json({
        success: false,
        error: '评价不存在',
      })
      return
    }

    res.json({
      success: true,
      data: review,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取评价详情失败',
    })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { order_id, rating, content } = req.body
    const userId = req.user?.id

    if (!order_id || !rating) {
      res.status(400).json({
        success: false,
        error: '订单ID和评分不能为空',
      })
      return
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        error: '评分必须在1-5之间',
      })
      return
    }

    const db = await getDb()

    const order = await db.get(
      'SELECT * FROM orders WHERE id = ?',
      [Number(order_id)]
    )

    if (!order) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '订单不存在',
      })
      return
    }

    if (order.customer_id !== userId) {
      await db.close()
      res.status(403).json({
        success: false,
        error: '只能评价自己的订单',
      })
      return
    }

    if (order.status !== 'completed') {
      await db.close()
      res.status(400).json({
        success: false,
        error: '订单未完成，无法评价',
      })
      return
    }

    const existingReview = await db.get(
      'SELECT id FROM reviews WHERE order_id = ?',
      [Number(order_id)]
    )

    if (existingReview) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '该订单已评价',
      })
      return
    }

    const result = await db.run(
      'INSERT INTO reviews (order_id, customer_id, worker_id, rating, content) VALUES (?, ?, ?, ?, ?)',
      [Number(order_id), userId, order.worker_id, Number(rating), content || '']
    )

    const avgResult = await db.get(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE worker_id = ?',
      [order.worker_id]
    )

    await db.run(
      'UPDATE workers SET rating = ?, order_count = ? WHERE id = ?',
      [avgResult.avg_rating || 5.0, avgResult.review_count || 0, order.worker_id]
    )

    const review = await db.get(
      `
      SELECT r.*,
             o.order_no, o.price, o.appointment_time, o.status as order_status,
             s.name as service_name,
             c.name as customer_name,
             w.name as worker_name
      FROM reviews r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN services s ON o.service_id = s.id
      LEFT JOIN users c ON r.customer_id = c.id
      LEFT JOIN workers wk ON r.worker_id = wk.id
      LEFT JOIN users w ON wk.user_id = w.id
      WHERE r.id = ?
      `,
      [result.lastID]
    )

    await db.close()

    res.json({
      success: true,
      data: review,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '创建评价失败',
    })
  }
})

router.get('/worker/:workerId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { workerId } = req.params
    const db = await getDb()

    const reviews = await db.all(
      `
      SELECT r.*,
             o.order_no, o.price, o.appointment_time, o.status as order_status,
             s.name as service_name,
             c.name as customer_name,
             w.name as worker_name
      FROM reviews r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN services s ON o.service_id = s.id
      LEFT JOIN users c ON r.customer_id = c.id
      LEFT JOIN workers wk ON r.worker_id = wk.id
      LEFT JOIN users w ON wk.user_id = w.id
      WHERE r.worker_id = ?
      ORDER BY r.created_at DESC
      `,
      [Number(workerId)]
    )

    const stats = await db.get(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE worker_id = ?',
      [Number(workerId)]
    )

    await db.close()

    res.json({
      success: true,
      data: {
        reviews,
        avg_rating: stats?.avg_rating || 0,
        review_count: stats?.review_count || 0,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取家政人员评价失败',
    })
  }
})

export default router
