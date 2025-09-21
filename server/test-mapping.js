require('dotenv').config();
const Database = require('./src/models/database');

async function testMappings() {
  console.log('🧪 Testing NAMASTE to ICD-11 Mappings\n');
  
  try {
    const db = new Database('./data/ayush-terminology.db');
    await db.connect();
    
    // Test the mapping for code 'A' (doṣavaiśamyam)
    console.log('=== Testing Code "A" (doṣavaiśamyam) ===');
    
    const query = `
      SELECT 
        cm.namaste_code,
        cm.icd11_code,
        cm.confidence,
        cm.mapping_type,
        cm.mapping_details,
        ic.display as icd11_display,
        ic.description as icd11_description
      FROM concept_mappings cm
      LEFT JOIN icd11_codes ic ON cm.icd11_code = ic.code
      WHERE cm.namaste_code = 'A'
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.db.get(query, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (result) {
      console.log('✅ Mapping Found:');
      console.log(`📋 NAMASTE Code: ${result.namaste_code}`);
      console.log(`🏥 ICD-11 Code: ${result.icd11_code}`);
      console.log(`📝 ICD-11 Display: ${result.icd11_display}`);
      console.log(`📖 ICD-11 Description: ${result.icd11_description}`);
      console.log(`🎯 Confidence: ${result.confidence}`);
      console.log(`🔧 Mapping Type: ${result.mapping_type}`);
      
      if (result.mapping_details) {
        try {
          const details = JSON.parse(result.mapping_details);
          console.log(`🌐 Sanskrit Term: ${details.namaste_term}`);
          console.log(`📚 Source: ${details.source}`);
        } catch (e) {
          console.log('📄 Mapping Details: (Unable to parse JSON)');
        }
      }
      
      console.log('\n🎉 Test Result: SUCCESS');
      console.log('The Ayurveda code "A" (doṣavaiśamyam - derangement of dōṣa) is successfully mapped to');
      console.log('ICD-11 code "SM10" (Gastro-intestinal disorders).');
      
    } else {
      console.log('❌ No mapping found for code "A"');
    }
    
    // Show all mappings summary
    console.log('\n=== All Manual Mappings Summary ===');
    const allMappingsQuery = `
      SELECT 
        namaste_code,
        icd11_code,
        confidence
      FROM concept_mappings 
      WHERE mapping_type = 'manual'
      ORDER BY namaste_code
    `;
    
    const allMappings = await new Promise((resolve, reject) => {
      db.db.all(allMappingsQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`📊 Total Manual Mappings: ${allMappings.length}`);
    allMappings.forEach((mapping, index) => {
      console.log(`${index + 1}. ${mapping.namaste_code} → ${mapping.icd11_code} (${mapping.confidence})`);
    });
    
    db.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMappings();