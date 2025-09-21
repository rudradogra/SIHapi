require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Import services and middleware
const Database = require('./models/database');
const FHIRCodeSystemService = require('./services/fhirCodeSystemService');
const FHIRConceptMapService = require('./services/fhirConceptMapService');

// Import routes
const terminologyRoutes = require('./routes/terminology');
const fhirRoutes = require('./routes/fhir');
const adminRoutes = require('./routes/admin');

// Import middleware
const { authMiddleware } = require('./middleware/auth');
const { auditMiddleware } = require('./middleware/audit');
const errorHandler = require('./middleware/errorHandler');

class AyushTerminologyServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.db = null;
    this.codeSystemService = null;
    this.conceptMapService = null;
  }

  async initialize() {
    try {
      // Initialize database
      console.log('🔗 Connecting to database...');
      this.db = new Database(process.env.DB_PATH);
      await this.db.connect();
      
      // Initialize services
      this.codeSystemService = new FHIRCodeSystemService(this.db);
      this.conceptMapService = new FHIRConceptMapService(this.db);

      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.app.use(errorHandler);

      console.log('✅ Server initialized successfully');
      return this;
      
    } catch (error) {
      console.error('❌ Failed to initialize server:', error.message);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? 
        ['https://ayush.gov.in', 'https://abdm.gov.in'] : 
        true,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Make services available to routes
    this.app.use((req, res, next) => {
      req.db = this.db;
      req.codeSystemService = this.codeSystemService;
      req.conceptMapService = this.conceptMapService;
      next();
    });

    // Audit logging for all requests
    this.app.use(auditMiddleware);
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: 'connected',
          terminology: 'active'
        }
      });
    });

    // API documentation
    this.app.get('/', (req, res) => {
      res.json({
        name: 'AYUSH-ICD11 Terminology Micro-Service',
        version: '1.0.0',
        description: 'MVP for mapping NAMASTE codes to ICD-11 codes with FHIR R4 compliance',
        documentation: {
          endpoints: [
            'GET /health - Health check',
            'GET /fhir/metadata - FHIR capability statement',
            'GET /fhir/CodeSystem/{id} - Get CodeSystem',
            'GET /fhir/ConceptMap/{id} - Get ConceptMap',
            'GET /fhir/ValueSet/$expand - Expand ValueSet',
            'POST /fhir/CodeSystem/$lookup - Lookup code',
            'POST /fhir/ConceptMap/$translate - Translate code',
            'POST /fhir/Bundle - Upload Bundle',
            'POST /admin/csv/import - Import NAMASTE CSV',
            'GET /admin/stats - Get statistics'
          ]
        },
        contact: 'ayush-support@gov.in'
      });
    });

    // Mount route modules
    this.app.use('/fhir', fhirRoutes);
    this.app.use('/admin', authMiddleware, adminRoutes);
    
    // Legacy API routes for backward compatibility
    this.app.use('/api/terminology', terminologyRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
          'GET /health',
          'GET /fhir/metadata',
          'GET /fhir/CodeSystem/{id}',
          'GET /fhir/ConceptMap/{id}',
          'POST /fhir/CodeSystem/$lookup',
          'POST /fhir/ConceptMap/$translate'
        ]
      });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 AYUSH-ICD11 Terminology Service running on port ${this.port}`);
          console.log(`📍 Base URL: http://localhost:${this.port}`);
          console.log(`🏥 FHIR Endpoint: http://localhost:${this.port}/fhir`);
          console.log(`📊 Health Check: http://localhost:${this.port}/health`);
          resolve(server);
        }
      });
    });
  }

  async stop() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// Start server if called directly
if (require.main === module) {
  const server = new AyushTerminologyServer();
  
  server.initialize()
    .then(() => server.start())
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = AyushTerminologyServer;