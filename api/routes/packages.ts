import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const PACKAGE_SELECT_SQL = `
  SELECT 
    p.*,
    p.price AS package_price,
    p.original_price AS package_original_price
  FROM packages p
`

async function getPackageWithServices(db: any, id: number) {
  const pkg = await db.get(PACKAGE_SELECT_SQL + ' WHERE p.id = ?', [id])
  if (!pkg) return null

  const services = await db.all(`
    SELECT 
      ps.id as package_service_id,
      ps.package_id,
      ps.service_id,
      ps.quantity,
      s.name,
      s.description,
      s.price,
      s.unit,
      s.duration,
      s.image
    FROM package_services ps
    LEFT JOIN services s ON ps.service_id = s.id
    WHERE ps.package_id = ?
    ORDER BY ps.id ASC
  `, [id])

  const originalPrice = services.reduce((sum: number, s: any) => sum + s.price * s.quantity, 0)

  return {
    ...pkg,
    services,
    savings: Math.round((originalPrice - pkg.price) * 100) / 100,
    original_price_calculated: originalPrice,
  }
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const packages = await db.all(PACKAGE_SELECT_SQL + ' ORDER BY p.id ASC')

    const result = []
    for (const pkg of packages) {
      const services = await db.all(`
        SELECT 
          ps.id as package_service_id,
          ps.package_id,
          ps.service_id,
          ps.quantity,
          s.name,
          s.description,
          s.price,
          s.unit,
          s.duration,
          s.image
        FROM package_services ps
        LEFT JOIN services s ON ps.service_id = s.id
        WHERE ps.package_id = ?
        ORDER BY ps.id ASC
      `, [pkg.id])

      const originalPrice = services.reduce((sum: number, s: any) => sum + s.price * s.quantity, 0)

      result.push({
        ...pkg,
        services,
        savings: Math.round((originalPrice - pkg.price) * 100) / 100,
        original_price_calculated: originalPrice,
      })
    }

    await db.close()

    res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取套餐列表失败',
    })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()

    const pkg = await getPackageWithServices(db, Number(id))
    await db.close()

    if (!pkg) {
      res.status(404).json({
        success: false,
        error: '套餐不存在',
      })
      return
    }

    res.json({
      success: true,
      data: pkg,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '获取套餐详情失败',
    })
  }
})

router.post('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, price, image, status, services } = req.body

    if (!name || price === undefined || price === null || !services || !Array.isArray(services) || services.length === 0) {
      res.status(400).json({
        success: false,
        error: '套餐名称、价格和包含的服务不能为空',
      })
      return
    }

    const db = await getDb()

    let originalPrice = 0
    for (const ps of services) {
      const service = await db.get('SELECT price FROM services WHERE id = ?', [ps.service_id])
      if (!service) {
        await db.close()
        res.status(400).json({
          success: false,
          error: `服务ID ${ps.service_id} 不存在`,
        })
        return
      }
      originalPrice += service.price * (ps.quantity || 1)
    }

    if (price >= originalPrice) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '套餐价格必须低于单项服务累加价格',
      })
      return
    }

    const result = await db.run(
      'INSERT INTO packages (name, description, price, original_price, image, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, originalPrice, image || '', status ?? 'active']
    )

    for (const ps of services) {
      await db.run(
        'INSERT INTO package_services (package_id, service_id, quantity) VALUES (?, ?, ?)',
        [result.lastID, ps.service_id, ps.quantity || 1]
      )
    }

    const pkg = await getPackageWithServices(db, result.lastID)
    await db.close()

    res.json({
      success: true,
      data: pkg,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '创建套餐失败',
    })
  }
})

router.put('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, description, price, image, status, services } = req.body

    const db = await getDb()
    const existing = await db.get('SELECT * FROM packages WHERE id = ?', [id])

    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '套餐不存在',
      })
      return
    }

    let originalPrice = existing.original_price
    if (services && Array.isArray(services) && services.length > 0) {
      originalPrice = 0
      for (const ps of services) {
        const service = await db.get('SELECT price FROM services WHERE id = ?', [ps.service_id])
        if (!service) {
          await db.close()
          res.status(400).json({
            success: false,
            error: `服务ID ${ps.service_id} 不存在`,
          })
          return
        }
        originalPrice += service.price * (ps.quantity || 1)
      }

      const finalPrice = price !== undefined ? price : existing.price
      if (finalPrice >= originalPrice) {
        await db.close()
        res.status(400).json({
          success: false,
          error: '套餐价格必须低于单项服务累加价格',
        })
        return
      }
    } else if (price !== undefined && price >= originalPrice) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '套餐价格必须低于单项服务累加价格',
      })
      return
    }

    await db.run(
      `UPDATE packages SET 
       name = ?, description = ?, price = ?, original_price = ?, image = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name !== undefined ? name : existing.name,
        description !== undefined ? description : existing.description,
        price !== undefined ? price : existing.price,
        originalPrice,
        image !== undefined ? image : existing.image,
        status !== undefined ? status : existing.status,
        id,
      ]
    )

    if (services && Array.isArray(services)) {
      await db.run('DELETE FROM package_services WHERE package_id = ?', [id])
      for (const ps of services) {
        await db.run(
          'INSERT INTO package_services (package_id, service_id, quantity) VALUES (?, ?, ?)',
          [id, ps.service_id, ps.quantity || 1]
        )
      }
    }

    const pkg = await getPackageWithServices(db, Number(id))
    await db.close()

    res.json({
      success: true,
      data: pkg,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '更新套餐失败',
    })
  }
})

router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const db = await getDb()
    const existing = await db.get('SELECT * FROM packages WHERE id = ?', [id])

    if (!existing) {
      await db.close()
      res.status(404).json({
        success: false,
        error: '套餐不存在',
      })
      return
    }

    const activeOrders = await db.get(
      'SELECT COUNT(*) as count FROM orders WHERE package_id = ? AND status NOT IN (?, ?)',
      [id, 'completed', 'cancelled']
    )
    if (activeOrders.count > 0) {
      await db.close()
      res.status(400).json({
        success: false,
        error: '该套餐有关联的进行中订单，无法删除',
      })
      return
    }

    await db.run('DELETE FROM package_services WHERE package_id = ?', [id])
    await db.run('DELETE FROM packages WHERE id = ?', [id])
    await db.close()

    res.json({
      success: true,
      data: { message: '删除成功' },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      error: '删除套餐失败',
    })
  }
})

export default router
