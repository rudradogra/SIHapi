#!/usr/bin/env node

/**
 * Database initialization script
 * Run this script to set up the SQLite database with tables and sample data
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const Database = require('../src/models/database');

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing AYUSH-ICD11 Terminology Database...');
    
    // Ensure data directory exists
    const dataDir = path.dirname(process.env.DB_PATH || './data/ayush-terminology.db');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${dataDir}`);
    }

    // Initialize database
    const db = new Database(process.env.DB_PATH);
    await db.initialize();
    
    console.log('✅ Database initialized successfully!');
    console.log('📊 Sample data includes:');
    console.log('   - NAMASTE codes (Ayurveda, Siddha, Unani)');
    console.log('   - ICD-11 codes');
    console.log('   - Concept mappings');
    console.log('');
    console.log('🎯 You can now start the server with: npm start');
    
    await db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;