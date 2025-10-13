import ErrorResponse from '../../src/shared/utils/ErrorResponse';

describe('ErrorResponse', () => {
  describe('Constructor', () => {
    it('should create an error with default values', () => {
      const error = new ErrorResponse('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('ErrorResponse');
      expect(error.details).toBeUndefined();
    });

    it('should create an error with custom values', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = new ErrorResponse('Custom error', 400, 'BAD_REQUEST', details);

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual(details);
      expect(error.isOperational).toBe(true);
    });

    it('should extend Error class properly', () => {
      const error = new ErrorResponse('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ErrorResponse);
      expect(error.stack).toBeDefined();
    });
  });

  describe('toJSON method', () => {
    it('should return properly formatted JSON without details', () => {
      const error = new ErrorResponse('Test error', 400, 'BAD_REQUEST');
      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Test error',
          statusCode: 400,
          details: undefined,
          timestamp: expect.any(String),
        },
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(json.error.timestamp)).toBeInstanceOf(Date);
    });

    it('should return properly formatted JSON with details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ErrorResponse('Validation failed', 422, 'VALIDATION_ERROR', details);
      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 422,
          details: details,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Static factory methods', () => {
    it('should create badRequest error', () => {
      const details = { field: 'name' };
      const error = ErrorResponse.badRequest('Invalid input', details);

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual(details);
    });

    it('should create unauthorized error with default message', () => {
      const error = ErrorResponse.unauthorized();

      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create unauthorized error with custom message', () => {
      const error = ErrorResponse.unauthorized('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create forbidden error', () => {
      const error = ErrorResponse.forbidden('Admin access required');

      expect(error.message).toBe('Admin access required');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create notFound error with default message', () => {
      const error = ErrorResponse.notFound();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create conflict error', () => {
      const details = { existing: 'user@example.com' };
      const error = ErrorResponse.conflict('Email already exists', details);

      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.details).toEqual(details);
    });

    it('should create validation error', () => {
      const details = { errors: ['Email is required', 'Password too short'] };
      const error = ErrorResponse.validation('Validation failed', details);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should create tooManyRequests error', () => {
      const error = ErrorResponse.tooManyRequests();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should create internal error with default message', () => {
      const error = ErrorResponse.internal();

      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create serviceUnavailable error', () => {
      const error = ErrorResponse.serviceUnavailable();

      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Error inheritance behavior', () => {
    it('should properly throw and catch ErrorResponse', () => {
      expect(() => {
        throw ErrorResponse.badRequest('Test error');
      }).toThrow(ErrorResponse);

      expect(() => {
        throw ErrorResponse.badRequest('Test error');
      }).toThrow('Test error');
    });

    it('should be catchable as Error', () => {
      try {
        throw ErrorResponse.notFound('User not found');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ErrorResponse);
        if (error instanceof ErrorResponse) {
          expect(error.statusCode).toBe(404);
          expect(error.code).toBe('NOT_FOUND');
        }
      }
    });
  });
});
