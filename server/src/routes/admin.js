const express = require('express');
const csv = require('csv-parser');
const { Readable } = require('stream');
const router = express.Router();

// Import CSV data
router.post('/csv/import', async (req, res) => {
  try {
    const { csvData } = req.body;

    if (!csvData) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'CSV data is required'
      });
    }

    // Parse CSV data
    const results = [];
    const stream = Readable.from([csvData]);

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const importResult = await req.codeSystemService.ingestCSV(results);
          res.json({
            message: 'CSV import completed',
            results: importResult
          });
        } catch (error) {
          res.status(500).json({
            error: 'Import Error',
            message: error.message
          });
        }
      })
      .on('error', (error) => {
        res.status(400).json({
          error: 'CSV Parse Error',
          message: error.message
        });
      });

  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    // Count NAMASTE codes
    const namasteCount = await req.db.get('SELECT COUNT(*) as count FROM namaste_codes WHERE status = "active"');
    stats.namasteCodesCount = namasteCount.count;

    // Count by system
    const systemCounts = await req.db.all(`
      SELECT system_name, COUNT(*) as count 
      FROM namaste_codes 
      WHERE status = 'active' 
      GROUP BY system_name
    `);
    stats.codesBySystem = systemCounts;

    // Count ICD-11 codes
    const icd11Count = await req.db.get('SELECT COUNT(*) as count FROM icd11_codes WHERE status = "active"');
    stats.icd11CodesCount = icd11Count.count;

    // Count mappings
    const mappingCount = await req.db.get('SELECT COUNT(*) as count FROM concept_mappings');
    stats.mappingsCount = mappingCount.count;

    // Count audit events
    const auditCount = await req.db.get('SELECT COUNT(*) as count FROM audit_events');
    stats.auditEventsCount = auditCount.count;

    // Recent activity
    const recentAudits = await req.db.all(`
      SELECT event_type, action, timestamp 
      FROM audit_events 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    stats.recentActivity = recentAudits;

    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Add new mapping
router.post('/mapping', async (req, res) => {
  try {
    const { namasteCode, icd11Code, equivalence, confidence } = req.body;

    if (!namasteCode || !icd11Code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both namasteCode and icd11Code are required'
      });
    }

    const result = await req.conceptMapService.addMapping(
      namasteCode,
      icd11Code,
      equivalence || 'equivalent',
      confidence || 1.0,
      req.user?.id || 'admin'
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get all ConceptMaps
router.get('/conceptmaps', async (req, res) => {
  try {
    const conceptMaps = await req.conceptMapService.getAllConceptMaps();
    res.json(conceptMaps);
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;