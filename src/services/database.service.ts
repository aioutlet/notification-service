import mysql from 'mysql2/promise';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Type for database operation results (INSERT, UPDATE, DELETE)
interface DatabaseResult {
  insertId?: number;
  affectedRows?: number;
  [key: string]: unknown;
}

class DatabaseService {
  private pool: mysql.Pool;
  private static instance: DatabaseService;

  private constructor() {
    this.pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async testConnection(): Promise<void> {
    let connection: mysql.PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      await connection.ping();
      logger.info('✅ Database connection successful');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Execute a query against the database
   * @param sql - The SQL query to execute
   * @param params - Parameters for the SQL query
   * @returns Promise<unknown[]> - The query result as an array
   */
  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    const connection = await this.pool.getConnection();
    try {
      const [result] = await connection.execute(sql, params);
      return result as unknown[];
    } catch (error) {
      logger.error('❌ Database query failed:', { sql, params, error });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute a query that returns metadata (INSERT, UPDATE, DELETE)
   * @param sql - The SQL query to execute
   * @param params - Parameters for the SQL query
   * @returns Promise<DatabaseResult> - The query result with metadata
   */
  async execute(sql: string, params: unknown[] = []): Promise<DatabaseResult> {
    const connection = await this.pool.getConnection();
    try {
      const [, result] = await connection.execute(sql, params);
      return result as unknown as DatabaseResult;
    } catch (error) {
      logger.error('❌ Database execute failed:', { sql, params, error });
      throw error;
    } finally {
      connection.release();
    }
  }

  async transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('🔌 Database connection pool closed');
    } catch (error) {
      logger.error('❌ Error closing database connection pool:', error);
    }
  }
}

export default DatabaseService;
