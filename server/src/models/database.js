const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor(dbPath = './data/ayush-terminology.db') {
    this.dbPath = path.resolve(dbPath);
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database:', this.dbPath);
          resolve();
        }
      });
    });
  }

  async initialize() {
    await this.connect();
    await this.createTables();
    await this.seedInitialData();
  }

  async createTables() {
    const tables = [
      // NAMASTE Codes table
      `CREATE TABLE IF NOT EXISTS namaste_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        display TEXT NOT NULL,
        system_name TEXT NOT NULL DEFAULT 'AYUSH',
        specialty TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // ICD-11 Codes table
      `CREATE TABLE IF NOT EXISTS icd11_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        display TEXT NOT NULL,
        system_uri TEXT DEFAULT 'http://id.who.int/icd/release/11/mms',
        chapter TEXT,
        block TEXT,
        category TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Concept Mappings table
      `CREATE TABLE IF NOT EXISTS concept_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        namaste_code TEXT NOT NULL,
        icd11_code TEXT NOT NULL,
        equivalence TEXT DEFAULT 'equivalent',
        confidence REAL DEFAULT 1.0,
        mapping_type TEXT DEFAULT 'manual',
        similarity_score REAL DEFAULT 0.0,
        mapping_details TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (namaste_code) REFERENCES namaste_codes(code),
        FOREIGN KEY (icd11_code) REFERENCES icd11_codes(code),
        UNIQUE(namaste_code, icd11_code)
      )`,

      // FHIR Resources table (for caching)
      `CREATE TABLE IF NOT EXISTS fhir_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id TEXT UNIQUE NOT NULL,
        resource_type TEXT NOT NULL,
        version TEXT DEFAULT '1',
        content TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Audit Events table
      `CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        user_id TEXT,
        source_ip TEXT,
        user_agent TEXT,
        resource_type TEXT,
        resource_id TEXT,
        request_method TEXT,
        request_url TEXT,
        response_status INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_namaste_code ON namaste_codes(code)',
      'CREATE INDEX IF NOT EXISTS idx_namaste_specialty ON namaste_codes(specialty)',
      'CREATE INDEX IF NOT EXISTS idx_icd11_code ON icd11_codes(code)',
      'CREATE INDEX IF NOT EXISTS idx_mapping_namaste ON concept_mappings(namaste_code)',
      'CREATE INDEX IF NOT EXISTS idx_mapping_icd11 ON concept_mappings(icd11_code)',
      'CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events(user_id)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    console.log('Database tables and indexes created successfully');
  }

  async seedInitialData() {
    // Check if data already exists
    const count = await this.get('SELECT COUNT(*) as count FROM namaste_codes');
    if (count.count > 0) {
      console.log('Sample data already exists, skipping seed');
      return;
    }

    // Sample NAMASTE codes
    const namastelCodes = [
      ['AYU001', 'Vata Dosha Imbalance', 'Ayurveda', 'General Medicine', 'Constitutional imbalance of Vata dosha'],
      ['AYU002', 'Pitta Dosha Imbalance', 'Ayurveda', 'General Medicine', 'Constitutional imbalance of Pitta dosha'],
      ['AYU003', 'Kapha Dosha Imbalance', 'Ayurveda', 'General Medicine', 'Constitutional imbalance of Kapha dosha'],
      ['SID001', 'Vayu Kutram', 'Siddha', 'General Medicine', 'Air humor imbalance in Siddha system'],
      ['SID002', 'Azhal Kutram', 'Siddha', 'General Medicine', 'Fire humor imbalance in Siddha system'],
      ['UNA001', 'Baruda (Cold) Mizaj', 'Unani', 'General Medicine', 'Cold temperament imbalance'],
      ['UNA002', 'Haar (Hot) Mizaj', 'Unani', 'General Medicine', 'Hot temperament imbalance']
    ];

    // Sample ICD-11 codes
    const icd11Codes = [
      ['MG30.0Z', 'Constitutional factors affecting health status', 'http://id.who.int/icd/release/11/mms', 'Chapter 24', 'MG30-MG3Z', 'MG30.0Z'],
      ['MG30.1Z', 'Lifestyle factors affecting health status', 'http://id.who.int/icd/release/11/mms', 'Chapter 24', 'MG30-MG3Z', 'MG30.1Z'],
      ['MG30.2Z', 'Life management factors affecting health status', 'http://id.who.int/icd/release/11/mms', 'Chapter 24', 'MG30-MG3Z', 'MG30.2Z']
    ];

    // Sample mappings
    const mappings = [
      ['AYU001', 'MG30.0Z', 'equivalent', 0.8],
      ['AYU002', 'MG30.0Z', 'equivalent', 0.8],
      ['AYU003', 'MG30.0Z', 'equivalent', 0.8],
      ['SID001', 'MG30.0Z', 'equivalent', 0.75],
      ['SID002', 'MG30.0Z', 'equivalent', 0.75],
      ['UNA001', 'MG30.0Z', 'equivalent', 0.7],
      ['UNA002', 'MG30.0Z', 'equivalent', 0.7]
    ];

    // Insert NAMASTE codes
    const insertNamaste = `INSERT INTO namaste_codes (code, display, system_name, specialty, description) VALUES (?, ?, ?, ?, ?)`;
    for (const code of namastelCodes) {
      await this.run(insertNamaste, code);
    }

    // Insert ICD-11 codes
    const insertICD11 = `INSERT INTO icd11_codes (code, display, system_uri, chapter, block, category) VALUES (?, ?, ?, ?, ?, ?)`;
    for (const code of icd11Codes) {
      await this.run(insertICD11, code);
    }

    // Insert mappings
    const insertMapping = `INSERT INTO concept_mappings (namaste_code, icd11_code, equivalence, confidence) VALUES (?, ?, ?, ?)`;
    for (const mapping of mappings) {
      await this.run(insertMapping, mapping);
    }

    console.log('Sample data seeded successfully');
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database error:', err.message);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Database error:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database error:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;