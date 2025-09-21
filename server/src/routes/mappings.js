const express = require('express');
const AyurvedaCodesParser = require('../utils/ayurvedaCodesParser');
const path = require('path');
const router = express.Router();

// Get stored mappings
router.get('/', async (req, res) => {
  try {
    const { 
      ayurveda_code, 
      icd11_code, 
      min_confidence = 0.6, 
      mapping_type,
      limit = 100
    } = req.query;
    
    const filters = {
      ayurveda_code,
      icd11_code,
      min_confidence: parseFloat(min_confidence),
      mapping_type,
      limit: parseInt(limit)
    };
    
    const mappings = await req.similarityMatcher.getStoredMappings(filters);
    
    res.json({
      total: mappings.length,
      filters,
      mappings
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Generate new mappings
router.post('/generate', async (req, res) => {
  try {
    const { 
      maxMatchesPerCode = 3, 
      saveToDatabase = true, 
      overwriteExisting = false,
      searchTerms = []
    } = req.body;
    
    // Parse Ayurveda codes from Excel
    const excelFilePath = path.join(__dirname, '..', '..', '..', 'AyurvedaMorbidityCodes.xls');
    const parser = new AyurvedaCodesParser(excelFilePath);
    const ayurvedaCodes = parser.parseExcelFile();
    
    // Get ICD-11 codes (fetch more if search terms provided)
    let icd11Codes = await req.icd11Service.getStoredICD11Codes(1000);
    
    if (searchTerms.length > 0) {
      // Fetch additional ICD-11 codes based on search terms
      for (const term of searchTerms) {
        try {
          const searchResults = await req.icd11Service.searchEntities(term, true);
          
          for (const result of searchResults.slice(0, 10)) {
            try {
              const entity = await req.icd11Service.getLinearizationEntity(result.id);
              if (entity && entity.code) {
                await req.icd11Service.storeICD11Code(entity);
                icd11Codes.push(entity);
              }
            } catch (entityError) {
              console.log(`Could not fetch entity ${result.id}: ${entityError.message}`);
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (searchError) {
          console.error(`Error searching for ${term}: ${searchError.message}`);
        }
      }
    }
    
    if (icd11Codes.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No ICD-11 codes available. Please sync ICD-11 codes first using POST /api/icd11/sync'
      });
    }
    
    // Generate mappings
    const mappingResults = await req.similarityMatcher.generateMappings(
      ayurvedaCodes, 
      icd11Codes,
      {
        maxMatchesPerCode,
        saveToDatabase,
        overwriteExisting
      }
    );
    
    res.json({
      message: 'Mapping generation completed',
      ayurvedaCodesProcessed: ayurvedaCodes.length,
      icd11CodesCompared: icd11Codes.length,
      ...mappingResults.stats,
      sampleHighConfidenceMappings: mappingResults.high.slice(0, 5),
      sampleMediumConfidenceMappings: mappingResults.medium.slice(0, 5)
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get mapping statistics
router.get('/stats', async (req, res) => {
  try {
    const allMappings = await req.similarityMatcher.getStoredMappings({ limit: 10000 });
    
    const highConfidence = allMappings.filter(m => m.confidence >= 0.8);
    const mediumConfidence = allMappings.filter(m => m.confidence >= 0.6 && m.confidence < 0.8);
    const lowConfidence = allMappings.filter(m => m.confidence < 0.6);
    
    const automaticMappings = allMappings.filter(m => m.mapping_type === 'automatic');
    const manualMappings = allMappings.filter(m => m.mapping_type === 'manual');
    
    res.json({
      total: allMappings.length,
      byConfidence: {
        high: highConfidence.length,
        medium: mediumConfidence.length,
        low: lowConfidence.length
      },
      byType: {
        automatic: automaticMappings.length,
        manual: manualMappings.length
      },
      averageConfidence: allMappings.reduce((sum, m) => sum + m.confidence, 0) / allMappings.length || 0
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Find similar codes for a specific Ayurveda code
router.post('/find-similar', async (req, res) => {
  try {
    const { ayurveda_code, max_results = 5 } = req.body;
    
    if (!ayurveda_code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ayurveda_code is required'
      });
    }
    
    // Get the Ayurveda code details (you might want to store these in DB too)
    const excelFilePath = path.join(__dirname, '..', '..', '..', 'AyurvedaMorbidityCodes.xls');
    const parser = new AyurvedaCodesParser(excelFilePath);
    const ayurvedaCodes = parser.parseExcelFile();
    
    const targetCode = ayurvedaCodes.find(code => code.code === ayurveda_code);
    
    if (!targetCode) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Ayurveda code not found'
      });
    }
    
    // Get ICD-11 codes
    const icd11Codes = await req.icd11Service.getStoredICD11Codes(1000);
    
    if (icd11Codes.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No ICD-11 codes available. Please sync ICD-11 codes first.'
      });
    }
    
    // Find matches
    const matches = await req.similarityMatcher.findBestMatches(
      targetCode, 
      icd11Codes, 
      parseInt(max_results)
    );
    
    res.json({
      ayurveda_code: targetCode,
      matches,
      total_matches: matches.length
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Validate or update a specific mapping
router.put('/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;
    const { confidence, equivalence, mapping_type, created_by } = req.body;
    
    // Update mapping in database
    const query = `
      UPDATE concept_mappings 
      SET confidence = COALESCE(?, confidence),
          equivalence = COALESCE(?, equivalence),
          mapping_type = COALESCE(?, mapping_type),
          created_by = COALESCE(?, created_by),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const result = await new Promise((resolve, reject) => {
      req.db.db.run(query, [confidence, equivalence, mapping_type, created_by, mappingId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
    
    if (result === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Mapping not found'
      });
    }
    
    res.json({
      message: 'Mapping updated successfully',
      mappingId: parseInt(mappingId),
      updatedFields: { confidence, equivalence, mapping_type, created_by }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Delete a mapping
router.delete('/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;
    
    const query = 'DELETE FROM concept_mappings WHERE id = ?';
    
    const result = await new Promise((resolve, reject) => {
      req.db.db.run(query, [mappingId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
    
    if (result === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Mapping not found'
      });
    }
    
    res.json({
      message: 'Mapping deleted successfully',
      mappingId: parseInt(mappingId)
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;