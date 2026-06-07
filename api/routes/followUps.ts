import { Router, type Response } from 'express'
import { getDb } from '../db.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const FOLLOW_UP_SELECT_SQL = `
  SELECT fu.*,
         o.order_no, o.price, o.appointment_time, o.status as order_status,
         s.name as service_name,
         c.name as customer_name,
         w.name as worker_name
  FROM follow_ups fu
  LEFT JOIN orders o ON fu.order_id = o.id
  LEFT JOIN services s ON o.service_id = s.id
  LEFT JOIN users c ON fu.customer_id = c.id
  LEFT JOIN workers wk ON fu.worker_id = wk.id
  LEFT JOIN users w ON wk.user_id = w.id
`

function isExpired(expireAt: string): boolean {
  return new Date(expireAt) < new Date()
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { worker_id, order_id, status } = req.query
    const db = await getDb()

    let sql = FOLLOW_UP_SELECT_SQL
    const params: any[] = []
    const conditions: string[] = []

    if (worker_id) {
      conditions.push('fu.worker_id = ?')
      params.push(Number(worker_id))
    }
    if (order_id) {
      conditions.push('fu.order_id = ?')
      params.push(Number(order_id))
    }
    if (status) {
      conditions.push('fu.status = ?')
      params.push(status)
    }

    if (req.user!.role === 'customer') {
      conditions.push('fu.customer_id = ?')
      params.push(req.user!.id)
    } else if (req.user!.role === 'worker') {
      conditions.push('fu.worker_id = (SELECT id FROM workers WHERE user_id = ?)')
      params.push(req.user!.id)
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY fu.created_at DESC'

    const followUps = await db.all(sql, params)
    await db.close()

    const result = followUps.map((fu: any) => ({
      ...fu,
      is_expired: fu.status === 'pending' && isExpired(fu.expire_at),
    }))

    res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取回访列表失败',
    })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()

    let sql = FOLLOW_UP_SELECT_SQL + ' WHERE fu.id = ?'
    const params: any[] = [Number(id)]

    if (req.user!.role === 'customer') {
      sql += ' AND fu.customer_id = ?'
      params.push(req.user!.id)
    } else if (req.user!.role === 'worker') {
      sql += ' AND fu.worker_id = (SELECT id FROM workers WHERE user_id = ?)'
      params.push(req.user!.id)
    }

    const followUp = await db.get(sql, params)
    await db.close()

    if (!followUp) {
      res.status(404).json({
        success: false,
        error: '回访记录不存在或无权限查看',
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...followUp,
        is_expired: followUp.status === 'pending' && isExpired(followUp.expire_at),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取回访详情失败',
    })
  }
})

router.get('/order/:orderId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params
    const db = await getDb()

    let sql = FOLLOW_UP_SELECT_SQL + ' WHERE fu.order_id = ?'
    const params: any[] = [Number(orderId)]

    if (req.user!.role === 'customer') {
      sql += ' AND fu.customer_id = ?'
      params.push(req.user!.id)
    } else if (req.user!.role === 'worker') {
      sql += ' AND fu.worker_id = (SELECT id FROM workers WHERE user_id = ?)'
      params.push(req.user!.id)
    }

    const followUp = await db.get(sql, params)
    await db.close()

    if (!followUp) {
      res.status(404).json({
        success: false,
        error: '回访记录不存在',
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...followUp,
        is_expired: followUp.status === 'pending' && isExpired(followUp.expire_at),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取回访记录失败',
    })
  }
})

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { attitude_rating, quality_rating, punctuality_rating, feedback } = req.body
    const userId = req.user?.id

    if (attitude_rating === undefined || quality_rating === undefined || punctuality_rating === undefined) {
      res.status(400).json({
        success: false,
        error: '请完成所有评分项',
      })
      return
    }

    const ratings = [attitude_rating, quality_rating, punctuality_rating]
    for (const rating of ratings) {
      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: '评分必须在1-5之间',
        })
        return
      }
    }

    const db = await getDb()

    const followUp = await db.get(
      'SELECT * FROM follow_ups WHERE id = ? AND customer_id = ?',
      [Number(id), userId]
    )

    if (!followUp) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '回访记录不存在或无权限操作',
      })
      return
    }

    if (followUp.status === 'completed') {
      await db.close()
      res.status(400).json({
        success: false,
        error: '该回访已完成，不可重复提交',
      })
      return
    }

    if (followUp.status === 'pending' && isExpired(followUp.expire_at)) {
      await db.run(
        `UPDATE follow_ups SET status = 'expired' WHERE id = ?`,
        [Number(id)]
      )
      await db.close()
      res.status(400).json({
        success: false,
        error: '回访已过期，无法提交',
      })
      return
    }

    await db.run(
      `UPDATE follow_ups SET 
       attitude_rating = ?, quality_rating = ?, punctuality_rating = ?, feedback = ?, 
       status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        Number(attitude_rating),
        Number(quality_rating),
        Number(punctuality_rating),
        feedback || '',
        Number(id),
      ]
    )

    const avgResult = await db.get(
      `SELECT 
        AVG(attitude_rating) as avg_attitude,
        AVG(quality_rating) as avg_quality,
        AVG(punctuality_rating) as avg_punctuality,
        COUNT(*) as follow_up_count
       FROM follow_ups 
       WHERE worker_id = ? AND status = 'completed'`,
      [followUp.worker_id]
    )

    if (avgResult) {
      const avgAttitude = avgResult.avg_attitude || 0
      const avgQuality = avgResult.avg_quality || 0
      const avgPunctuality = avgResult.avg_punctuality || 0
      const overallRating = ((avgAttitude + avgQuality + avgPunctuality) / 3).toFixed(1)

      await db.run(
        'UPDATE workers SET rating = ?, order_count = ? WHERE id = ?',
        [Number(overallRating), avgResult.follow_up_count || 0, followUp.worker_id]
      )
    }

    const updatedFollowUp = await db.get(FOLLOW_UP_SELECT_SQL + ' WHERE fu.id = ?', [Number(id)])
    await db.close()

    res.json({
      success: true,
      data: {
        ...updatedFollowUp,
        is_expired: false,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '提交回访失败',
    })
  }
})

router.get('/worker/:workerId/stats', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { workerId } = req.params
    const db = await getDb()

    const stats = await db.get(
      `SELECT 
        AVG(attitude_rating) as avg_attitude,
        AVG(quality_rating) as avg_quality,
        AVG(punctuality_rating) as avg_punctuality,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count
       FROM follow_ups 
       WHERE worker_id = ?`,
      [Number(workerId)]
    )

    await db.close()

    const avgAttitude = stats?.avg_attitude || 0
    const avgQuality = stats?.avg_quality || 0
    const avgPunctuality = stats?.avg_punctuality || 0
    const overallRating = stats?.completed_count
      ? Number(((avgAttitude + avgQuality + avgPunctuality) / 3).toFixed(1))
      : 5.0

    res.json({
      success: true,
      data: {
        avg_attitude: Number(avgAttitude.toFixed(1)),
        avg_quality: Number(avgQuality.toFixed(1)),
        avg_punctuality: Number(avgPunctuality.toFixed(1)),
        overall_rating: overallRating,
        total_count: stats?.total_count || 0,
        completed_count: stats?.completed_count || 0,
        pending_count: stats?.pending_count || 0,
        expired_count: stats?.expired_count || 0,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取家政人员回访统计失败',
    })
  }
})

export default router
