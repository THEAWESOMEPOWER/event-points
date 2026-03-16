const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'points.db');

let db;

async function init() {
  if (!db) {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // TABLE 1: User points table
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        points INTEGER DEFAULT 0
      )
    `);

    // TABLE 2: Robbery attempts table
    await db.run(`
      CREATE TABLE IF NOT EXISTS rob_attempts (
        user_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Optional: index for faster cooldown checks
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_rob_attempts_user
      ON rob_attempts (user_id)
    `);

    // TABLE 3: Shop items
    await db.run(`
      CREATE TABLE IF NOT EXISTS shop_items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        cost INTEGER NOT NULL,
        purchase_limit INTEGER,
        role_id TEXT
      )
    `);

    // Add stock column if it doesn't exist
    try {
      await db.run(`ALTER TABLE shop_items ADD COLUMN stock INTEGER`);
    } catch (err) {
      if (!err.message.includes('duplicate column name')) throw err;
    }

    // TABLE 4: User backpack
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_backpack (
        user_id TEXT NOT NULL,
        item_id INTEGER NOT NULL,
        item_name TEXT,
        purchased_at INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        PRIMARY KEY(user_id, item_id)
      )
    `);

    //TABLEE 5: VERIFICATION OF ROBLOX USERNAMES
     await db.run(`
    CREATE TABLE IF NOT EXISTS verifications (
      discord_id TEXT PRIMARY KEY,
      roblox_id TEXT NOT NULL,
      roblox_username TEXT NOT NULL
     )
    `);

        // Fix for existing databases: add original_nickname if missing
    try {
      await db.run(`ALTER TABLE verifications ADD COLUMN original_nickname TEXT`);
    } catch (err) {
      if (!err.message.includes('duplicate column name')) throw err;
    }

    // Fix for existing databases: add item_name if missing
    try {
      await db.run(`ALTER TABLE user_backpack ADD COLUMN item_name TEXT`);
    } catch (err) {
      if (!err.message.includes('duplicate column name')) throw err;
    }
  }

  return db;
}

module.exports = {
  init,

  get: async (sql, params) => {
    if (!db) await init();
    return db.get(sql, params);
  },

  run: async (sql, params) => {
    if (!db) await init();
    return db.run(sql, params);
  },

  all: async (sql, params) => {
    if (!db) await init();
    return db.all(sql, params);
  }
};
