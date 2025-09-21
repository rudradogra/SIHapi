const XLSX = require('xlsx');
const path = require('path');

class AyurvedaCodesParser {
  constructor(filePath) {
    this.filePath = filePath;
  }

  parseExcelFile() {
    try {
      console.log('📊 Reading Ayurveda Morbidity Codes Excel file...');
      
      // Read the Excel file
      const workbook = XLSX.readFile(this.filePath);
      
      // Get the first worksheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Process the data
      const codes = this.processRawData(rawData);
      
      console.log(`✅ Successfully parsed ${codes.length} Ayurveda codes`);
      return codes;
      
    } catch (error) {
      console.error('❌ Error parsing Excel file:', error.message);
      throw new Error(`Failed to parse Ayurveda codes: ${error.message}`);
    }
  }

  processRawData(rawData) {
    const codes = [];
    
    // Skip header row and process data
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      
      // Skip empty rows
      if (!row || row.length === 0 || !row[1]) {
        continue;
      }
      
      // Extract data based on actual Excel structure
      // Columns: Sr No., NAMC_ID, NAMC_CODE, NAMC_term, NAMC_term_diacritical, 
      //          NAMC_term_DEVANAGARI, Short_definition, Long_definition, 
      //          Ontology_branches, Name English, Name English Under Index, Primary Index Related
      const code = {
        namc_id: this.cleanValue(row[1]), // NAMC_ID
        code: this.cleanValue(row[2]), // NAMC_CODE
        namc_term: this.cleanValue(row[3]), // NAMC_term
        namc_term_diacritical: this.cleanValue(row[4]), // NAMC_term_diacritical
        namc_term_devanagari: this.cleanValue(row[5]), // NAMC_term_DEVANAGARI
        short_definition: this.cleanValue(row[6]), // Short_definition
        long_definition: this.cleanValue(row[7]), // Long_definition
        ontology_branches: this.cleanValue(row[8]), // Ontology_branches
        name_english: this.cleanValue(row[9]), // Name English
        name_english_under_index: this.cleanValue(row[10]), // Name English Under Index
        primary_index_related: this.cleanValue(row[11]), // Primary Index Related
        
        // Standardized fields for the database
        display: this.cleanValue(row[9]) || this.cleanValue(row[3]) || this.cleanValue(row[2]), // Prefer English name
        description: this.cleanValue(row[7]) || this.cleanValue(row[6]) || this.cleanValue(row[9]), // Prefer long definition
        specialty: 'Ayurveda',
        system_name: 'AYUSH'
      };
      
      // Only add if we have a valid NAMC_CODE
      if (code.code && code.code.trim() !== '' && code.code !== '-') {
        codes.push(code);
      }
    }
    
    return codes;
  }

  cleanValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value === 'string') {
      return value.trim();
    }
    
    return String(value).trim();
  }

  // Method to get a preview of the Excel structure for debugging
  previewStructure() {
    try {
      const workbook = XLSX.readFile(this.filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      console.log('📋 Excel file structure preview:');
      console.log('Sheet name:', sheetName);
      console.log('Total rows:', rawData.length);
      
      if (rawData.length > 0) {
        console.log('Headers (first row):', rawData[0]);
        
        if (rawData.length > 1) {
          console.log('Sample data (second row):', rawData[1]);
        }
        
        if (rawData.length > 2) {
          console.log('Sample data (third row):', rawData[2]);
        }
      }
      
      return {
        sheetName,
        totalRows: rawData.length,
        headers: rawData[0] || [],
        sampleData: rawData.slice(1, 3)
      };
      
    } catch (error) {
      console.error('❌ Error previewing Excel structure:', error.message);
      throw error;
    }
  }
}

module.exports = AyurvedaCodesParser;