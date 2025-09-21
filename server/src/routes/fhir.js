const express = require('express');
const router = express.Router();

// FHIR Capability Statement
router.get('/metadata', async (req, res) => {
  try {
    const capabilityStatement = {
      resourceType: 'CapabilityStatement',
      id: 'ayush-terminology-server',
      url: `${req.protocol}://${req.get('host')}/fhir/metadata`,
      version: '1.0.0',
      name: 'AyushTerminologyServer',
      title: 'AYUSH-ICD11 Terminology Server',
      status: 'active',
      experimental: false,
      date: new Date().toISOString(),
      publisher: 'Ministry of AYUSH, Government of India',
      description: 'FHIR R4 terminology server for NAMASTE to ICD-11 code mapping',
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
      kind: 'instance',
      software: {
        name: 'AYUSH Terminology Service',
        version: '1.0.0'
      },
      implementation: {
        description: 'AYUSH-ICD11 Terminology Mapping Service MVP',
        url: `${req.protocol}://${req.get('host')}/fhir`
      },
      fhirVersion: '4.0.1',
      format: ['json'],
      rest: [
        {
          mode: 'server',
          documentation: 'Main FHIR endpoint for terminology services',
          security: {
            cors: true,
            description: 'OAuth2 Bearer token authentication (mocked for MVP)'
          },
          resource: [
            {
              type: 'CodeSystem',
              interaction: [
                { code: 'read' },
                { code: 'search-type' }
              ],
              operation: [
                {
                  name: 'lookup',
                  definition: 'http://hl7.org/fhir/OperationDefinition/CodeSystem-lookup'
                }
              ]
            },
            {
              type: 'ConceptMap',
              interaction: [
                { code: 'read' },
                { code: 'search-type' }
              ],
              operation: [
                {
                  name: 'translate',
                  definition: 'http://hl7.org/fhir/OperationDefinition/ConceptMap-translate'
                }
              ]
            },
            {
              type: 'ValueSet',
              interaction: [
                { code: 'read' }
              ],
              operation: [
                {
                  name: 'expand',
                  definition: 'http://hl7.org/fhir/OperationDefinition/ValueSet-expand'
                }
              ]
            },
            {
              type: 'Bundle',
              interaction: [
                { code: 'create' }
              ]
            }
          ]
        }
      ]
    };

    res.json(capabilityStatement);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

// Get CodeSystem
router.get('/CodeSystem/:id', async (req, res) => {
  try {
    const codeSystem = await req.codeSystemService.getCodeSystem(req.params.id);
    
    if (!codeSystem) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-found',
            diagnostics: `CodeSystem with id '${req.params.id}' not found`
          }
        ]
      });
    }

    res.json(codeSystem);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

// CodeSystem lookup operation
router.post('/CodeSystem/$lookup', async (req, res) => {
  try {
    const { system, code } = req.body;

    if (!system || !code) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'required',
            diagnostics: 'Both system and code parameters are required'
          }
        ]
      });
    }

    const result = await req.codeSystemService.lookupCode(system, code);
    
    if (!result) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-found',
            diagnostics: `Code '${code}' not found in system '${system}'`
          }
        ]
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

// Get ConceptMap
router.get('/ConceptMap/:id', async (req, res) => {
  try {
    const conceptMap = await req.conceptMapService.getConceptMap(req.params.id);
    
    if (!conceptMap) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-found',
            diagnostics: `ConceptMap with id '${req.params.id}' not found`
          }
        ]
      });
    }

    res.json(conceptMap);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

// ConceptMap translate operation
router.post('/ConceptMap/$translate', async (req, res) => {
  try {
    const { system, code, targetsystem } = req.body;

    if (!system || !code) {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'required',
            diagnostics: 'Both system and code parameters are required'
          }
        ]
      });
    }

    const result = await req.conceptMapService.translateCode(code, system);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

// ValueSet expand operation
router.get('/ValueSet/$expand', async (req, res) => {
  try {
    const { filter, system, specialty } = req.query;
    
    const filterParams = {};
    if (filter) filterParams.text = filter;
    if (system) filterParams.system = system;
    if (specialty) filterParams.specialty = specialty;

    const valueSet = await req.codeSystemService.createNAMASTEValueSet(filterParams);
    res.json(valueSet);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

// Bundle upload
router.post('/Bundle', async (req, res) => {
  try {
    const bundle = req.body;

    if (!bundle || bundle.resourceType !== 'Bundle') {
      return res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Request body must be a valid FHIR Bundle'
          }
        ]
      });
    }

    // Process bundle entries
    const results = [];
    let hasErrors = false;

    for (let i = 0; i < bundle.entry.length; i++) {
      const entry = bundle.entry[i];
      const resource = entry.resource;

      try {
        // For MVP, we'll just validate and echo back the resource
        if (resource.resourceType === 'Condition') {
          // Validate dual coding
          const coding = resource.code?.coding || [];
          const hasNamaste = coding.some(c => c.system === 'http://terminology.ayush.gov.in/CodeSystem/namaste');
          const hasICD11 = coding.some(c => c.system === 'http://id.who.int/icd/release/11/mms');

          if (hasNamaste && hasICD11) {
            results.push({
              status: '201 Created',
              location: `Condition/${resource.id || 'temp-id-' + i}`,
              outcome: {
                resourceType: 'OperationOutcome',
                issue: [
                  {
                    severity: 'information',
                    code: 'informational',
                    diagnostics: 'Condition with dual coding processed successfully'
                  }
                ]
              }
            });
          } else {
            results.push({
              status: '422 Unprocessable Entity',
              outcome: {
                resourceType: 'OperationOutcome',
                issue: [
                  {
                    severity: 'warning',
                    code: 'incomplete',
                    diagnostics: 'Condition should include both NAMASTE and ICD-11 codes for dual coding'
                  }
                ]
              }
            });
          }
        } else {
          results.push({
            status: '201 Created',
            location: `${resource.resourceType}/${resource.id || 'temp-id-' + i}`,
            outcome: {
              resourceType: 'OperationOutcome',
              issue: [
                {
                  severity: 'information',
                  code: 'informational',
                  diagnostics: `${resource.resourceType} processed successfully`
                }
              ]
            }
          });
        }
      } catch (error) {
        hasErrors = true;
        results.push({
          status: '500 Internal Server Error',
          outcome: {
            resourceType: 'OperationOutcome',
            issue: [
              {
                severity: 'error',
                code: 'exception',
                diagnostics: error.message
              }
            ]
          }
        });
      }
    }

    const responseBundle = {
      resourceType: 'Bundle',
      id: require('uuid').v4(),
      type: 'batch-response',
      timestamp: new Date().toISOString(),
      entry: results.map(result => ({
        response: {
          status: result.status,
          location: result.location,
          outcome: result.outcome
        }
      }))
    };

    res.status(hasErrors ? 207 : 200).json(responseBundle);
  } catch (error) {
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }
      ]
    });
  }
});

module.exports = router;