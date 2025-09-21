const { v4: uuidv4 } = require('uuid');

/**
 * FHIR AuditEvent logging middleware
 * Logs all API requests and responses for compliance and monitoring
 */
const auditMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const auditEventId = uuidv4();

  // Capture request details
  const auditData = {
    eventId: auditEventId,
    eventType: 'rest',
    action: getAuditAction(req.method),
    outcome: 'success', // Will be updated based on response
    userId: null, // Will be set by auth middleware
    sourceIp: getClientIP(req),
    userAgent: req.get('User-Agent') || 'Unknown',
    resourceType: extractResourceType(req.path),
    resourceId: extractResourceId(req.path),
    requestMethod: req.method,
    requestUrl: req.originalUrl,
    responseStatus: null, // Will be set in response
    timestamp: new Date().toISOString(),
    details: {
      requestHeaders: sanitizeHeaders(req.headers),
      queryParams: req.query,
      bodySize: req.get('Content-Length') || 0
    }
  };

  // Override res.json to capture response details
  const originalJson = res.json;
  res.json = function(body) {
    auditData.responseStatus = res.statusCode;
    auditData.outcome = res.statusCode >= 400 ? 'failure' : 'success';
    auditData.details.responseTime = Date.now() - startTime;
    auditData.details.responseSize = JSON.stringify(body).length;

    // Add user info if available (set by auth middleware)
    if (req.user) {
      auditData.userId = req.user.id;
      auditData.details.username = req.user.username;
      auditData.details.role = req.user.role;
    }

    // Log to database asynchronously
    setImmediate(() => {
      logAuditEvent(req.db, auditData);
    });

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Get audit action based on HTTP method
 */
function getAuditAction(method) {
  const actionMap = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };
  return actionMap[method] || 'execute';
}

/**
 * Extract client IP address
 */
function getClientIP(req) {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
}

/**
 * Extract resource type from URL path
 */
function extractResourceType(path) {
  const matches = path.match(/\/fhir\/([A-Z][a-zA-Z]+)/);
  if (matches) {
    return matches[1];
  }
  
  // Check for operation endpoints
  if (path.includes('$lookup')) return 'CodeSystem';
  if (path.includes('$translate')) return 'ConceptMap';
  if (path.includes('$expand')) return 'ValueSet';
  
  return null;
}

/**
 * Extract resource ID from URL path
 */
function extractResourceId(path) {
  const matches = path.match(/\/fhir\/[A-Z][a-zA-Z]+\/([^/\?]+)/);
  return matches ? matches[1] : null;
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  delete sanitized.authorization;
  delete sanitized.cookie;
  delete sanitized['x-api-key'];
  return sanitized;
}

/**
 * Log audit event to database
 */
async function logAuditEvent(db, auditData) {
  if (!db) {
    console.warn('Database not available for audit logging');
    return;
  }

  try {
    await db.run(`
      INSERT INTO audit_events (
        event_id, event_type, action, outcome, user_id, source_ip, user_agent,
        resource_type, resource_id, request_method, request_url, response_status,
        timestamp, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      auditData.eventId,
      auditData.eventType,
      auditData.action,
      auditData.outcome,
      auditData.userId,
      auditData.sourceIp,
      auditData.userAgent,
      auditData.resourceType,
      auditData.resourceId,
      auditData.requestMethod,
      auditData.requestUrl,
      auditData.responseStatus,
      auditData.timestamp,
      JSON.stringify(auditData.details)
    ]);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Audit Event:', {
        id: auditData.eventId,
        action: auditData.action,
        outcome: auditData.outcome,
        user: auditData.userId,
        resource: auditData.resourceType,
        status: auditData.responseStatus,
        responseTime: auditData.details.responseTime + 'ms'
      });
    }

  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Create FHIR AuditEvent resource from audit data
 */
function createFHIRAuditEvent(auditData) {
  const auditEvent = {
    resourceType: 'AuditEvent',
    id: auditData.eventId,
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
      code: 'rest',
      display: 'RESTful Operation'
    },
    subtype: [
      {
        system: 'http://hl7.org/fhir/restful-interaction',
        code: auditData.action,
        display: auditData.action
      }
    ],
    action: auditData.action.toUpperCase().charAt(0),
    recorded: auditData.timestamp,
    outcome: auditData.outcome === 'success' ? '0' : '4',
    agent: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/extra-security-role-type',
              code: 'humanuser',
              display: 'Human User'
            }
          ]
        },
        who: {
          identifier: {
            value: auditData.userId || 'anonymous'
          }
        },
        requestor: true,
        network: {
          address: auditData.sourceIp,
          type: '2'
        }
      }
    ],
    source: {
      site: 'AYUSH Terminology Service',
      identifier: {
        value: 'ayush-terminology-server'
      },
      type: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/security-source-type',
          code: '4',
          display: 'Application Server'
        }
      ]
    }
  };

  // Add entity if resource was accessed
  if (auditData.resourceType) {
    auditEvent.entity = [
      {
        what: {
          reference: `${auditData.resourceType}/${auditData.resourceId || 'unknown'}`
        },
        type: {
          system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
          code: '2',
          display: 'System Object'
        },
        lifecycle: {
          system: 'http://terminology.hl7.org/CodeSystem/dicom-audit-lifecycle',
          code: '6',
          display: 'Access / Use'
        }
      }
    ];
  }

  return auditEvent;
}

/**
 * Get audit events with optional filtering
 */
async function getAuditEvents(db, filters = {}) {
  let query = 'SELECT * FROM audit_events WHERE 1=1';
  const params = [];

  if (filters.userId) {
    query += ' AND user_id = ?';
    params.push(filters.userId);
  }

  if (filters.resourceType) {
    query += ' AND resource_type = ?';
    params.push(filters.resourceType);
  }

  if (filters.action) {
    query += ' AND action = ?';
    params.push(filters.action);
  }

  if (filters.outcome) {
    query += ' AND outcome = ?';
    params.push(filters.outcome);
  }

  if (filters.startDate) {
    query += ' AND timestamp >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND timestamp <= ?';
    params.push(filters.endDate);
  }

  query += ' ORDER BY timestamp DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const events = await db.all(query, params);
  
  return events.map(event => ({
    ...event,
    details: JSON.parse(event.details || '{}')
  }));
}

module.exports = {
  auditMiddleware,
  createFHIRAuditEvent,
  getAuditEvents,
  logAuditEvent
};