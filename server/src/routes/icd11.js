const express = require('express');
const router = express.Router();

// Get ICD-11 codes
router.get('/codes', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    
    if (search) {
      // Search stored ICD-11 codes
      const results = await req.icd11Service.searchStoredICD11Codes(search);
      res.json({
        total: results.length,
        results,
        query: search
      });
    } else {
      // Get paginated ICD-11 codes
      const results = await req.icd11Service.getStoredICD11Codes(
        parseInt(limit), 
        parseInt(offset)
      );
      
      res.json({
        total: results.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        results
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Search ICD-11 codes from WHO API
router.get('/search', async (req, res) => {
  try {
    const { q: query, useLinearization = 'true' } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter "q" is required'
      });
    }
    
    const useLinear = useLinearization.toLowerCase() === 'true';
    const results = await req.icd11Service.searchEntities(query, useLinear);
    
    res.json({
      query,
      useLinearization: useLinear,
      total: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get specific ICD-11 entity
router.get('/entity/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    const { linearization = 'false' } = req.query;
    
    // Reconstruct entity URI
    const entityURI = entityId.startsWith('http') 
      ? entityId 
      : `http://id.who.int/icd/entity/${entityId}`;
    
    let result;
    if (linearization.toLowerCase() === 'true') {
      result = await req.icd11Service.getLinearizationEntity(entityURI);
    } else {
      result = await req.icd11Service.getEntity(entityURI);
    }
    
    if (!result) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'ICD-11 entity not found'
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Sync ICD-11 codes (fetch from API and store locally)
router.post('/sync', async (req, res) => {
  try {
    const { searchTerms = [], maxPerTerm = 10 } = req.body;
    
    const defaultTerms = [
      'disease', 'disorder', 'condition', 'syndrome',
      'diabetes', 'hypertension', 'arthritis', 'asthma'
    ];
    
    const terms = searchTerms.length > 0 ? searchTerms : defaultTerms;
    const results = [];
    
    for (const term of terms) {
      try {
        const searchResults = await req.icd11Service.searchEntities(term, true);
        
        for (const result of searchResults.slice(0, maxPerTerm)) {
          try {
            const entity = await req.icd11Service.getLinearizationEntity(result.id);
            if (entity && entity.code) {
              await req.icd11Service.storeICD11Code(entity);
              results.push(entity);
            }
          } catch (entityError) {
            console.log(`Could not fetch entity ${result.id}: ${entityError.message}`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (searchError) {
        console.error(`Error searching for ${term}: ${searchError.message}`);
      }
    }
    
    res.json({
      message: 'ICD-11 codes synchronization completed',
      searchTerms: terms,
      totalSynced: results.length,
      results: results.slice(0, 10) // Return first 10 as sample
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;