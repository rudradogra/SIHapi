const AyurvedaCodesParser = require('./src/utils/ayurvedaCodesParser');
const path = require('path');

async function showAyurvedaCodes() {
  console.log('📋 Displaying all Ayurveda codes from Excel file...\n');
  
  try {
    const excelFilePath = path.join(__dirname, '..', 'AyurvedaMorbidityCodes.xls');
    const parser = new AyurvedaCodesParser(excelFilePath);
    
    // First show structure
    console.log('=== EXCEL STRUCTURE ===');
    const structure = parser.previewStructure();
    
    // Then show all codes
    console.log('\n=== ALL AYURVEDA CODES ===');
    const codes = parser.parseExcelFile();
    
    codes.forEach((code, index) => {
      console.log(`${index + 1}. Code: ${code.code}`);
      console.log(`   Display: ${code.display}`);
      console.log(`   NAMC Term: ${code.namc_term}`);
      console.log(`   English: ${code.name_english}`);
      console.log(`   Description: ${code.description}`);
      console.log(`   Short Def: ${code.short_definition}`);
      console.log(`   Long Def: ${code.long_definition}`);
      console.log('   ---');
    });
    
    console.log(`\n📊 Total codes: ${codes.length}`);
    
    // Show unique codes for mapping
    console.log('\n=== CODES FOR MAPPING ===');
    codes.forEach(code => {
      console.log(`'${code.code}': '${code.display || code.name_english}',`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

showAyurvedaCodes();