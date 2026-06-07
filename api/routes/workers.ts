import { Router, type Response } from 'express'
import { getDb } from '../db.js'
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', async (req, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const workers = await db.all(`
      SELECT w.id, w.user_id, w.skills, w.experience, w.rating, w.order_count, w.status,
             u.name, u.phone
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      ORDER BY w.id DESC
    `)
    await db.close()

    res.json({
      success: true,
      data: workers.map(w => ({
        ...w,
        skills: w.skills ? JSON.parse(w.skills) : [],
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取家政人员列表失败',
    })
  }
})

router.get('/:id', async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()
    const worker = await db.get(`
      SELECT w.id, w.user_id, w.skills, w.experience, w.rating, w.order_count, w.status,
             u.name, u.phone
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `, [id])
    await db.close()

    if (!worker) {
      res.status(404).json({
        success: false,
        error: '家政人员不存在',
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...worker,
        skills: worker.skills ? JSON.parse(worker.skills) : [],
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取家政人员详情失败',
    })
  }
})

router.post('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id, skills, experience } = req.body

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: '用户ID不能为空',
      })
      return
    }

    const db = await getDb()

    const existingUser = await db.get('SELECT id, role FROM users WHERE id = ?', [user_id])
    if (!existingUser) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '用户不存在',
      })
      return
    }

    const existingWorker = await db.get('SELECT id FROM workers WHERE user_id = ?', [user_id])
    if (existingWorker) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '该用户已是家政人员',
      })
      return
    }

    const result = await db.run(
      'INSERT INTO workers (user_id, skills, experience) VALUES (?, ?, ?)',
      [user_id, JSON.stringify(skills || []), experience || 0]
    )

    const worker = await db.get(`
      SELECT w.id, w.user_id, w.skills, w.experience, w.rating, w.order_count, w.status,
             u.name, u.phone
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `, [result.lastID])
    await db.close()

    res.json({
      success: true,
      data: {
        ...worker,
        skills: worker.skills ? JSON.parse(worker.skills) : [],
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '创建家政人员失败',
    })
  }
})

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { skills, experience, status } = req.body

    const db = await getDb()
    const worker = await db.get('SELECT user_id FROM workers WHERE id = ?', [id])

    if (!worker) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '家政人员不存在',
      })
      return
    }

    const isAdmin = req.user?.role === 'admin'
    const isSelf = req.user?.id === worker.user_id

    if (!isAdmin && !isSelf) {
      await db.close()
      res.status(403).json({
        success: false,
        error: '权限不足，仅管理员或本人可修改',
      })
      return
    }

    const updates: string[] = []
    const values: any[] = []

    if (skills !== undefined) {
      updates.push('skills = ?')
      values.push(JSON.stringify(skills))
    }
    if (experience !== undefined) {
      updates.push('experience = ?')
      values.push(experience)
    }
    if (status !== undefined) {
      if (!isAdmin) {
        await db.close()
        res.status(403).json({
          success: false,
          error: '仅管理员可修改状态',
        })
        return
      }
      updates.push('status = ?')
      values.push(status)
    }

    if (updates.length === 0) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '没有需要更新的字段',
      })
      return
    }

    values.push(id)

    await db.run(
      `UPDATE workers SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const updatedWorker = await db.get(`
      SELECT w.id, w.user_id, w.skills, w.experience, w.rating, w.order_count, w.status,
             u.name, u.phone
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = ?
    `, [id])
    await db.close()

    res.json({
      success: true,
      data: {
        ...updatedWorker,
        skills: updatedWorker.skills ? JSON.parse(updatedWorker.skills) : [],
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '更新家政人员失败',
    })
  }
})

router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const db = await getDb()
    const worker = await db.get('SELECT id FROM workers WHERE id = ?', [id])

    if (!worker) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '家政人员不存在',
      })
      return
    }

    await db.run('DELETE FROM workers WHERE id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: { message: '删除成功' },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '删除家政人员失败',
    })
  }
})

export default router
