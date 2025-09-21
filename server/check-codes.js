require('dotenv').config();
const Database = require('./src/models/database');
const AyurvedaCodesParser = require('./src/utils/ayurvedaCodesParser');
const path = require('path');

async function checkAvailableCodes() {
  console.log('📋 Checking Available Ayurveda Codes\n');
  
  try {
    // Get codes from Excel file
    console.log('=== CODES FROM EXCEL FILE ===');
    const excelFilePath = path.join(__dirname, '..', 'AyurvedaMorbidityCodes.xls');
    const parser = new AyurvedaCodesParser(excelFilePath);
    const ayurvedaCodes = parser.parseExcelFile();
    
    console.log(`Total codes in Excel: ${ayurvedaCodes.length}\n`);
    ayurvedaCodes.forEach((code, index) => {
      console.log(`${index + 1}. Code: ${code.code}`);
      console.log(`   NAMC Term: ${code.namc_term}`);
      console.log(`   English: ${code.name_english}`);
      console.log(`   Display: ${code.display}`);
      console.log('');
    });
    
    // Check what's in the database mappings
    console.log('=== CODES WITH MAPPINGS IN DATABASE ===');
    const db = new Database('./data/ayush-terminology.db');
    await db.connect();
    
    const mappingsQuery = `
      SELECT DISTINCT namaste_code 
      FROM concept_mappings 
      ORDER BY namaste_code
    `;
    
    const mappedCodes = await new Promise((resolve, reject) => {
      db.db.all(mappingsQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Total codes with mappings: ${mappedCodes.length}\n`);
    mappedCodes.forEach((row, index) => {
      console.log(`${index + 1}. ${row.namaste_code}`);
    });
    
    // Check specifically for SR10
    console.log('\n=== CHECKING FOR SR10 SPECIFICALLY ===');
    const sr10Query = `
      SELECT 
        cm.*,
        ic.display as icd11_display,
        ic.description as icd11_description
      FROM concept_mappings cm
      LEFT JOIN icd11_codes ic ON cm.icd11_code = ic.code
      WHERE cm.namaste_code = 'SR10'
    `;
    
    const sr10Mapping = await new Promise((resolve, reject) => {
      db.db.get(sr10Query, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (sr10Mapping) {
      console.log('✅ SR10 mapping found in database:');
      console.log(`📋 NAMASTE Code: ${sr10Mapping.namaste_code}`);
      console.log(`🏥 ICD-11 Code: ${sr10Mapping.icd11_code}`);
      console.log(`📝 ICD-11 Display: ${sr10Mapping.icd11_display}`);
      console.log(`📖 ICD-11 Description: ${sr10Mapping.icd11_description}`);
      console.log(`🎯 Confidence: ${sr10Mapping.confidence}`);
      console.log(`🔧 Mapping Type: ${sr10Mapping.mapping_type}`);
      
      if (sr10Mapping.mapping_details) {
        try {
          const details = JSON.parse(sr10Mapping.mapping_details);
          console.log(`🌐 Sanskrit Term: ${details.namaste_term}`);
          console.log(`📚 Source: ${details.source}`);
        } catch (e) {
          console.log('📄 Mapping Details:', sr10Mapping.mapping_details);
        }
      }
    } else {
      console.log('❌ SR10 mapping not found in database');
    }
    
    // Check for similar codes
    console.log('\n=== LOOKING FOR SIMILAR CODES ===');
    const similarQuery = `
      SELECT namaste_code 
      FROM concept_mappings 
      WHERE namaste_code LIKE 'SR%' 
      ORDER BY namaste_code
    `;
    
    const similarCodes = await new Promise((resolve, reject) => {
      db.db.all(similarQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    if (similarCodes.length > 0) {
      console.log('🔍 Found similar SR codes:');
      similarCodes.forEach(row => {
        console.log(`   - ${row.namaste_code}`);
      });
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAvailableCodes();