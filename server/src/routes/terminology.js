const express = require('express');
const router = express.Router();

// Legacy API for backward compatibility
router.get('/lookup', async (req, res) => {
  try {
    const { filter, system, specialty } = req.query;
    
    const filterParams = {};
    if (filter) filterParams.text = filter;
    if (system) filterParams.system = system;
    if (specialty) filterParams.specialty = specialty;

    const valueSet = await req.codeSystemService.createNAMASTEValueSet(filterParams);
    
    // Convert to simple format
    const results = valueSet.expansion.contains.map(concept => ({
      code: concept.code,
      display: concept.display,
      system: concept.system
    }));

    res.json({
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

router.get('/translate', async (req, res) => {
  try {
    const { code, system } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Code parameter is required'
      });
    }

    const result = await req.conceptMapService.translateCode(
      code,
      system || 'http://terminology.ayush.gov.in/CodeSystem/namaste'
    );

    // Convert to simple format
    const matches = result.parameter
      .filter(p => p.name === 'match')
      .map(p => {
        const concept = p.part.find(part => part.name === 'concept');
        const equivalence = p.part.find(part => part.name === 'equivalence');
        return {
          code: concept.valueCoding.code,
          display: concept.valueCoding.display,
          system: concept.valueCoding.system,
          equivalence: equivalence.valueCode
        };
      });

    res.json({
      sourceCode: code,
      matches
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;