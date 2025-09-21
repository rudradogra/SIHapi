require('dotenv').config();
const Database = require('./src/models/database');
const ICD11Service = require('./src/services/icd11Service');
const SimilarityMatcher = require('./src/services/similarityMatcher');
const AyurvedaCodesParser = require('./src/utils/ayurvedaCodesParser');
const path = require('path');

async function generateAyurvedaToICD11Mappings() {
  console.log('🚀 Starting Ayurveda to ICD-11 mapping generation...\n');
  
  try {
    // Initialize services
    console.log('=== INITIALIZING SERVICES ===');
    const db = new Database('./data/ayush-terminology.db');
    await db.connect();
    
    const icd11Service = new ICD11Service(db);
    const similarityMatcher = new SimilarityMatcher(db);
    
    // Parse Ayurveda codes from Excel
    console.log('\n=== PARSING AYURVEDA CODES ===');
    const excelFilePath = path.join(__dirname, '..', 'AyurvedaMorbidityCodes.xls');
    const parser = new AyurvedaCodesParser(excelFilePath);
    const ayurvedaCodes = parser.parseExcelFile();
    
    console.log(`Loaded ${ayurvedaCodes.length} Ayurveda codes`);
    
    // Get or fetch ICD-11 codes for common medical conditions
    console.log('\n=== FETCHING ICD-11 CODES ===');
    
    // Search terms that might relate to Ayurveda conditions
    const searchTerms = [
      'disease', 'disorder', 'condition', 'syndrome', 'illness',
      'inflammation', 'infection', 'pain', 'fever', 'digestive',
      'respiratory', 'circulatory', 'nervous', 'musculoskeletal',
      'diabetes', 'hypertension', 'arthritis', 'asthma', 'gastritis',
      'headache', 'anxiety', 'depression', 'fatigue', 'insomnia'
    ];
    
    let allICD11Codes = [];
    
    // First, try to get stored codes
    const storedCodes = await icd11Service.getStoredICD11Codes(1000);
    if (storedCodes.length > 0) {
      console.log(`Found ${storedCodes.length} stored ICD-11 codes`);
      allICD11Codes = storedCodes;
    } else {
      console.log('Fetching ICD-11 codes from WHO API...');
      
      for (const term of searchTerms) {
        try {
          console.log(`Searching for: ${term}`);
          const searchResults = await icd11Service.searchEntities(term, true);
          
          for (const result of searchResults.slice(0, 10)) { // Limit to 10 per search term
            try {
              const entity = await icd11Service.getLinearizationEntity(result.id);
              if (entity && entity.code) {
                await icd11Service.storeICD11Code(entity);
                allICD11Codes.push(entity);
              }
            } catch (entityError) {
              console.log(`⚠️  Could not fetch entity ${result.id}: ${entityError.message}`);
            }
          }
          
          // Add delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (searchError) {
          console.error(`❌ Error searching for ${term}: ${searchError.message}`);
        }
      }
    }
    
    console.log(`Total ICD-11 codes available: ${allICD11Codes.length}`);
    
    if (allICD11Codes.length === 0) {
      console.log('⚠️  No ICD-11 codes available. Please check API connectivity.');
      return;
    }
    
    // Generate mappings
    console.log('\n=== GENERATING MAPPINGS ===');
    const mappingResults = await similarityMatcher.generateMappings(
      ayurvedaCodes, 
      allICD11Codes,
      {
        maxMatchesPerCode: 3,
        saveToDatabase: true,
        overwriteExisting: true
      }
    );
    
    // Display results
    console.log('\n=== MAPPING RESULTS ===');
    console.log(`📊 Total mappings generated: ${mappingResults.stats.total}`);
    console.log(`🎯 High confidence mappings: ${mappingResults.stats.highConfidence}`);
    console.log(`🎯 Medium confidence mappings: ${mappingResults.stats.mediumConfidence}`);
    
    console.log('\n=== TOP HIGH CONFIDENCE MAPPINGS ===');
    mappingResults.high.slice(0, 10).forEach((mapping, index) => {
      console.log(`${index + 1}. ${mapping.ayurveda_code} → ${mapping.icd11_code} (${mapping.icd11_display})`);
      console.log(`   Similarity: ${(mapping.similarity_score * 100).toFixed(1)}%`);
      console.log(`   Ayurveda: ${mapping.ayurveda_text.substring(0, 80)}...`);
      console.log(`   ICD-11: ${mapping.icd11_text.substring(0, 80)}...`);
      console.log('');
    });
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Mapping generation completed successfully!');
    console.log(`📋 ${ayurvedaCodes.length} Ayurveda codes processed`);
    console.log(`🏥 ${allICD11Codes.length} ICD-11 codes compared`);
    console.log(`🔗 ${mappingResults.stats.total} mappings created`);
    console.log(`💾 All mappings saved to database`);
    
  } catch (error) {
    console.error('❌ Mapping generation failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the mapping generation
generateAyurvedaToICD11Mappings();