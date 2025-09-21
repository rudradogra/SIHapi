const Database = require('./src/models/database');

async function migrateDatabaseSchema() {
  console.log('🔄 Migrating database schema...');
  
  const db = new Database('./data/ayush-terminology.db');
  await db.connect();
  
  try {
    // Add similarity_score column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.db.run(`ALTER TABLE concept_mappings ADD COLUMN similarity_score REAL DEFAULT 0.0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          console.log('✅ Added similarity_score column');
          resolve();
        }
      });
    });
    
    // Add mapping_details column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.db.run(`ALTER TABLE concept_mappings ADD COLUMN mapping_details TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          console.log('✅ Added mapping_details column');
          resolve();
        }
      });
    });
    
    console.log('✅ Database schema migration completed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    db.close();
  }
}

migrateDatabaseSchema();