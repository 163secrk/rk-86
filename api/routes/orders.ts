import { Router, type Request, type Response } from 'express'
import { getDb, calculateMemberLevel, calculatePointsEarned } from '../db.js'
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'

const router = Router()

function generateOrderNo(): string {
  const timestamp = Date.now().toString()
  const random = Math.floor(1000 + Math.random() * 9000).toString()
  return `HS${timestamp}${random}`
}

const ORDER_SELECT_SQL = `
  SELECT 
    o.*,
    s.name AS service_name,
    p.name AS package_name,
    cu.name AS customer_name,
    wu.name AS worker_name,
    fu.id AS follow_up_id,
    fu.status AS follow_up_status,
    fu.expire_at AS follow_up_expire_at,
    fu.attitude_rating,
    fu.quality_rating,
    fu.punctuality_rating,
    fu.feedback,
    fu.completed_at AS follow_up_completed_at
  FROM orders o
  LEFT JOIN services s ON o.service_id = s.id
  LEFT JOIN packages p ON o.package_id = p.id
  LEFT JOIN users cu ON o.customer_id = cu.id
  LEFT JOIN workers w ON o.worker_id = w.id
  LEFT JOIN users wu ON w.user_id = wu.id
  LEFT JOIN follow_ups fu ON o.id = fu.order_id
`

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    let sql = ORDER_SELECT_SQL
    const params: any[] = []

    if (req.user!.role === 'customer') {
      sql += ' WHERE o.customer_id = ?'
      params.push(req.user!.id)
    } else if (req.user!.role === 'worker') {
      sql += ' WHERE o.worker_id = (SELECT id FROM workers WHERE user_id = ?)'
      params.push(req.user!.id)
    }

    sql += ' ORDER BY o.created_at DESC'

    const orders = await db.all(sql, params)
    await db.close()

    res.json({
      success: true,
      data: orders,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取订单列表失败',
    })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()
    let sql = ORDER_SELECT_SQL + ' WHERE o.id = ?'
    const params: any[] = [id]

    if (req.user!.role === 'customer') {
      sql += ' AND o.customer_id = ?'
      params.push(req.user!.id)
    } else if (req.user!.role === 'worker') {
      sql += ' AND o.worker_id = (SELECT id FROM workers WHERE user_id = ?)'
      params.push(req.user!.id)
    }

    const order = await db.get(sql, params)

    if (!order) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '订单不存在或无权限查看',
      })
      return
    }

    let subtasks: any[] = []
    if (order.is_package_order) {
      subtasks = await db.all(`
        SELECT 
          os.*,
          s.name AS service_name,
          s.description AS service_description,
          s.price AS service_price,
          wu.name AS worker_name
        FROM order_subtasks os
        LEFT JOIN services s ON os.service_id = s.id
        LEFT JOIN workers w ON os.worker_id = w.id
        LEFT JOIN users wu ON w.user_id = wu.id
        WHERE os.parent_order_id = ?
        ORDER BY os.id ASC
      `, [id])
    }

    await db.close()

    res.json({
      success: true,
      data: {
        ...order,
        subtasks,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取订单详情失败',
    })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { service_id, package_id, contact_name, contact_phone, address, appointment_time, price, remark, use_points = 0 } = req.body

    if ((!service_id && !package_id) || !contact_name || !contact_phone || !address || !appointment_time || !price) {
      res.status(400).json({
        success: false,
        error: '请填写完整的订单信息',
      })
      return
    }

    const db = await getDb()

    let isPackageOrder = false
    let packageServices: any[] = []

    if (package_id) {
      isPackageOrder = true
      const pkg = await db.get('SELECT * FROM packages WHERE id = ? AND status = ?', [package_id, 'active'])
      if (!pkg) {
        await db.close()
        res.status(404).json({
          success: false,
          error: '套餐不存在或已下架',
        })
        return
      }

      packageServices = await db.all(`
        SELECT ps.*, s.name, s.price, s.duration
        FROM package_services ps
        JOIN services s ON ps.service_id = s.id
        WHERE ps.package_id = ?
      `, [package_id])

      if (packageServices.length === 0) {
        await db.close()
        res.status(400).json({
          success: false,
          error: '套餐未包含任何服务',
        })
        return
      }
    } else {
      const service = await db.get('SELECT id FROM services WHERE id = ?', [service_id])
      if (!service) {
        await db.close()
        res.status(404).json({
          success: false,
          error: '服务不存在',
        })
        return
      }
    }

    const orderNo = generateOrderNo()
    const customerId = req.user!.id
    let finalPrice = price
    let pointsDeduction = 0
    let pointsUsed = 0

    if (use_points && use_points > 0) {
      const member = await db.get('SELECT * FROM members WHERE user_id = ?', [customerId])
      if (!member) {
        await db.close()
        res.status(400).json({
          success: false,
          error: '会员信息不存在',
        })
        return
      }

      if (use_points > member.points) {
        await db.close()
        res.status(400).json({
          success: false,
          error: '积分余额不足',
        })
        return
      }

      pointsDeduction = Math.floor(use_points / 100)
      const maxDeduction = Math.floor(price * 0.5)
      pointsDeduction = Math.min(pointsDeduction, maxDeduction)
      pointsUsed = pointsDeduction * 100

      if (pointsUsed > 0) {
        finalPrice = Math.max(0, price - pointsDeduction)
        const newPoints = member.points - pointsUsed

        await db.run(
          'UPDATE members SET points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newPoints, member.id]
        )
      }
    }

    const result = await db.run(
      `INSERT INTO orders 
       (order_no, customer_id, service_id, package_id, is_package_order, contact_name, contact_phone, address, appointment_time, price, subtotal_price, status, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [orderNo, customerId, isPackageOrder ? packageServices[0].service_id : service_id, package_id || null, isPackageOrder ? 1 : 0, contact_name, contact_phone, address, appointment_time, finalPrice, price, remark || '']
    )

    if (isPackageOrder) {
      for (const ps of packageServices) {
        await db.run(
          `INSERT INTO order_subtasks (parent_order_id, service_id, status)
           VALUES (?, ?, 'pending')`,
          [result.lastID, ps.service_id]
        )
      }
    }

    if (pointsUsed > 0) {
      const member = await db.get('SELECT id, points FROM members WHERE user_id = ?', [customerId])
      if (member) {
        await db.run(
          `INSERT INTO points_records (member_id, user_id, type, points, balance, order_id, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [member.id, customerId, 'spend', -pointsUsed, member.points, result.lastID, `订单抵扣，使用${pointsUsed}积分，抵扣¥${pointsDeduction}`]
        )
      }
    }

    const order = await db.get(ORDER_SELECT_SQL + ' WHERE o.id = ?', [result.lastID])

    let subtasks: any[] = []
    if (isPackageOrder) {
      subtasks = await db.all(`
        SELECT 
        os.*,
        s.name AS service_name,
        wu.name AS worker_name
      FROM order_subtasks os
      LEFT JOIN services s ON os.service_id = s.id
      LEFT JOIN workers w ON os.worker_id = w.id
      LEFT JOIN users wu ON w.user_id = wu.id
      WHERE os.parent_order_id = ?
      ORDER BY os.id ASC
    `, [result.lastID])
    }

    await db.close()

    res.json({
      success: true,
      data: {
        ...order,
        subtasks,
        original_price: price,
        points_deduction: pointsDeduction,
        points_used: pointsUsed,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '创建订单失败',
    })
  }
})

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { contact_name, contact_phone, address, appointment_time, price, remark } = req.body

    const db = await getDb()
    const existing = await db.get('SELECT * FROM orders WHERE id = ?', [id])

    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '订单不存在',
      })
      return
    }

    if (req.user!.role === 'customer' && existing.customer_id !== req.user!.id) {
      await db.close()
      res.status(403).json({
        success: false,
        error: '无权限修改此订单',
      })
      return
    }

    if (req.user!.role === 'worker') {
      await db.close()
      res.status(403).json({
        success: false,
        error: '家政人员无法修改订单信息',
      })
      return
    }

    await db.run(
      `UPDATE orders SET 
       contact_name = ?, contact_phone = ?, address = ?, appointment_time = ?, price = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        contact_name || existing.contact_name,
        contact_phone || existing.contact_phone,
        address || existing.address,
        appointment_time || existing.appointment_time,
        price || existing.price,
        remark !== undefined ? remark : existing.remark,
        id,
      ]
    )

    const order = await db.get(ORDER_SELECT_SQL + ' WHERE o.id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: order,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '更新订单失败',
    })
  }
})

router.put('/:id/assign', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { worker_id } = req.body

    if (!worker_id) {
      res.status(400).json({
        success: false,
        error: '请指定家政人员',
      })
      return
    }

    const db = await getDb()

    const existing = await db.get('SELECT * FROM orders WHERE id = ?', [id])
    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '订单不存在',
      })
      return
    }

    if (existing.is_package_order) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '套餐订单请使用子任务派单接口',
      })
      return
    }

    if (existing.status !== 'pending') {
      await db.close()
      res.status(400).json({
        success: false,
        error: '只有待派单状态的订单才能派单',
      })
      return
    }

    const worker = await db.get('SELECT id FROM workers WHERE id = ?', [worker_id])
    if (!worker) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '家政人员不存在',
      })
      return
    }

    await db.run(
      `UPDATE orders SET worker_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [worker_id, id]
    )

    const order = await db.get(ORDER_SELECT_SQL + ' WHERE o.id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: order,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '派单失败',
    })
  }
})

router.put('/:id/subtasks/:subtaskId/assign', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, subtaskId } = req.params
    const { worker_id } = req.body

    if (!worker_id) {
      res.status(400).json({
        success: false,
        error: '请指定家政人员',
      })
      return
    }

    const db = await getDb()

    const order = await db.get('SELECT * FROM orders WHERE id = ? AND is_package_order = 1', [id])
    if (!order) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '套餐订单不存在',
      })
      return
    }

    const subtask = await db.get('SELECT * FROM order_subtasks WHERE id = ? AND parent_order_id = ?', [subtaskId, id])
    if (!subtask) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '子任务不存在',
      })
      return
    }

    if (subtask.status !== 'pending') {
      await db.close()
      res.status(400).json({
        success: false,
        error: '只有待派单状态的子任务才能派单',
      })
      return
    }

    const worker = await db.get('SELECT id FROM workers WHERE id = ?', [worker_id])
    if (!worker) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '家政人员不存在',
      })
      return
    }

    await db.run(
      `UPDATE order_subtasks SET worker_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [worker_id, subtaskId]
    )

    const pendingSubtasks = await db.get(
      'SELECT COUNT(*) as count FROM order_subtasks WHERE parent_order_id = ? AND status = ?',
      [id, 'pending']
    )

    if (pendingSubtasks.count === 0) {
      await db.run(
        `UPDATE orders SET status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      )
    }

    const updatedOrder = await db.get(ORDER_SELECT_SQL + ' WHERE o.id = ?', [id])
    const subtasks = await db.all(`
      SELECT 
        os.*,
        s.name AS service_name,
        wu.name AS worker_name
      FROM order_subtasks os
      LEFT JOIN services s ON os.service_id = s.id
      LEFT JOIN workers w ON os.worker_id = w.id
      LEFT JOIN users wu ON w.user_id = wu.id
      WHERE os.parent_order_id = ?
      ORDER BY os.id ASC
    `, [id])

    await db.close()

    res.json({
      success: true,
      data: {
        ...updatedOrder,
        subtasks,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '子任务派单失败',
    })
  }
})

router.put('/:id/subtasks/:subtaskId/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, subtaskId } = req.params
    const { status } = req.body

    const validStatuses = ['pending', 'assigned', 'processing', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: '无效的子任务状态',
      })
      return
    }

    const db = await getDb()

    const order = await db.get('SELECT * FROM orders WHERE id = ? AND is_package_order = 1', [id])
    if (!order) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '套餐订单不存在',
      })
      return
    }

    const subtask = await db.get('SELECT * FROM order_subtasks WHERE id = ? AND parent_order_id = ?', [subtaskId, id])
    if (!subtask) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '子任务不存在',
      })
      return
    }

    if (req.user!.role === 'customer' && order.customer_id !== req.user!.id) {
      await db.close()
      res.status(403).json({
        success: false,
        error: '无权限修改此子任务',
      })
      return
    }

    if (req.user!.role === 'worker') {
      const worker = await db.get('SELECT id FROM workers WHERE user_id = ?', [req.user!.id])
      if (!worker || subtask.worker_id !== worker.id) {
        await db.close()
        res.status(403).json({
          success: false,
          error: '无权限修改此子任务',
        })
        return
      }
    }

    await db.run(
      `UPDATE order_subtasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, subtaskId]
    )

    const allSubtasks = await db.all('SELECT status FROM order_subtasks WHERE parent_order_id = ?', [id])
    const allCompleted = allSubtasks.every((s: any) => s.status === 'completed')
    const anyProcessing = allSubtasks.some((s: any) => s.status === 'processing')

    let orderStatus = order.status
    if (allCompleted) {
      orderStatus = 'completed'
    } else if (anyProcessing) {
      orderStatus = 'processing'
    }

    if (orderStatus !== order.status) {
      await db.run(
        `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [orderStatus, id]
      )

      if (orderStatus === 'completed' && order.status !== 'completed') {
        const member = await db.get('SELECT * FROM members WHERE user_id = ?', [order.customer_id])
        if (member) {
          const pointsEarned = calculatePointsEarned(order.price, member.level)
          const newTotalSpent = member.total_spent + order.price
          const newTotalOrders = member.total_orders + 1
          const newLevelConfig = calculateMemberLevel(newTotalSpent)
          const newPoints = member.points + pointsEarned

          await db.run(
            `UPDATE members SET 
             points = ?, total_spent = ?, total_orders = ?, level = ?, discount = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newPoints, newTotalSpent, newTotalOrders, newLevelConfig.level, newLevelConfig.discount, member.id]
          )

          await db.run(
            `INSERT INTO points_records (member_id, user_id, type, points, balance, order_id, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [member.id, order.customer_id, 'earn', pointsEarned, newPoints, order.id, `订单完成，消费¥${order.price}，获得${pointsEarned}积分`]
          )
        }

        if (subtask.worker_id) {
          const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          await db.run(
            `INSERT OR IGNORE INTO follow_ups (order_id, customer_id, worker_id, status, expire_at)
             VALUES (?, ?, ?, 'pending', ?)`,
            [order.id, order.customer_id, subtask.worker_id, expireAt]
          )
        }
      }
    }

    const updatedOrder = await db.get(ORDER_SELECT_SQL + ' WHERE o.id = ?', [id])
    const subtasks = await db.all(`
      SELECT 
        os.*,
        s.name AS service_name,
        wu.name AS worker_name
      FROM order_subtasks os
      LEFT JOIN services s ON os.service_id = s.id
      LEFT JOIN workers w ON os.worker_id = w.id
      LEFT JOIN users wu ON w.user_id = wu.id
      WHERE os.parent_order_id = ?
      ORDER BY os.id ASC
    `, [id])

    await db.close()

    res.json({
      success: true,
      data: {
        ...updatedOrder,
        subtasks,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '更新子任务状态失败',
    })
  }
})

router.put('/:id/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['pending', 'assigned', 'processing', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: '无效的订单状态',
      })
      return
    }

    const db = await getDb()
    const existing = await db.get('SELECT * FROM orders WHERE id = ?', [id])

    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '订单不存在',
      })
      return
    }

    if (req.user!.role === 'customer' && existing.customer_id !== req.user!.id) {
      await db.close()
      res.status(403).json({
        success: false,
        error: '无权限修改此订单',
      })
      return
    }

    if (req.user!.role === 'worker') {
      const worker = await db.get('SELECT id FROM workers WHERE user_id = ?', [req.user!.id])
      if (!worker || existing.worker_id !== worker.id) {
        await db.close()
        res.status(403).json({
          success: false,
          error: '无权限修改此订单',
        })
        return
      }
    }

    if (status === 'cancelled' && req.user!.role !== 'admin' && existing.customer_id !== req.user!.id) {
      await db.close()
      res.status(403).json({
        success: false,
        error: '只有管理员或客户本人可以取消订单',
      })
      return
    }

    await db.run(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    )

    if (status === 'completed' && existing.status !== 'completed') {
      const member = await db.get('SELECT * FROM members WHERE user_id = ?', [existing.customer_id])
      if (member) {
        const pointsEarned = calculatePointsEarned(existing.price, member.level)
        const newTotalSpent = member.total_spent + existing.price
        const newTotalOrders = member.total_orders + 1
        const newLevelConfig = calculateMemberLevel(newTotalSpent)
        const newPoints = member.points + pointsEarned

        await db.run(
          `UPDATE members SET 
           points = ?, total_spent = ?, total_orders = ?, level = ?, discount = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newPoints, newTotalSpent, newTotalOrders, newLevelConfig.level, newLevelConfig.discount, member.id]
        )

        await db.run(
          `INSERT INTO points_records (member_id, user_id, type, points, balance, order_id, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [member.id, existing.customer_id, 'earn', pointsEarned, newPoints, existing.id, `订单完成，消费¥${existing.price}，获得${pointsEarned}积分`]
        )
      }

      if (existing.worker_id) {
        const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await db.run(
          `INSERT OR IGNORE INTO follow_ups (order_id, customer_id, worker_id, status, expire_at)
           VALUES (?, ?, ?, 'pending', ?)`,
          [existing.id, existing.customer_id, existing.worker_id, expireAt]
        )
      }
    }

    const order = await db.get(ORDER_SELECT_SQL + ' WHERE o.id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: order,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '更新订单状态失败',
    })
  }
})

export default router
