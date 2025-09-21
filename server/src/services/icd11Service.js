const axios = require('axios');

class ICD11Service {
  constructor(db) {
    this.db = db;
    this.baseURL = 'https://id.who.int';
    this.tokenURL = 'https://icdaccessmanagement.who.int/connect/token';
    this.clientId = process.env.ICD11_CLIENT_ID;
    this.clientSecret = process.env.ICD11_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Authenticate with WHO ICD-11 API
  async authenticate() {
    try {
      console.log('🔐 Authenticating with ICD-11 API...');
      
      if (!this.clientId || !this.clientSecret) {
        throw new Error('ICD-11 credentials not configured. Please set ICD11_CLIENT_ID and ICD11_CLIENT_SECRET environment variables.');
      }

      const response = await axios.post(this.tokenURL, 
        'grant_type=client_credentials&scope=icdapi_access',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      console.log('✅ Successfully authenticated with ICD-11 API');
      return this.accessToken;
      
    } catch (error) {
      console.error('❌ Failed to authenticate with ICD-11 API:', error.response?.data || error.message);
      throw new Error(`ICD-11 authentication failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Check if token is valid and refresh if needed
  async ensureValidToken() {
    if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  // Search ICD-11 entities
  async searchEntities(query, useLinearization = true) {
    try {
      await this.ensureValidToken();
      
      const searchURL = useLinearization 
        ? `${this.baseURL}/icd/release/11/2024-01/mms/search`
        : `${this.baseURL}/icd/entity/search`;
      
      const response = await axios.get(searchURL, {
        params: {
          q: query,
          flatResults: true,
          releaseId: '2024-01'
        },
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'API-Version': 'v2',
          'Accept-Language': 'en'
        }
      });

      return response.data.destinationEntities || response.data;
      
    } catch (error) {
      console.error('❌ Error searching ICD-11 entities:', error.response?.data || error.message);
      throw new Error(`ICD-11 search failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get specific ICD-11 entity by URI
  async getEntity(entityURI) {
    try {
      await this.ensureValidToken();
      
      // Convert http to https if needed
      const uri = entityURI.replace('http://', 'https://');
      
      const response = await axios.get(uri, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'API-Version': 'v2',
          'Accept-Language': 'en'
        }
      });

      return this.normalizeEntity(response.data);
      
    } catch (error) {
      console.error('❌ Error fetching ICD-11 entity:', error.response?.data || error.message);
      throw new Error(`Failed to fetch ICD-11 entity: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get linearization entity (for codes)
  async getLinearizationEntity(entityURI, linearization = 'mms') {
    try {
      await this.ensureValidToken();
      
      const uri = entityURI.replace('http://', 'https://').replace('/entity/', `/release/11/2024-01/${linearization}/`);
      
      const response = await axios.get(uri, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
          'API-Version': 'v2',
          'Accept-Language': 'en'
        }
      });

      return this.normalizeLinearizationEntity(response.data);
      
    } catch (error) {
      console.error('❌ Error fetching ICD-11 linearization entity:', error.response?.data || error.message);
      throw new Error(`Failed to fetch ICD-11 linearization entity: ${error.response?.data?.error || error.message}`);
    }
  }

  // Normalize entity data structure
  normalizeEntity(response) {
    if (!response) return null;

    return {
      id: response['@id'],
      title: (response.title && response.title['@value']) || response.title,
      definition: (response.definition && response.definition['@value']) || response.definition,
      longDefinition: (response.longDefinition && response.longDefinition['@value']) || response.longDefinition,
      fullySpecifiedName: (response.fullySpecifiedName && response.fullySpecifiedName['@value']) || response.fullySpecifiedName,
      synonym: response.synonym ? response.synonym.map(s => s['@value'] || s) : [],
      inclusion: response.inclusion ? response.inclusion.map(i => i['@value'] || i) : [],
      exclusion: response.exclusion ? response.exclusion.map(e => e['@value'] || e) : [],
      codingNote: (response.codingNote && response.codingNote['@value']) || response.codingNote,
      parent: response.parent ? response.parent.map(p => p['@id'] || p) : []
    };
  }

  // Normalize linearization entity data structure  
  normalizeLinearizationEntity(response) {
    if (!response) return null;

    return {
      id: response['@id'],
      code: response.code,
      title: (response.title && response.title['@value']) || response.title,
      definition: (response.definition && response.definition['@value']) || response.definition,
      longDefinition: (response.longDefinition && response.longDefinition['@value']) || response.longDefinition,
      codingNote: (response.codingNote && response.codingNote['@value']) || response.codingNote,
      blockId: response.blockId,
      codeRange: response.codeRange,
      classKind: response.classKind,
      child: response.child ? response.child.map(c => c['@id'] || c) : [],
      parent: response.parent ? response.parent.map(p => p['@id'] || p) : []
    };
  }

  // Store ICD-11 codes in database
  async storeICD11Code(entityData) {
    try {
      const query = `
        INSERT OR REPLACE INTO icd11_codes 
        (code, display, system_uri, description, status)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const params = [
        entityData.code || entityData.id,
        entityData.title,
        'http://id.who.int/icd/release/11/mms',
        entityData.definition || entityData.longDefinition,
        'active'
      ];
      
      return new Promise((resolve, reject) => {
        this.db.db.run(query, params, function(err) {
          if (err) {
            console.error('❌ Error storing ICD-11 code:', err.message);
            reject(err);
          } else {
            console.log(`✅ Stored ICD-11 code: ${entityData.code || entityData.id}`);
            resolve(this.lastID);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error storing ICD-11 code:', error.message);
      throw error;
    }
  }

  // Get stored ICD-11 codes from database
  async getStoredICD11Codes(limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM icd11_codes 
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      return new Promise((resolve, reject) => {
        this.db.db.all(query, [limit, offset], (err, rows) => {
          if (err) {
            console.error('❌ Error fetching stored ICD-11 codes:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error fetching stored ICD-11 codes:', error.message);
      throw error;
    }
  }

  // Search stored ICD-11 codes
  async searchStoredICD11Codes(query) {
    try {
      const searchQuery = `
        SELECT * FROM icd11_codes 
        WHERE status = 'active' AND (
          code LIKE ? OR 
          display LIKE ? OR 
          description LIKE ?
        )
        ORDER BY 
          CASE 
            WHEN code LIKE ? THEN 1
            WHEN display LIKE ? THEN 2
            ELSE 3
          END,
          display
        LIMIT 50
      `;
      
      const searchTerm = `%${query}%`;
      const exactTerm = `${query}%`;
      
      return new Promise((resolve, reject) => {
        this.db.db.all(searchQuery, [searchTerm, searchTerm, searchTerm, exactTerm, exactTerm], (err, rows) => {
          if (err) {
            console.error('❌ Error searching stored ICD-11 codes:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error searching stored ICD-11 codes:', error.message);
      throw error;
    }
  }
}

module.exports = ICD11Service;