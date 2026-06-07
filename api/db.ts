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
    ]
    for (const s of services) {
      await db.run(
        'INSERT INTO services (name, description, price, unit, duration, image) VALUES (?, ?, ?, ?, ?, ?)',
        [s.name, s.description, s.price, s.unit, s.duration, s.image]
      )
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
