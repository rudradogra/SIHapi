const AyurvedaCodesParser = require('./src/utils/ayurvedaCodesParser');
const path = require('path');

// Test the parser
const excelFilePath = path.join(__dirname, '..', 'AyurvedaMorbidityCodes.xls');
const parser = new AyurvedaCodesParser(excelFilePath);

console.log('Testing Ayurveda Codes Parser...\n');

try {
  // First, preview the structure
  console.log('=== PREVIEW STRUCTURE ===');
  const structure = parser.previewStructure();
  
  console.log('\n=== PARSING CODES ===');
  const codes = parser.parseExcelFile();
  
  console.log('\n=== SAMPLE PARSED CODES ===');
  console.log('First 5 codes:');
  codes.slice(0, 5).forEach((code, index) => {
    console.log(`${index + 1}. Code: ${code.code}`);
    console.log(`   Display: ${code.display}`);
    console.log(`   Description: ${code.description}`);
    console.log(`   Specialty: ${code.specialty}`);
    console.log('');
  });
  
} catch (error) {
  console.error('Test failed:', error.message);
}