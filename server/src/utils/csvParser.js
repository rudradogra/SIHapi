const csv = require('csv-parser');
const fs = require('fs');

class CSVParser {
  /**
   * Parse CSV file and return array of objects
   */
  static async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Parse CSV string and return array of objects
   */
  static async parseString(csvString) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = require('stream');
      const readable = new stream.Readable();
      
      readable.push(csvString);
      readable.push(null);
      
      readable
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Validate NAMASTE CSV structure
   */
  static validateNAMASTECSV(data) {
    const errors = [];
    const requiredFields = ['code', 'display', 'system'];

    if (!Array.isArray(data) || data.length === 0) {
      errors.push('CSV data is empty or invalid');
      return { valid: false, errors };
    }

    // Check first row for required fields
    const firstRow = data[0];
    for (const field of requiredFields) {
      if (!(field in firstRow)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate each row
    data.forEach((row, index) => {
      for (const field of requiredFields) {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Row ${index + 1}: Missing or empty ${field}`);
        }
      }

      // Validate code format
      if (row.code && !/^[A-Z]{3}\d{3}$/.test(row.code)) {
        errors.push(`Row ${index + 1}: Invalid code format. Expected format: ABC123 (3 letters + 3 numbers)`);
      }

      // Validate system
      if (row.system && !['Ayurveda', 'Siddha', 'Unani'].includes(row.system)) {
        errors.push(`Row ${index + 1}: Invalid system. Must be one of: Ayurveda, Siddha, Unani`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = CSVParser;