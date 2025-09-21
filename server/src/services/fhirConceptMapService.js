const { v4: uuidv4 } = require('uuid');

class FHIRConceptMapService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Create FHIR ConceptMap for NAMASTE to ICD-11 mappings
   */
  async createNAMASTEToICD11ConceptMap() {
    const conceptMap = {
      resourceType: 'ConceptMap',
      id: 'namaste-to-icd11',
      url: 'http://terminology.ayush.gov.in/ConceptMap/namaste-to-icd11',
      identifier: [
        {
          system: 'http://terminology.ayush.gov.in/identifier',
          value: 'namaste-to-icd11'
        }
      ],
      version: '1.0.0',
      name: 'NAMASTEToICD11ConceptMap',
      title: 'NAMASTE to ICD-11 Concept Map',
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
      description: 'Concept map for translating NAMASTE AYUSH codes to ICD-11 codes for dual-coding in electronic health records.',
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
      purpose: 'Enable interoperability between AYUSH traditional medicine codes and international ICD-11 classification.',
      sourceUri: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
      targetUri: 'http://id.who.int/icd/release/11/mms',
      group: []
    };

    // Get all mappings from database
    const mappings = await this.db.all(`
      SELECT 
        cm.namaste_code,
        cm.icd11_code,
        cm.equivalence,
        cm.confidence,
        nc.display as namaste_display,
        nc.system_name,
        ic.display as icd11_display
      FROM concept_mappings cm
      JOIN namaste_codes nc ON cm.namaste_code = nc.code
      JOIN icd11_codes ic ON cm.icd11_code = ic.code
      ORDER BY nc.system_name, cm.namaste_code
    `);

    if (mappings.length === 0) {
      conceptMap.group = [];
    } else {
      // Group mappings by source system
      const groupedMappings = {};
      
      mappings.forEach(mapping => {
        const sourceSystem = 'http://terminology.ayush.gov.in/CodeSystem/namaste';
        const targetSystem = 'http://id.who.int/icd/release/11/mms';
        
        const groupKey = `${sourceSystem}|${targetSystem}`;
        
        if (!groupedMappings[groupKey]) {
          groupedMappings[groupKey] = {
            source: sourceSystem,
            target: targetSystem,
            element: []
          };
        }

        groupedMappings[groupKey].element.push({
          code: mapping.namaste_code,
          display: mapping.namaste_display,
          target: [
            {
              code: mapping.icd11_code,
              display: mapping.icd11_display,
              equivalence: mapping.equivalence,
              comment: `Confidence: ${mapping.confidence}. System: ${mapping.system_name}`
            }
          ]
        });
      });

      conceptMap.group = Object.values(groupedMappings);
    }

    // Store in FHIR resources table
    await this.db.run(`
      INSERT OR REPLACE INTO fhir_resources (resource_id, resource_type, content, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, ['namaste-to-icd11', 'ConceptMap', JSON.stringify(conceptMap)]);

    return conceptMap;
  }

  /**
   * Translate a NAMASTE code to ICD-11
   */
  async translateCode(sourceCode, sourceSystem = 'http://terminology.ayush.gov.in/CodeSystem/namaste') {
    if (sourceSystem !== 'http://terminology.ayush.gov.in/CodeSystem/namaste') {
      throw new Error('Unsupported source system');
    }

    const mappings = await this.db.all(`
      SELECT 
        cm.namaste_code,
        cm.icd11_code,
        cm.equivalence,
        cm.confidence,
        nc.display as namaste_display,
        ic.display as icd11_display
      FROM concept_mappings cm
      JOIN namaste_codes nc ON cm.namaste_code = nc.code
      JOIN icd11_codes ic ON cm.icd11_code = ic.code
      WHERE cm.namaste_code = ?
    `, [sourceCode]);

    const parameters = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'result',
          valueBoolean: mappings.length > 0
        }
      ]
    };

    if (mappings.length > 0) {
      // Add source information
      parameters.parameter.push({
        name: 'source',
        valueUri: sourceSystem
      });

      // Add matches
      mappings.forEach(mapping => {
        parameters.parameter.push({
          name: 'match',
          part: [
            {
              name: 'equivalence',
              valueCode: mapping.equivalence
            },
            {
              name: 'concept',
              valueCoding: {
                system: 'http://id.who.int/icd/release/11/mms',
                code: mapping.icd11_code,
                display: mapping.icd11_display
              }
            },
            {
              name: 'source',
              valueString: `Confidence: ${mapping.confidence}`
            }
          ]
        });
      });
    } else {
      // No match found
      parameters.parameter.push({
        name: 'message',
        valueString: `No mapping found for code ${sourceCode} in system ${sourceSystem}`
      });
    }

    return parameters;
  }

  /**
   * Reverse translate from ICD-11 to NAMASTE
   */
  async reverseTranslateCode(targetCode, targetSystem = 'http://id.who.int/icd/release/11/mms') {
    if (targetSystem !== 'http://id.who.int/icd/release/11/mms') {
      throw new Error('Unsupported target system');
    }

    const mappings = await this.db.all(`
      SELECT 
        cm.namaste_code,
        cm.icd11_code,
        cm.equivalence,
        cm.confidence,
        nc.display as namaste_display,
        nc.system_name,
        ic.display as icd11_display
      FROM concept_mappings cm
      JOIN namaste_codes nc ON cm.namaste_code = nc.code
      JOIN icd11_codes ic ON cm.icd11_code = ic.code
      WHERE cm.icd11_code = ?
    `, [targetCode]);

    const parameters = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'result',
          valueBoolean: mappings.length > 0
        }
      ]
    };

    if (mappings.length > 0) {
      mappings.forEach(mapping => {
        parameters.parameter.push({
          name: 'match',
          part: [
            {
              name: 'equivalence',
              valueCode: mapping.equivalence
            },
            {
              name: 'concept',
              valueCoding: {
                system: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
                code: mapping.namaste_code,
                display: mapping.namaste_display
              }
            },
            {
              name: 'source',
              valueString: `System: ${mapping.system_name}, Confidence: ${mapping.confidence}`
            }
          ]
        });
      });
    }

    return parameters;
  }

  /**
   * Add a new concept mapping
   */
  async addMapping(namasteCode, icd11Code, equivalence = 'equivalent', confidence = 1.0, createdBy = 'system') {
    try {
      // Verify that both codes exist
      const namasteExists = await this.db.get('SELECT code FROM namaste_codes WHERE code = ?', [namasteCode]);
      const icd11Exists = await this.db.get('SELECT code FROM icd11_codes WHERE code = ?', [icd11Code]);

      if (!namasteExists) {
        throw new Error(`NAMASTE code ${namasteCode} not found`);
      }

      if (!icd11Exists) {
        throw new Error(`ICD-11 code ${icd11Code} not found`);
      }

      // Insert the mapping
      await this.db.run(`
        INSERT INTO concept_mappings (namaste_code, icd11_code, equivalence, confidence, created_by)
        VALUES (?, ?, ?, ?, ?)
      `, [namasteCode, icd11Code, equivalence, confidence, createdBy]);

      // Regenerate ConceptMap
      await this.createNAMASTEToICD11ConceptMap();

      return { success: true, message: 'Mapping added successfully' };

    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, message: 'Mapping already exists' };
      }
      throw error;
    }
  }

  /**
   * Get ConceptMap by ID
   */
  async getConceptMap(id) {
    const result = await this.db.get(
      'SELECT content FROM fhir_resources WHERE resource_id = ? AND resource_type = ?',
      [id, 'ConceptMap']
    );

    if (result) {
      return JSON.parse(result.content);
    }

    // If not found in cache, try to generate it
    if (id === 'namaste-to-icd11') {
      return await this.createNAMASTEToICD11ConceptMap();
    }

    return null;
  }

  /**
   * Get all available ConceptMaps
   */
  async getAllConceptMaps() {
    const results = await this.db.all(`
      SELECT resource_id, content, updated_at 
      FROM fhir_resources 
      WHERE resource_type = 'ConceptMap'
      ORDER BY updated_at DESC
    `);

    return results.map(result => {
      const conceptMap = JSON.parse(result.content);
      return {
        id: conceptMap.id,
        url: conceptMap.url,
        name: conceptMap.name,
        title: conceptMap.title,
        status: conceptMap.status,
        version: conceptMap.version,
        lastUpdated: result.updated_at
      };
    });
  }
}

module.exports = FHIRConceptMapService;