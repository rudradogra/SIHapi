# AYUSH-ICD11 Terminology Micro-Service MVP

A FHIR R4 compliant microservice for mapping NAMASTE (AYUSH) codes to ICD-11 codes, enabling dual-coding in electronic health records for traditional Indian medicine systems.

## 🎯 Overview

This MVP enables clinicians to:
- Record AYUSH diagnoses using NAMASTE codes (Ayurveda, Siddha, Unani)
- Automatically map them to WHO ICD-11 codes
- Support dual-coding for interoperability
- Comply with India's 2016 EHR Standards and FHIR R4

## 🛠️ Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite (for MVP)
- **FHIR**: FHIR R4 compliant endpoints
- **Authentication**: JWT-based OAuth2 mock (ABHA-ready)
- **Security**: Helmet, CORS, audit logging

## 📁 Project Structure

```
server/
├── src/
│   ├── app.js                 # Main application server
│   ├── models/
│   │   └── database.js        # SQLite database model
│   ├── services/
│   │   ├── fhirCodeSystemService.js    # FHIR CodeSystem operations
│   │   └── fhirConceptMapService.js    # FHIR ConceptMap operations
│   ├── routes/
│   │   ├── fhir.js            # FHIR R4 endpoints
│   │   ├── admin.js           # Administration endpoints
│   │   └── terminology.js     # Legacy API endpoints
│   ├── middleware/
│   │   ├── auth.js            # Authentication middleware
│   │   ├── audit.js           # Audit logging middleware
│   │   └── errorHandler.js    # Error handling
│   └── utils/
├── data/
│   ├── sample-namaste-codes.csv       # Sample NAMASTE codes
│   └── sample-bundle-dual-coded.json  # Sample FHIR Bundle
├── scripts/
│   ├── init-database.js       # Database initialization
│   └── test-api.js           # API testing script
├── logs/                     # Application logs
├── package.json
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone and navigate to server directory**
   ```bash
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

4. **Initialize database**
   ```bash
   npm run init-db
   ```

5. **Start the server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

### Verification

1. **Health check**
   ```bash
   curl http://localhost:3000/health
   ```

2. **FHIR Capability Statement**
   ```bash
   curl http://localhost:3000/fhir/metadata
   ```

3. **Run test suite**
   ```bash
   node scripts/test-api.js
   ```

## 📚 API Documentation

### Base URLs

- **FHIR Endpoint**: `http://localhost:3000/fhir`
- **Admin Endpoint**: `http://localhost:3000/admin`
- **Legacy API**: `http://localhost:3000/api/terminology`

### Authentication

For admin endpoints, include the Bearer token:

```bash
# Generate a test token (for MVP testing)
node -e "console.log(require('./src/middleware/auth').generateMockToken())"

# Use in requests
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/admin/stats
```

### Key Endpoints

#### 1. ValueSet Lookup
Find matching NAMASTE terms:

```bash
# Basic search
curl "http://localhost:3000/fhir/ValueSet/\$expand?filter=Vata"

# Filter by system
curl "http://localhost:3000/fhir/ValueSet/\$expand?system=Ayurveda&filter=Dosha"

# Legacy API
curl "http://localhost:3000/api/terminology/lookup?filter=Dosha"
```

**Response Example:**
```json
{
  "resourceType": "ValueSet",
  "expansion": {
    "total": 3,
    "contains": [
      {
        "system": "http://terminology.ayush.gov.in/CodeSystem/namaste",
        "code": "AYU001",
        "display": "Vata Dosha Imbalance"
      }
    ]
  }
}
```

#### 2. ConceptMap Translation
Translate NAMASTE codes to ICD-11:

```bash
# FHIR operation
curl -X POST http://localhost:3000/fhir/ConceptMap/\$translate \
  -H "Content-Type: application/json" \
  -d '{
    "system": "http://terminology.ayush.gov.in/CodeSystem/namaste",
    "code": "AYU001"
  }'

# Legacy API
curl "http://localhost:3000/api/terminology/translate?code=AYU001"
```

**Response Example:**
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "result",
      "valueBoolean": true
    },
    {
      "name": "match",
      "part": [
        {
          "name": "equivalence",
          "valueCode": "equivalent"
        },
        {
          "name": "concept",
          "valueCoding": {
            "system": "http://id.who.int/icd/release/11/mms",
            "code": "MG30.0Z",
            "display": "Constitutional factors affecting health status"
          }
        }
      ]
    }
  ]
}
```

#### 3. Bundle Upload
Upload FHIR Bundle with dual-coded conditions:

```bash
curl -X POST http://localhost:3000/fhir/Bundle \
  -H "Content-Type: application/json" \
  -d @data/sample-bundle-dual-coded.json
```

#### 4. CodeSystem Lookup
Lookup specific codes:

```bash
curl -X POST http://localhost:3000/fhir/CodeSystem/\$lookup \
  -H "Content-Type: application/json" \
  -d '{
    "system": "http://terminology.ayush.gov.in/CodeSystem/namaste",
    "code": "AYU001"
  }'
```

#### 5. Admin Endpoints (Require Authentication)

```bash
# Get statistics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/admin/stats

# Import CSV data
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/admin/csv/import \
  -d '{"csvData": "code,display,system,specialty,description\nAYU011,New Code,Ayurveda,General,Test"}'

# Add new mapping
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/admin/mapping \
  -d '{
    "namasteCode": "AYU001",
    "icd11Code": "MG30.1Z",
    "equivalence": "equivalent",
    "confidence": 0.9
  }'
```

## 📊 Sample Data

The MVP includes sample data for:

### NAMASTE Codes
- **Ayurveda**: Vata/Pitta/Kapha dosha imbalances, Ama, Ojas, Agni conditions
- **Siddha**: Vayu/Azhal/Iya kutram, system-specific disorders  
- **Unani**: Mizaj (temperament) disorders, organ-specific conditions

### ICD-11 Mappings
- Constitutional factors (MG30.0Z)
- Lifestyle factors (MG30.1Z)
- Life management factors (MG30.2Z)

### Dual-Coded Conditions
Sample FHIR Bundle with conditions coded in both NAMASTE and ICD-11 systems.

## 🔧 Configuration

### Environment Variables (.env)

```env
NODE_ENV=development
PORT=3000
DB_PATH=./data/ayush-terminology.db
JWT_SECRET=your-super-secret-jwt-key
FHIR_BASE_URL=http://localhost:3000/fhir
LOG_LEVEL=info
```

### Database Schema

The SQLite database includes tables for:
- `namaste_codes` - NAMASTE terminology codes
- `icd11_codes` - ICD-11 reference codes  
- `concept_mappings` - Code mappings between systems
- `fhir_resources` - Cached FHIR resources
- `audit_events` - Security and usage audit logs

## 🔐 Security Features

### Authentication
- JWT-based token validation
- Mock OAuth2 implementation (ABHA-ready)
- Role-based access control
- Scope-based permissions

### Audit Logging
- All API requests logged as FHIR AuditEvents
- User tracking and IP logging
- Request/response timing and status
- Database persistence for compliance

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Content Security Policy
- Rate limiting ready

## 🧪 Testing

### Automated Test Suite
```bash
node scripts/test-api.js
```

Tests include:
- Health check
- FHIR capability statement
- CodeSystem operations
- ConceptMap translation
- ValueSet expansion
- Bundle processing
- Legacy API compatibility
- Admin functionality

### Manual Testing with curl

See the API documentation above for curl examples.

## 🚦 Production Readiness Checklist

### For Production Deployment:

1. **Database**
   - [ ] Replace SQLite with PostgreSQL/MySQL
   - [ ] Add connection pooling
   - [ ] Implement database migrations

2. **Authentication**
   - [ ] Integrate with real ABHA/ABDM service
   - [ ] Implement proper OAuth2 flow
   - [ ] Add refresh token support

3. **Security**
   - [ ] Enable HTTPS/TLS
   - [ ] Add rate limiting
   - [ ] Implement API key management
   - [ ] Set up WAF (Web Application Firewall)

4. **Monitoring**
   - [ ] Add structured logging (Winston)
   - [ ] Implement health metrics
   - [ ] Set up alerting
   - [ ] Add performance monitoring

5. **Data**
   - [ ] Sync with real WHO ICD-11 API
   - [ ] Import complete NAMASTE dataset
   - [ ] Validate mapping accuracy
   - [ ] Add versioning support

6. **Infrastructure**
   - [ ] Containerize with Docker
   - [ ] Set up CI/CD pipeline
   - [ ] Configure load balancing
   - [ ] Add backup/restore procedures

## 🤝 Integration Guide

### EMR Integration

To integrate with your EMR system:

1. **Authentication**: Obtain JWT tokens from your ABHA provider
2. **Dual Coding**: Use the translation endpoint to get ICD-11 codes
3. **Bundle Creation**: Structure conditions with both code systems
4. **Validation**: Use the bundle upload endpoint to validate dual-coding

### Example Integration Flow

```javascript
// 1. Lookup AYUSH diagnosis
const ayushDiagnosis = await fetch('/fhir/ValueSet/$expand?filter=Vata');

// 2. Translate to ICD-11
const icd11Mapping = await fetch('/fhir/ConceptMap/$translate', {
  method: 'POST',
  body: JSON.stringify({
    system: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
    code: 'AYU001'
  })
});

// 3. Create dual-coded condition
const condition = {
  resourceType: 'Condition',
  code: {
    coding: [
      {
        system: 'http://terminology.ayush.gov.in/CodeSystem/namaste',
        code: 'AYU001',
        display: 'Vata Dosha Imbalance',
        userSelected: true
      },
      {
        system: 'http://id.who.int/icd/release/11/mms',
        code: 'MG30.0Z',
        display: 'Constitutional factors affecting health status'
      }
    ]
  }
  // ... other condition fields
};
```

## 📞 Support

For questions or issues:
- Review the test suite output
- Check server logs in the `logs/` directory  
- Verify database connectivity
- Ensure proper environment configuration

## 📄 License

MIT License - see LICENSE file for details.

---

**Note**: This is an MVP implementation. For production use, implement the security, monitoring, and data integration improvements listed in the production checklist.