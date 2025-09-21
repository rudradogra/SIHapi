const { v4: uuidv4 } = require('uuid');

class FHIRCodeSystemService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Create FHIR CodeSystem for NAMASTE codes
   */
  async createNAMASTECodeSystem() {
    const codeSystem = {
      resourceType: 'CodeSystem',
      id: 'namaste-ayush-codes',
      url: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
      identifier: [
        {
          system: 'http://terminology.ayush.gov.in/identifier',
          value: 'namaste-ayush-codes'
        }
      ],
      version: '1.0.0',
      name: 'NAMASTEAyushCodes',
      title: 'NAMASTE AYUSH Terminology Codes',
      status: 'active',
      experimental: false,
      date: new Date().toISOString(),
      publisher: 'Ministry of AYUSH, Government of India',
      contact: [
        {
          telecom: [
            {
              system: 'url',
              value: 'http://ayush.gov.in'
            }
          ]
        }
      ],
      description: 'NAMASTE (National AYUSH Morbidity and Standardized Terminologies Electronic) code system for Ayurveda, Siddha, and Unani medical terminologies.',
      jurisdiction: [
        {
          coding: [
            {
              system: 'urn:iso:std:iso:3166',
              code: 'IN',
              display: 'India'
            }
          ]
        }
      ],
      purpose: 'To provide standardized coding for AYUSH medical diagnoses and conditions for integration with modern healthcare systems.',
      caseSensitive: true,
      valueSet: 'http://terminology.ayush.gov.in/ValueSet/namaste-all',
      hierarchyMeaning: 'classified-with',
      compositional: false,
      versionNeeded: false,
      content: 'complete',
      count: 0, // Will be updated with actual count
      concept: []
    };

    // Get all NAMASTE codes from database
    const namastelCodes = await this.db.all(`
      SELECT code, display, system_name, specialty, description, status 
      FROM namaste_codes 
      WHERE status = 'active'
      ORDER BY system_name, code
    `);

    // Convert to FHIR concept format
    codeSystem.concept = namastelCodes.map(code => ({
      code: code.code,
      display: code.display,
      definition: code.description,
      property: [
        {
          code: 'system',
          valueString: code.system_name
        },
        {
          code: 'specialty',
          valueString: code.specialty
        }
      ]
    }));

    codeSystem.count = codeSystem.concept.length;

    // Store in FHIR resources table
    await this.db.run(`
      INSERT OR REPLACE INTO fhir_resources (resource_id, resource_type, content, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, ['namaste-ayush-codes', 'CodeSystem', JSON.stringify(codeSystem)]);

    return codeSystem;
  }

  /**
   * Create FHIR ValueSet for NAMASTE codes
   */
  async createNAMASTEValueSet(filter = {}) {
    const valueSet = {
      resourceType: 'ValueSet',
      id: 'namaste-ayush-valueset',
      url: 'http://terminology.ayush.gov.in/ValueSet/namaste-all',
      identifier: [
        {
          system: 'http://terminology.ayush.gov.in/identifier',
          value: 'namaste-ayush-valueset'
        }
      ],
      version: '1.0.0',
      name: 'NAMASTEAyushValueSet',
      title: 'NAMASTE AYUSH ValueSet',
      status: 'active',
      experimental: false,
      date: new Date().toISOString(),
      publisher: 'Ministry of AYUSH, Government of India',
      description: 'ValueSet containing all NAMASTE AYUSH terminology codes',
      jurisdiction: [
        {
          coding: [
            {
              system: 'urn:iso:std:iso:3166',
              code: 'IN',
              display: 'India'
            }
          ]
        }
      ],
      compose: {
        include: [
          {
            system: 'http://terminology.ayush.gov.in/CodeSystem/namaste'
          }
        ]
      },
      expansion: {
        identifier: uuidv4(),
        timestamp: new Date().toISOString(),
        total: 0,
        contains: []
      }
    };

    // Build query based on filter
    let query = `
      SELECT code, display, system_name, specialty, description 
      FROM namaste_codes 
      WHERE status = 'active'
    `;
    const params = [];

    if (filter.system) {
      query += ' AND system_name = ?';
      params.push(filter.system);
    }

    if (filter.specialty) {
      query += ' AND specialty = ?';
      params.push(filter.specialty);
    }

    if (filter.text) {
      query += ' AND (display LIKE ? OR description LIKE ?)';
      params.push(`%${filter.text}%`, `%${filter.text}%`);
    }

    query += ' ORDER BY system_name, code';

    const codes = await this.db.all(query, params);

    // Convert to ValueSet expansion format
    valueSet.expansion.contains = codes.map(code => ({
      system: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
      code: code.code,
      display: code.display
    }));

    valueSet.expansion.total = valueSet.expansion.contains.length;

    return valueSet;
  }

  /**
   * Ingest NAMASTE codes from CSV data
   */
  async ingestCSV(csvData) {
    const results = {
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: []
    };

    for (const row of csvData) {
      try {
        results.processed++;

        const { code, display, system, specialty, description } = row;

        if (!code || !display || !system) {
          results.errors.push(`Row ${results.processed}: Missing required fields (code, display, system)`);
          continue;
        }

        // Check if code already exists
        const existing = await this.db.get('SELECT id FROM namaste_codes WHERE code = ?', [code]);

        if (existing) {
          // Update existing
          await this.db.run(`
            UPDATE namaste_codes 
            SET display = ?, system_name = ?, specialty = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE code = ?
          `, [display, system, specialty || 'General Medicine', description, code]);
          results.updated++;
        } else {
          // Insert new
          await this.db.run(`
            INSERT INTO namaste_codes (code, display, system_name, specialty, description)
            VALUES (?, ?, ?, ?, ?)
          `, [code, display, system, specialty || 'General Medicine', description]);
          results.inserted++;
        }

      } catch (error) {
        results.errors.push(`Row ${results.processed}: ${error.message}`);
      }
    }

    // Regenerate CodeSystem after CSV import
    if (results.inserted > 0 || results.updated > 0) {
      await this.createNAMASTECodeSystem();
    }

    return results;
  }

  /**
   * Get FHIR CodeSystem by ID
   */
  async getCodeSystem(id) {
    const result = await this.db.get(
      'SELECT content FROM fhir_resources WHERE resource_id = ? AND resource_type = ?',
      [id, 'CodeSystem']
    );

    if (result) {
      return JSON.parse(result.content);
    }

    // If not found in cache, try to generate it
    if (id === 'namaste-ayush-codes') {
      return await this.createNAMASTECodeSystem();
    }

    return null;
  }

  /**
   * Lookup codes in the CodeSystem
   */
  async lookupCode(system, code) {
    if (system !== 'http://terminology.ayush.gov.in/CodeSystem/namaste') {
      throw new Error('Unsupported code system');
    }

    const result = await this.db.get(`
      SELECT code, display, system_name, specialty, description 
      FROM namaste_codes 
      WHERE code = ? AND status = 'active'
    `, [code]);

    if (!result) {
      return null;
    }

    return {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'code',
          valueCode: result.code
        },
        {
          name: 'system',
          valueUri: 'http://terminology.ayush.gov.in/CodeSystem/namaste'
        },
        {
          name: 'display',
          valueString: result.display
        },
        {
          name: 'definition',
          valueString: result.description
        },
        {
          name: 'property',
          part: [
            {
              name: 'code',
              valueCode: 'system'
            },
            {
              name: 'value',
              valueString: result.system_name
            }
          ]
        },
        {
          name: 'property',
          part: [
            {
              name: 'code',
              valueCode: 'specialty'
            },
            {
              name: 'value',
              valueString: result.specialty
            }
          ]
        }
      ]
    };
  }
}

module.exports = FHIRCodeSystemService;