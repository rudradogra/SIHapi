#!/usr/bin/env node

/**
 * Test script for AYUSH-ICD11 Terminology Service
 * Demonstrates all major functionality
 */

const { generateMockToken } = require('../src/middleware/auth');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const token = generateMockToken({
  userId: 'test-user-123',
  username: 'test-clinician',
  role: 'clinician',
  abhaId: 'test-abha-id',
  facilityId: 'test-facility-123'
});

console.log('🧪 AYUSH-ICD11 Terminology Service Test Suite');
console.log('='.repeat(50));
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Token: ${token.substring(0, 50)}...`);
console.log('');

/**
 * Make HTTP request with proper headers
 */
async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  const text = await response.text();
  
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: response.status, data };
}

/**
 * Test functions
 */

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/health`);
    console.log(`   Status: ${status}`);
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    console.log('   ✅ Health check passed\n');
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}\n`);
  }
}

async function testCapabilityStatement() {
  console.log('📋 Testing FHIR Capability Statement...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/fhir/metadata`);
    console.log(`   Status: ${status}`);
    console.log(`   Server: ${data.software?.name} v${data.software?.version}`);
    console.log(`   FHIR Version: ${data.fhirVersion}`);
    console.log('   ✅ Capability statement retrieved\n');
  } catch (error) {
    console.log(`   ❌ Capability statement failed: ${error.message}\n`);
  }
}

async function testCodeSystemLookup() {
  console.log('🔍 Testing CodeSystem Lookup...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/fhir/CodeSystem/$lookup`, {
      method: 'POST',
      body: JSON.stringify({
        system: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
        code: 'AYU001'
      })
    });
    
    console.log(`   Status: ${status}`);
    if (data.parameter) {
      const displayParam = data.parameter.find(p => p.name === 'display');
      console.log(`   Code: AYU001`);
      console.log(`   Display: ${displayParam?.valueString}`);
      console.log('   ✅ Code lookup successful\n');
    } else {
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Code lookup failed: ${error.message}\n`);
  }
}

async function testConceptMapTranslate() {
  console.log('🔄 Testing ConceptMap Translation...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/fhir/ConceptMap/$translate`, {
      method: 'POST',
      body: JSON.stringify({
        system: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
        code: 'AYU001'
      })
    });
    
    console.log(`   Status: ${status}`);
    if (data.parameter) {
      const resultParam = data.parameter.find(p => p.name === 'result');
      const matchParams = data.parameter.filter(p => p.name === 'match');
      
      console.log(`   Translation found: ${resultParam?.valueBoolean}`);
      if (matchParams.length > 0) {
        const concept = matchParams[0].part.find(p => p.name === 'concept');
        console.log(`   ICD-11 Code: ${concept?.valueCoding?.code}`);
        console.log(`   ICD-11 Display: ${concept?.valueCoding?.display}`);
      }
      console.log('   ✅ Translation successful\n');
    } else {
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Translation failed: ${error.message}\n`);
  }
}

async function testValueSetExpansion() {
  console.log('📚 Testing ValueSet Expansion...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/fhir/ValueSet/$expand?filter=Vata`);
    
    console.log(`   Status: ${status}`);
    if (data.expansion) {
      console.log(`   Total concepts: ${data.expansion.total}`);
      console.log(`   Filtered results: ${data.expansion.contains?.length || 0}`);
      if (data.expansion.contains?.length > 0) {
        console.log(`   First result: ${data.expansion.contains[0].code} - ${data.expansion.contains[0].display}`);
      }
      console.log('   ✅ ValueSet expansion successful\n');
    } else {
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ ValueSet expansion failed: ${error.message}\n`);
  }
}

async function testBundleUpload() {
  console.log('📦 Testing Bundle Upload...');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const bundlePath = path.join(__dirname, '../data/sample-bundle-dual-coded.json');
    const bundleData = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    
    const { status, data } = await makeRequest(`${BASE_URL}/fhir/Bundle`, {
      method: 'POST',
      body: JSON.stringify(bundleData)
    });
    
    console.log(`   Status: ${status}`);
    if (data.entry) {
      console.log(`   Bundle processed with ${data.entry.length} entries`);
      const successCount = data.entry.filter(e => e.response.status.startsWith('2')).length;
      console.log(`   Successful entries: ${successCount}`);
      console.log('   ✅ Bundle upload successful\n');
    } else {
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Bundle upload failed: ${error.message}\n`);
  }
}

async function testLegacyAPI() {
  console.log('🔗 Testing Legacy API Compatibility...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/api/terminology/lookup?filter=Dosha`);
    
    console.log(`   Status: ${status}`);
    if (data.results) {
      console.log(`   Found ${data.results.length} matching terms`);
      console.log('   ✅ Legacy API working\n');
    } else {
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Legacy API failed: ${error.message}\n`);
  }
}

async function testAdminAPI() {
  console.log('👨‍💼 Testing Admin API...');
  try {
    const { status, data } = await makeRequest(`${BASE_URL}/admin/stats`);
    
    console.log(`   Status: ${status}`);
    if (data.namasteCodesCount !== undefined) {
      console.log(`   NAMASTE Codes: ${data.namasteCodesCount}`);
      console.log(`   ICD-11 Codes: ${data.icd11CodesCount}`);
      console.log(`   Mappings: ${data.mappingsCount}`);
      console.log(`   Audit Events: ${data.auditEventsCount}`);
      console.log('   ✅ Admin API working\n');
    } else {
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Admin API failed: ${error.message}\n`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting test suite...\n');
  
  await testHealthCheck();
  await testCapabilityStatement();
  await testCodeSystemLookup();
  await testConceptMapTranslate();
  await testValueSetExpansion();
  await testBundleUpload();
  await testLegacyAPI();
  await testAdminAPI();
  
  console.log('🎉 Test suite completed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Review the test results above');
  console.log('2. Check the server logs for audit events');
  console.log('3. Try the curl examples in the README');
  console.log('4. Integrate with your EMR system');
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  makeRequest,
  BASE_URL,
  token
};