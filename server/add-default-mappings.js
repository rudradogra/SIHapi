require('dotenv').config();
const Database = require('./src/models/database');

const defaultMappings = [
  {
    namaste_code: 'AYU',
    namaste_term: 'vyādhi-viniścayaḥ',
    icd11_code: 'SK00',
    icd11_display: 'Head, brain, nerve and movement disorders',
    icd11_description: 'Disorders related to the head, brain, nerves, and movement.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'DIS',
    namaste_term: 'vikāraḥ',
    icd11_code: 'SL40',
    icd11_display: 'Respiratory system disorders',
    icd11_description: 'Disorders related to the respiratory system.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'A',
    namaste_term: 'doṣavaiśamyam',
    icd11_code: 'SM10',
    icd11_display: 'Gastro-intestinal disorders',
    icd11_description: 'Disorders related to the gastrointestinal system.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'AA',
    namaste_term: 'vātavyādhiḥ',
    icd11_code: 'SM20',
    icd11_display: 'Urinary and reproductive system disorders',
    icd11_description: 'Disorders related to the urinary and reproductive systems.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'AAA',
    namaste_term: 'doṣāvasthā (vāta)',
    icd11_code: 'SN40',
    icd11_display: 'Skin, nail and hair disorders',
    icd11_description: 'Disorders related to the skin, nails, and hair.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'SR11',
    namaste_term: 'vātasañcayaḥ',
    icd11_code: 'SP00',
    icd11_display: 'Bone, joint and muscle disorders',
    icd11_description: 'Disorders related to bones, joints, and muscles.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'SR12',
    namaste_term: 'vātavṛddhiḥ',
    icd11_code: 'SK60',
    icd11_display: 'Eye, ear, nose, throat and neck disorders',
    icd11_description: 'Disorders related to the eyes, ears, nose, throat, and neck.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'SR10',
    namaste_term: 'vātaprakopaḥ',
    icd11_code: 'SL60',
    icd11_display: 'Heart, blood and circulatory disorders',
    icd11_description: 'Disorders related to the heart, blood, and circulatory system.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'AAA-2.2',
    namaste_term: 'prāṇavātakopaḥ',
    icd11_code: 'SM30',
    icd11_display: 'Urinary and reproductive system disorders',
    icd11_description: 'Disorders related to the urinary and reproductive systems.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  },
  {
    namaste_code: 'AAA-2.3',
    namaste_term: 'udānavātakopaḥ',
    icd11_code: 'SN50',
    icd11_display: 'Skin, nail and hair disorders',
    icd11_description: 'Disorders related to the skin, nails, and hair.',
    confidence: 1.0,
    equivalence: 'equivalent',
    mapping_type: 'manual'
  }
];

async function addDefaultMappings() {
  console.log('🔄 Adding default NAMASTE to ICD-11 mappings...\n');
  
  try {
    // Initialize database
    const db = new Database('./data/ayush-terminology.db');
    await db.connect();
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const mapping of defaultMappings) {
      try {
        // First, add the ICD-11 code if it doesn't exist
        const icd11Query = `
          INSERT OR IGNORE INTO icd11_codes 
          (code, display, system_uri, description, status)
          VALUES (?, ?, ?, ?, ?)
        `;
        
        await new Promise((resolve, reject) => {
          db.db.run(icd11Query, [
            mapping.icd11_code,
            mapping.icd11_display,
            'http://id.who.int/icd/release/11/mms',
            mapping.icd11_description,
            'active'
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
        
        // Then add the mapping
        const mappingQuery = `
          INSERT OR REPLACE INTO concept_mappings 
          (namaste_code, icd11_code, equivalence, confidence, mapping_type, similarity_score, mapping_details)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const mappingDetails = JSON.stringify({
          namaste_term: mapping.namaste_term,
          icd11_display: mapping.icd11_display,
          icd11_description: mapping.icd11_description,
          source: 'manual_default'
        });
        
        await new Promise((resolve, reject) => {
          db.db.run(mappingQuery, [
            mapping.namaste_code,
            mapping.icd11_code,
            mapping.equivalence,
            mapping.confidence,
            mapping.mapping_type,
            mapping.confidence, // Use confidence as similarity score
            mappingDetails
          ], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        });
        
        console.log(`✅ Added mapping: ${mapping.namaste_code} (${mapping.namaste_term}) → ${mapping.icd11_code} (${mapping.icd11_display})`);
        successCount++;
        
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          console.log(`⚠️  Mapping already exists: ${mapping.namaste_code} → ${mapping.icd11_code}`);
          skipCount++;
        } else {
          console.error(`❌ Error adding mapping ${mapping.namaste_code} → ${mapping.icd11_code}:`, error.message);
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully added: ${successCount} mappings`);
    console.log(`⚠️  Already existed: ${skipCount} mappings`);
    console.log(`📋 Total processed: ${defaultMappings.length} mappings`);
    
    // Test one mapping - let's test the 'A' code for gastro-intestinal disorders
    console.log('\n🧪 Testing mapping for code "A" (doṣavaiśamyam)...');
    const testQuery = `
      SELECT 
        cm.*,
        nc.display as namaste_display,
        ic.display as icd11_display,
        ic.description as icd11_description
      FROM concept_mappings cm
      LEFT JOIN namaste_codes nc ON cm.namaste_code = nc.code
      LEFT JOIN icd11_codes ic ON cm.icd11_code = ic.code
      WHERE cm.namaste_code = 'A'
      LIMIT 1
    `;
    
    const testResult = await new Promise((resolve, reject) => {
      db.db.get(testQuery, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (testResult) {
      console.log('🎯 Test mapping found:');
      console.log(`   NAMASTE Code: ${testResult.namaste_code}`);
      console.log(`   NAMASTE Display: ${testResult.namaste_display || 'derangement of dōṣa'}`);
      console.log(`   ICD-11 Code: ${testResult.icd11_code}`);
      console.log(`   ICD-11 Display: ${testResult.icd11_display}`);
      console.log(`   ICD-11 Description: ${testResult.icd11_description}`);
      console.log(`   Confidence: ${testResult.confidence}`);
      console.log(`   Mapping Type: ${testResult.mapping_type}`);
      
      // Parse mapping details
      if (testResult.mapping_details) {
        try {
          const details = JSON.parse(testResult.mapping_details);
          console.log(`   Sanskrit Term: ${details.namaste_term}`);
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    } else {
      console.log('❌ Test mapping not found');
    }
    
    console.log('\n✅ Default mappings setup completed!');
    
    // Close database
    db.close();
    
  } catch (error) {
    console.error('❌ Error adding default mappings:', error.message);
    throw error;
  }
}

// Run the function
addDefaultMappings();