import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'
import { open } from 'sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '..', 'data', 'home_service.db')

export async function getDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  })
}

export async function initDb() {
  const db = await getDb()

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT '次',
      duration INTEGER NOT NULL DEFAULT 60,
      image TEXT,
      status INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      skills TEXT,
      experience INTEGER DEFAULT 0,
      rating REAL DEFAULT 5.0,
      order_count INTEGER DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      worker_id INTEGER,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      address TEXT NOT NULL,
      appointment_time DATETIME NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      worker_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      level TEXT NOT NULL DEFAULT '普通',
      points INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS points_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      order_id INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      worker_id INTEGER NOT NULL,
      attitude_rating INTEGER,
      quality_rating INTEGER,
      punctuality_rating INTEGER,
      feedback TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      expire_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      original_price REAL NOT NULL,
      image TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS package_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      UNIQUE(package_id, service_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_order_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      worker_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_order_id) REFERENCES orders(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    )
  `)

  async function columnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const columns = await db.all(`PRAGMA table_info(${tableName})`)
      return columns.some((col: any) => col.name === columnName)
    } catch {
      return false
    }
  }

  if (!await columnExists('orders', 'package_id')) {
    await db.exec(`ALTER TABLE orders ADD COLUMN package_id INTEGER REFERENCES packages(id)`)
  }
  if (!await columnExists('orders', 'is_package_order')) {
    await db.exec(`ALTER TABLE orders ADD COLUMN is_package_order INTEGER NOT NULL DEFAULT 0`)
  }
  if (!await columnExists('orders', 'subtotal_price')) {
    await db.exec(`ALTER TABLE orders ADD COLUMN subtotal_price REAL`)
  }

  const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'])
  if (adminCount.count === 0) {
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await db.run(
      'INSERT INTO users (username, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', hashedPassword, '管理员', '13800000000', 'admin']
    )
  }

  const serviceCount = await db.get('SELECT COUNT(*) as count FROM services')
  if (serviceCount.count === 0) {
    const services = [
      { name: '日常保洁', description: '家庭日常清洁，包括地面、桌面、厨房、卫生间等区域的清洁', price: 150, unit: '次', duration: 120, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=house%20cleaning%20service%20professional%20cleaner&image_size=square_hd' },
      { name: '深度保洁', description: '全方位深度清洁，包括家电表面、窗户、死角清洁等', price: 300, unit: '次', duration: 240, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=deep%20cleaning%20service%20professional&image_size=square_hd' },
      { name: '家电清洗', description: '空调、洗衣机、冰箱等家电的专业清洗服务', price: 120, unit: '台', duration: 60, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=home%20appliance%20cleaning%20service&image_size=square_hd' },
      { name: '保姆服务', description: '住家或钟点工保姆服务，照顾老人小孩、做饭等', price: 50, unit: '小时', duration: 480, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=nanny%20service%20professional%20caregiver&image_size=square_hd' },
      { name: '月嫂服务', description: '专业月嫂服务，照顾产妇和新生儿', price: 800, unit: '天', duration: 1440, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=maternity%20nurse%20baby%20care&image_size=square_hd' },
      { name: '维修服务', description: '水电维修、家具安装维修等家庭维修服务', price: 80, unit: '次', duration: 60, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=home%20repair%20service%20handyman&image_size=square_hd' },
      { name: '擦玻璃', description: '专业擦玻璃服务，包括室内外玻璃清洁、窗框清理', price: 80, unit: '次', duration: 60, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=window%20cleaning%20service%20professional&image_size=square_hd' },
      { name: '厨房清洁', description: '厨房深度清洁，包括灶台、油烟机、橱柜表面等', price: 120, unit: '次', duration: 90, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=kitchen%20cleaning%20service%20professional&image_size=square_hd' },
      { name: '卫生间清洁', description: '卫生间深度清洁，包括马桶、洗手台、地面消毒等', price: 100, unit: '次', duration: 60, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=bathroom%20cleaning%20service%20professional&image_size=square_hd' },
      { name: '地板打蜡', description: '实木地板专业清洁打蜡保养服务', price: 150, unit: '次', duration: 90, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=floor%20waxing%20service%20professional&image_size=square_hd' },
      { name: '沙发清洗', description: '布艺沙发、真皮沙发专业清洁保养', price: 180, unit: '次', duration: 90, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sofa%20cleaning%20service%20professional&image_size=square_hd' },
      { name: '窗帘清洗', description: '窗帘专业拆卸清洗安装服务', price: 200, unit: '次', duration: 120, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=curtain%20cleaning%20service%20professional&image_size=square_hd' },
    ]
    for (const s of services) {
      await db.run(
        'INSERT INTO services (name, description, price, unit, duration, image) VALUES (?, ?, ?, ?, ?, ?)',
        [s.name, s.description, s.price, s.unit, s.duration, s.image]
      )
    }
  }

  const packageCount = await db.get('SELECT COUNT(*) as count FROM packages')
  if (packageCount.count === 0) {
    const services = await db.all('SELECT id, name, price FROM services')
    const serviceMap: Record<string, number> = {}
    services.forEach((s: any) => { serviceMap[s.name] = s.id })

    const packages = [
      {
        name: '深度保洁套餐',
        description: '超值深度保洁套餐，包含擦玻璃+厨房清洁+卫生间清洁，一站式搞定全屋清洁',
        price: 268,
        original_price: 300,
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=deep%20cleaning%20package%20combo%20service&image_size=square_hd',
        services: [
          { service_id: serviceMap['擦玻璃'], quantity: 1 },
          { service_id: serviceMap['厨房清洁'], quantity: 1 },
          { service_id: serviceMap['卫生间清洁'], quantity: 1 },
        ],
      },
      {
        name: '新居开荒套餐',
        description: '新房入住前全面清洁，包含深度保洁+地板打蜡+擦玻璃，让您安心入住',
        price: 498,
        original_price: 530,
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=new%20house%20cleaning%20package%20service&image_size=square_hd',
        services: [
          { service_id: serviceMap['深度保洁'], quantity: 1 },
          { service_id: serviceMap['地板打蜡'], quantity: 1 },
          { service_id: serviceMap['擦玻璃'], quantity: 1 },
        ],
      },
      {
        name: '焕新家套餐',
        description: '全屋焕新套餐，包含沙发清洗+窗帘清洗+厨房清洁，让家焕然一新',
        price: 458,
        original_price: 500,
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=home%20refresh%20cleaning%20package%20service&image_size=square_hd',
        services: [
          { service_id: serviceMap['沙发清洗'], quantity: 1 },
          { service_id: serviceMap['窗帘清洗'], quantity: 1 },
          { service_id: serviceMap['厨房清洁'], quantity: 1 },
        ],
      },
    ]

    for (const pkg of packages) {
      const result = await db.run(
        'INSERT INTO packages (name, description, price, original_price, image) VALUES (?, ?, ?, ?, ?)',
        [pkg.name, pkg.description, pkg.price, pkg.original_price, pkg.image]
      )
      for (const ps of pkg.services) {
        await db.run(
          'INSERT INTO package_services (package_id, service_id, quantity) VALUES (?, ?, ?)',
          [result.lastID, ps.service_id, ps.quantity]
        )
      }
    }
  }

  await db.close()
  console.log('Database initialized successfully')
}

export const MEMBER_LEVELS = [
  { level: '普通', minSpent: 0, maxSpent: 1000, discount: 1.0, pointsRate: 1 },
  { level: '银卡', minSpent: 1000, maxSpent: 5000, discount: 0.95, pointsRate: 1.2 },
  { level: '金卡', minSpent: 5000, maxSpent: 20000, discount: 0.9, pointsRate: 1.5 },
  { level: '钻石', minSpent: 20000, maxSpent: Infinity, discount: 0.85, pointsRate: 2 },
]

export const POINTS_PER_YUAN = 1
export const POINTS_DEDUCTION_RATE = 100

export function calculateMemberLevel(totalSpent: number) {
  for (let i = MEMBER_LEVELS.length - 1; i >= 0; i--) {
    if (totalSpent >= MEMBER_LEVELS[i].minSpent) {
      return MEMBER_LEVELS[i]
    }
  }
  return MEMBER_LEVELS[0]
}

export function calculatePointsEarned(amount: number, level: string) {
  const levelConfig = MEMBER_LEVELS.find(l => l.level === level) || MEMBER_LEVELS[0]
  return Math.floor(amount * POINTS_PER_YUAN * levelConfig.pointsRate)
}

export function calculatePointsDeduction(points: number) {
  return Math.floor(points / POINTS_DEDUCTION_RATE)
}
