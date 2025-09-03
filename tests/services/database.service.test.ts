import mysql from 'mysql2/promise';
import DatabaseService from '../../src/services/database.service';
import config from '../../src/config/index';

// Mock dependencies
jest.mock('mysql2/promise');
jest.mock('../../src/observability/logging/index.js');
jest.mock('../../src/config/index');

// Import after mocking
import logger from '../../src/observability/logging/index.js';

// Type the mocked modules
const mockedMySQL = mysql as jest.Mocked<typeof mysql>;
const mockedConfig = config as jest.Mocked<typeof config>;

// Mock pool and connection
const mockConnection = {
  ping: jest.fn(),
  release: jest.fn(),
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

const mockPool = {
  getConnection: jest.fn(),
  execute: jest.fn(),
  end: jest.fn(),
};

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions
    mockConnection.ping.mockReset();
    mockConnection.release.mockReset();
    mockConnection.execute.mockReset();
    mockConnection.beginTransaction.mockReset();
    mockConnection.commit.mockReset();
    mockConnection.rollback.mockReset();

    mockPool.getConnection.mockReset();
    mockConnection.execute.mockReset();
    mockPool.end.mockReset();

    // Setup config mock
    mockedConfig.database = {
      host: 'localhost',
      port: 3306,
      user: 'testuser',
      password: 'testpass',
      name: 'testdb',
    };

    // Setup MySQL mock
    mockedMySQL.createPool.mockReturnValue(mockPool as any);
    mockPool.getConnection.mockResolvedValue(mockConnection as any);

    // Reset singleton instance for each test
    (DatabaseService as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();

      expect(instance1).toBe(instance2);
      expect(mockedMySQL.createPool).toHaveBeenCalledTimes(1);
    });

    it('should create pool with correct configuration', () => {
      DatabaseService.getInstance();

      expect(mockedMySQL.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    });
  });

  describe('testConnection', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
      dbService = DatabaseService.getInstance();
    });

    it('should successfully test database connection', async () => {
      mockConnection.ping.mockResolvedValue(undefined);

      await expect(dbService.testConnection()).resolves.not.toThrow();

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('✅ Database connection successful');
    });

    it('should handle connection failure', async () => {
      const mockError = new Error('Connection refused');
      mockPool.getConnection.mockRejectedValue(mockError);

      await expect(dbService.testConnection()).rejects.toThrow('Connection refused');

      expect(logger.error).toHaveBeenCalledWith('❌ Database connection failed:', mockError);
    });

    it('should handle ping failure', async () => {
      const mockError = new Error('Ping failed');
      mockConnection.ping.mockRejectedValue(mockError);

      await expect(dbService.testConnection()).rejects.toThrow('Ping failed');

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled(); // Now fixed to release on error
      expect(logger.error).toHaveBeenCalledWith('❌ Database connection failed:', mockError);
    });

    it('should release connection even if ping fails', async () => {
      const mockError = new Error('Ping failed');
      mockConnection.ping.mockRejectedValue(mockError);

      await expect(dbService.testConnection()).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalled(); // Now works correctly
    });
  });

  describe('query', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
      dbService = DatabaseService.getInstance();
    });

    it('should execute query successfully without parameters', async () => {
      const mockResults = [{ id: 1, name: 'test' }];
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query('SELECT * FROM users');

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT * FROM users', []);
    });

    it('should execute query successfully with parameters', async () => {
      const mockResults = [{ id: 1, name: 'John' }];
      const sql = 'SELECT * FROM users WHERE id = ?';
      const params = [1];
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, params);

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith(sql, params);
    });

    it('should handle query execution errors', async () => {
      const mockError = new Error('Table does not exist');
      const sql = 'SELECT * FROM nonexistent_table';
      mockConnection.execute.mockRejectedValue(mockError);

      await expect(dbService.query(sql)).rejects.toThrow('Table does not exist');

      expect(logger.error).toHaveBeenCalledWith('❌ Database query failed:', {
        sql,
        params: [],
        error: mockError,
      });
    });

    it('should handle query with empty parameters array', async () => {
      const mockResults: any[] = [];
      const sql = 'SELECT * FROM users WHERE active = ?';
      const params: any[] = [];
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, params);

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith(sql, params);
    });

    it('should handle complex query parameters', async () => {
      const mockResults = [{ count: 5 }];
      const sql = 'SELECT COUNT(*) as count FROM users WHERE age > ? AND city = ? AND active = ?';
      const params = [25, 'New York', true];
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, params);

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith(sql, params);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('transaction', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
      dbService = DatabaseService.getInstance();
    });

    it('should execute transaction successfully and commit', async () => {
      const mockResult = { insertId: 123 };
      const callback = jest.fn().mockResolvedValue(mockResult);

      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.commit.mockResolvedValue(undefined);

      const result = await dbService.transaction(callback);

      expect(result).toEqual(mockResult);
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
    });

    it('should rollback transaction on callback error', async () => {
      const mockError = new Error('Transaction callback failed');
      const callback = jest.fn().mockRejectedValue(mockError);

      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.rollback.mockResolvedValue(undefined);

      await expect(dbService.transaction(callback)).rejects.toThrow('Transaction callback failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should rollback transaction on begin transaction error', async () => {
      const mockError = new Error('Begin transaction failed');
      const callback = jest.fn();

      mockConnection.beginTransaction.mockRejectedValue(mockError);
      mockConnection.rollback.mockResolvedValue(undefined);

      await expect(dbService.transaction(callback)).rejects.toThrow('Begin transaction failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should rollback transaction on commit error', async () => {
      const mockResult = { insertId: 123 };
      const mockCommitError = new Error('Commit failed');
      const callback = jest.fn().mockResolvedValue(mockResult);

      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.commit.mockRejectedValue(mockCommitError);
      mockConnection.rollback.mockResolvedValue(undefined);

      await expect(dbService.transaction(callback)).rejects.toThrow('Commit failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should release connection even if rollback fails', async () => {
      const mockError = new Error('Callback failed');
      const mockRollbackError = new Error('Rollback failed');
      const callback = jest.fn().mockRejectedValue(mockError);

      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.rollback.mockRejectedValue(mockRollbackError);

      // Should throw the rollback error since the actual implementation doesn't preserve the original error
      await expect(dbService.transaction(callback)).rejects.toThrow('Rollback failed');

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should handle complex transaction with multiple operations', async () => {
      const callback = jest.fn().mockImplementation(async (connection) => {
        // Simulate multiple database operations
        await connection.execute('INSERT INTO users (name) VALUES (?)', ['John']);
        await connection.execute('UPDATE profiles SET updated_at = NOW() WHERE user_id = ?', [1]);
        return { success: true, operationsCount: 2 };
      });

      mockConnection.beginTransaction.mockResolvedValue(undefined);
      mockConnection.commit.mockResolvedValue(undefined);
      mockConnection.execute.mockResolvedValue([{ insertId: 1 }, {}] as any);

      const result = await dbService.transaction(callback);

      expect(result).toEqual({ success: true, operationsCount: 2 });
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
      dbService = DatabaseService.getInstance();
    });

    it('should close pool successfully', async () => {
      mockPool.end.mockResolvedValue(undefined);

      await dbService.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('🔌 Database connection pool closed');
    });

    it('should handle pool close errors', async () => {
      const mockError = new Error('Failed to close pool');
      mockPool.end.mockRejectedValue(mockError);

      await dbService.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('❌ Error closing database connection pool:', mockError);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
      dbService = DatabaseService.getInstance();
    });

    it('should handle connection pool exhaustion', async () => {
      const mockError = new Error('Pool is exhausted');
      mockPool.getConnection.mockRejectedValue(mockError);

      await expect(dbService.testConnection()).rejects.toThrow('Pool is exhausted');
    });

    it('should handle SQL injection attempt (should be prevented by parameterized queries)', async () => {
      const maliciousInput = ["'; DROP TABLE users; --"];
      const sql = 'SELECT * FROM users WHERE name = ?';
      const mockResults: any[] = []; // No results as expected for parameterized query
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, maliciousInput);

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith(sql, maliciousInput);
      // The SQL injection should be safely handled by parameterized queries
    });

    it('should handle null and undefined parameters', async () => {
      const mockResults = [{ id: 1, name: null }];
      const sql = 'SELECT * FROM users WHERE name = ? OR description = ?';
      const params = [null, undefined];
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, params);

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith(sql, params);
    });

    it('should handle empty result sets', async () => {
      const mockResults: any[] = [];
      const sql = 'SELECT * FROM users WHERE id = ?';
      const params = [999999]; // Non-existent ID
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, params);

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle very long query strings', async () => {
      const longFieldList = Array.from({ length: 100 }, (_, i) => `field${i}`).join(', ');
      const sql = `SELECT ${longFieldList} FROM users WHERE id = ?`;
      const params = [1];
      const mockResults = [{ field0: 'value0', field1: 'value1' }];
      mockConnection.execute.mockResolvedValue([mockResults, {}] as any);

      const result = await dbService.query(sql, params);

      expect(result).toEqual(mockResults);
      expect(mockConnection.execute).toHaveBeenCalledWith(sql, params);
    });
  });
});
