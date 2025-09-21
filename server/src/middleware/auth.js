const jwt = require('jsonwebtoken');

/**
 * Mock OAuth2/ABHA Authentication Middleware
 * In production, this would validate against real ABHA authentication service
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'login',
            diagnostics: 'Missing or invalid Authorization header. Expected: Bearer <token>'
          }
        ]
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // For MVP, we'll use simple JWT validation
    // In production, this would validate against ABHA/ABDM authentication service
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      
      // Attach user info to request
      req.user = {
        id: decoded.sub || decoded.userId,
        username: decoded.username,
        role: decoded.role || 'user',
        abhaId: decoded.abhaId,
        facilityId: decoded.facilityId,
        scope: decoded.scope || ['read']
      };

      // Log authentication for audit
      req.authEvent = {
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        timestamp: new Date().toISOString()
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'expired',
              diagnostics: 'Authentication token has expired'
            }
          ]
        });
      }

      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'invalid',
              diagnostics: 'Invalid authentication token'
            }
          ]
        });
      }

      throw jwtError;
    }

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'exception',
          diagnostics: 'Internal authentication error'
        }
      ]
    });
  }
};

/**
 * Generate a mock JWT token for testing
 * In production, tokens would be issued by ABHA/ABDM service
 */
const generateMockToken = (userInfo = {}) => {
  const payload = {
    sub: userInfo.userId || 'mock-user-123',
    username: userInfo.username || 'test-clinician',
    role: userInfo.role || 'clinician',
    abhaId: userInfo.abhaId || 'mock-abha-id',
    facilityId: userInfo.facilityId || 'mock-facility-123',
    scope: userInfo.scope || ['read', 'write'],
    iss: 'ayush-terminology-service',
    aud: 'ayush-clients',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret');
};

/**
 * Role-based authorization middleware
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'login',
            diagnostics: 'Authentication required'
          }
        ]
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'forbidden',
            diagnostics: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`
          }
        ]
      });
    }

    next();
  };
};

/**
 * Scope-based authorization middleware
 */
const requireScope = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.user || !req.user.scope) {
      return res.status(401).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'login',
            diagnostics: 'Authentication required'
          }
        ]
      });
    }

    const userScopes = Array.isArray(req.user.scope) ? req.user.scope : [req.user.scope];
    const hasRequiredScope = requiredScopes.some(scope => userScopes.includes(scope));

    if (!hasRequiredScope) {
      return res.status(403).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'forbidden',
            diagnostics: `Insufficient scope. Required scopes: ${requiredScopes.join(', ')}`
          }
        ]
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  generateMockToken,
  requireRole,
  requireScope
};