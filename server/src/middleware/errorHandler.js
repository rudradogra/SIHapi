const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);

  // Default error response
  let statusCode = 500;
  let operationOutcome = {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'exception',
        diagnostics: 'Internal server error'
      }
    ]
  };

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    operationOutcome.issue[0].code = 'invalid';
    operationOutcome.issue[0].diagnostics = error.message;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    operationOutcome.issue[0].code = 'login';
    operationOutcome.issue[0].diagnostics = 'Authentication required';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    operationOutcome.issue[0].code = 'forbidden';
    operationOutcome.issue[0].diagnostics = 'Access denied';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    operationOutcome.issue[0].code = 'not-found';
    operationOutcome.issue[0].diagnostics = 'Resource not found';
  } else if (error.message) {
    operationOutcome.issue[0].diagnostics = error.message;
  }

  res.status(statusCode).json(operationOutcome);
};

module.exports = errorHandler;