const fuzz = require('fuzzball');

class SimilarityMatcher {
  constructor(db) {
    this.db = db;
    this.similarityThreshold = 0.6; // Minimum similarity score to consider a match
    this.highConfidenceThreshold = 0.8; // High confidence threshold
  }

  // Calculate similarity between two text strings
  calculateSimilarity(text1, text2, method = 'ratio') {
    if (!text1 || !text2) return 0;
    
    // Normalize texts
    const normalizedText1 = this.normalizeText(text1);
    const normalizedText2 = this.normalizeText(text2);
    
    if (!normalizedText1 || !normalizedText2) return 0;
    
    // Use different similarity methods
    switch (method) {
      case 'ratio':
        return fuzz.ratio(normalizedText1, normalizedText2) / 100;
      case 'partial_ratio':
        return fuzz.partial_ratio(normalizedText1, normalizedText2) / 100;
      case 'token_sort_ratio':
        return fuzz.token_sort_ratio(normalizedText1, normalizedText2) / 100;
      case 'token_set_ratio':
        return fuzz.token_set_ratio(normalizedText1, normalizedText2) / 100;
      default:
        return fuzz.ratio(normalizedText1, normalizedText2) / 100;
    }
  }

  // Normalize text for better matching
  normalizeText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  // Calculate composite similarity score using multiple methods
  calculateCompositeSimilarity(text1, text2) {
    const methods = ['ratio', 'partial_ratio', 'token_sort_ratio', 'token_set_ratio'];
    const scores = methods.map(method => this.calculateSimilarity(text1, text2, method));
    
    // Weighted average (ratio gets higher weight)
    const weights = [0.4, 0.2, 0.2, 0.2];
    const weightedScore = scores.reduce((sum, score, index) => sum + (score * weights[index]), 0);
    
    return {
      composite: weightedScore,
      individual: {
        ratio: scores[0],
        partial_ratio: scores[1],
        token_sort_ratio: scores[2],
        token_set_ratio: scores[3]
      }
    };
  }

  // Find best matches for Ayurveda code against ICD-11 codes
  async findBestMatches(ayurvedaCode, icd11Codes, maxResults = 5) {
    const matches = [];
    
    // Create searchable text from Ayurveda code
    const ayurvedaSearchText = this.createSearchableText(ayurvedaCode);
    
    for (const icd11Code of icd11Codes) {
      const icd11SearchText = this.createSearchableText(icd11Code);
      
      // Calculate similarity
      const similarityResult = this.calculateCompositeSimilarity(ayurvedaSearchText, icd11SearchText);
      
      // Only include matches above threshold
      if (similarityResult.composite >= this.similarityThreshold) {
        matches.push({
          ayurveda_code: ayurvedaCode.code,
          icd11_code: icd11Code.code || icd11Code.id,
          icd11_display: icd11Code.display || icd11Code.title,
          similarity_score: similarityResult.composite,
          similarity_details: similarityResult.individual,
          confidence: this.getConfidenceLevel(similarityResult.composite),
          ayurveda_text: ayurvedaSearchText,
          icd11_text: icd11SearchText
        });
      }
    }
    
    // Sort by similarity score (descending) and return top results
    return matches
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, maxResults);
  }

  // Create searchable text from code object
  createSearchableText(codeObject) {
    const textParts = [];
    
    // Add various text fields
    if (codeObject.display) textParts.push(codeObject.display);
    if (codeObject.title) textParts.push(codeObject.title);
    if (codeObject.name_english) textParts.push(codeObject.name_english);
    if (codeObject.description) textParts.push(codeObject.description);
    if (codeObject.definition) textParts.push(codeObject.definition);
    if (codeObject.longDefinition) textParts.push(codeObject.longDefinition);
    if (codeObject.namc_term) textParts.push(codeObject.namc_term);
    if (codeObject.short_definition && codeObject.short_definition !== '-') {
      textParts.push(codeObject.short_definition);
    }
    if (codeObject.long_definition && codeObject.long_definition !== '-') {
      textParts.push(codeObject.long_definition);
    }
    
    // Add synonyms if available
    if (codeObject.synonym && Array.isArray(codeObject.synonym)) {
      textParts.push(...codeObject.synonym);
    }
    
    // Add inclusions if available
    if (codeObject.inclusion && Array.isArray(codeObject.inclusion)) {
      textParts.push(...codeObject.inclusion);
    }
    
    return textParts
      .filter(text => text && text !== '-' && text.trim() !== '')
      .join(' ');
  }

  // Get confidence level based on similarity score
  getConfidenceLevel(score) {
    if (score >= this.highConfidenceThreshold) return 'high';
    if (score >= this.similarityThreshold) return 'medium';
    return 'low';
  }

  // Find matches for all Ayurveda codes against ICD-11 codes
  async generateMappings(ayurvedaCodes, icd11Codes, options = {}) {
    const {
      maxMatchesPerCode = 3,
      saveToDatabase = true,
      overwriteExisting = false
    } = options;
    
    console.log(`🔍 Generating mappings for ${ayurvedaCodes.length} Ayurveda codes against ${icd11Codes.length} ICD-11 codes...`);
    
    const allMappings = [];
    
    for (let i = 0; i < ayurvedaCodes.length; i++) {
      const ayurvedaCode = ayurvedaCodes[i];
      
      console.log(`Processing ${i + 1}/${ayurvedaCodes.length}: ${ayurvedaCode.code} - ${ayurvedaCode.display}`);
      
      // Find matches for this Ayurveda code
      const matches = await this.findBestMatches(ayurvedaCode, icd11Codes, maxMatchesPerCode);
      
      for (const match of matches) {
        allMappings.push(match);
        
        // Save to database if requested
        if (saveToDatabase) {
          await this.saveMappingToDatabase(match, overwriteExisting);
        }
      }
      
      // Add small delay to prevent overwhelming the system
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Generated ${allMappings.length} total mappings`);
    
    // Group by confidence level
    const highConfidence = allMappings.filter(m => m.confidence === 'high');
    const mediumConfidence = allMappings.filter(m => m.confidence === 'medium');
    
    console.log(`📊 Mapping summary:`);
    console.log(`   - High confidence: ${highConfidence.length}`);
    console.log(`   - Medium confidence: ${mediumConfidence.length}`);
    
    return {
      all: allMappings,
      high: highConfidence,
      medium: mediumConfidence,
      stats: {
        total: allMappings.length,
        highConfidence: highConfidence.length,
        mediumConfidence: mediumConfidence.length
      }
    };
  }

  // Save mapping to database
  async saveMappingToDatabase(mapping, overwriteExisting = false) {
    try {
      const query = overwriteExisting 
        ? `INSERT OR REPLACE INTO concept_mappings 
           (namaste_code, icd11_code, equivalence, confidence, mapping_type, similarity_score, mapping_details)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        : `INSERT OR IGNORE INTO concept_mappings 
           (namaste_code, icd11_code, equivalence, confidence, mapping_type, similarity_score, mapping_details)
           VALUES (?, ?, ?, ?, ?, ?, ?)`;
      
      const mappingDetails = JSON.stringify({
        similarity_details: mapping.similarity_details,
        ayurveda_text: mapping.ayurveda_text,
        icd11_text: mapping.icd11_text
      });
      
      const params = [
        mapping.ayurveda_code,
        mapping.icd11_code,
        'equivalent', // Default equivalence
        mapping.similarity_score,
        'automatic',
        mapping.similarity_score,
        mappingDetails
      ];
      
      return new Promise((resolve, reject) => {
        this.db.db.run(query, params, function(err) {
          if (err) {
            console.error('❌ Error saving mapping:', err.message);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error saving mapping to database:', error.message);
      throw error;
    }
  }

  // Get stored mappings from database
  async getStoredMappings(filters = {}) {
    try {
      let query = `
        SELECT cm.*, nc.display as ayurveda_display, ic.display as icd11_display
        FROM concept_mappings cm
        LEFT JOIN namaste_codes nc ON cm.namaste_code = nc.code
        LEFT JOIN icd11_codes ic ON cm.icd11_code = ic.code
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.ayurveda_code) {
        query += ' AND cm.namaste_code = ?';
        params.push(filters.ayurveda_code);
      }
      
      if (filters.icd11_code) {
        query += ' AND cm.icd11_code = ?';
        params.push(filters.icd11_code);
      }
      
      if (filters.min_confidence) {
        query += ' AND cm.confidence >= ?';
        params.push(filters.min_confidence);
      }
      
      if (filters.mapping_type) {
        query += ' AND cm.mapping_type = ?';
        params.push(filters.mapping_type);
      }
      
      query += ' ORDER BY cm.confidence DESC, cm.created_at DESC';
      
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }
      
      return new Promise((resolve, reject) => {
        this.db.db.all(query, params, (err, rows) => {
          if (err) {
            console.error('❌ Error fetching stored mappings:', err.message);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error fetching stored mappings:', error.message);
      throw error;
    }
  }
}

module.exports = SimilarityMatcher;