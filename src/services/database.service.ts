import mysql from 'mysql2/promise';
import config from '../config/index.js';
import logger from '../utils/logger.js';

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

  async query(sql: string, params?: any[]): Promise<any> {
    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      logger.error('❌ Database query failed:', { sql, params, error });
      throw error;
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
