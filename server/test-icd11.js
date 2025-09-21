require('dotenv').config();
const Database = require('./src/models/database');
const ICD11Service = require('./src/services/icd11Service');
const path = require('path');

async function testICD11Service() {
  console.log('🧪 Testing ICD-11 Service...\n');
  
  try {
    // Initialize database
    const dbPath = './data/ayush-terminology.db';
    const db = new Database(dbPath);
    await db.connect();
    
    // Initialize ICD-11 service
    const icd11Service = new ICD11Service(db);
    
    console.log('=== TESTING AUTHENTICATION ===');
    await icd11Service.authenticate();
    
    console.log('\n=== TESTING SEARCH ===');
    const searchResults = await icd11Service.searchEntities('diabetes', true);
    console.log(`Found ${searchResults.length} results for "diabetes"`);
    
    if (searchResults.length > 0) {
      console.log('\nFirst result:');
      console.log('- Title:', searchResults[0].title);
      console.log('- Definition:', searchResults[0].definition);
      console.log('- URI:', searchResults[0].id);
      
      console.log('\n=== TESTING ENTITY FETCH ===');
      const entity = await icd11Service.getEntity(searchResults[0].id);
      console.log('Fetched entity:');
      console.log('- Title:', entity.title);
      console.log('- Definition:', entity.definition);
      console.log('- Synonyms:', entity.synonym);
      
      // Try to get linearization entity (with code)
      try {
        console.log('\n=== TESTING LINEARIZATION ENTITY ===');
        const linearEntity = await icd11Service.getLinearizationEntity(searchResults[0].id);
        console.log('Linearization entity:');
        console.log('- Code:', linearEntity.code);
        console.log('- Title:', linearEntity.title);
        console.log('- Definition:', linearEntity.definition);
        
        // Store in database
        if (linearEntity.code) {
          console.log('\n=== TESTING DATABASE STORAGE ===');
          await icd11Service.storeICD11Code(linearEntity);
        }
        
      } catch (linearError) {
        console.log('⚠️  Linearization entity not available (entity might not be in MMS):', linearError.message);
      }
    }
    
    console.log('\n✅ ICD-11 Service test completed successfully!');
    
  } catch (error) {
    console.error('❌ ICD-11 Service test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testICD11Service();