import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const services = await db.all('SELECT * FROM services ORDER BY id ASC')
    await db.close()

    res.json({
      success: true,
      data: services.map(s => ({
        ...s,
        unit: s.unit || '次',
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取服务列表失败',
    })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()
    const service = await db.get('SELECT * FROM services WHERE id = ?', [id])
    await db.close()

    if (!service) {
      res.status(404).json({
        success: false,
        error: '服务不存在',
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...service,
        unit: service.unit || '次',
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取服务详情失败',
    })
  }
})

router.post('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, price, category, duration, image, status } = req.body

    if (!name || price === undefined || price === null) {
      res.status(400).json({
        success: false,
        error: '服务名称和价格不能为空',
      })
      return
    }

    const db = await getDb()
    const result = await db.run(
      'INSERT INTO services (name, description, price, category, duration, image, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description || '', price, category || '家政服务', duration || 60, image || '', status ?? 'active']
    )

    const service = await db.get('SELECT * FROM services WHERE id = ?', [result.lastID])
    await db.close()

    res.json({
      success: true,
      data: {
        ...service,
        unit: '次',
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '创建服务失败',
    })
  }
})

router.put('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, description, price, category, duration, image, status } = req.body

    const db = await getDb()
    const existing = await db.get('SELECT * FROM services WHERE id = ?', [id])

    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '服务不存在',
      })
      return
    }

    await db.run(
      'UPDATE services SET name = ?, description = ?, price = ?, category = ?, duration = ?, image = ?, status = ? WHERE id = ?',
      [
        name !== undefined ? name : existing.name,
        description !== undefined ? description : existing.description,
        price !== undefined ? price : existing.price,
        category !== undefined ? category : existing.category,
        duration !== undefined ? duration : existing.duration,
        image !== undefined ? image : existing.image,
        status !== undefined ? status : existing.status,
        id,
      ]
    )

    const service = await db.get('SELECT * FROM services WHERE id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: {
        ...service,
        unit: service.unit || '次',
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '更新服务失败',
    })
  }
})

router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()
    const existing = await db.get('SELECT * FROM services WHERE id = ?', [id])

    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '服务不存在',
      })
      return
    }

    await db.run('DELETE FROM services WHERE id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: { message: '删除成功' },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '删除服务失败',
    })
  }
})

export default router
