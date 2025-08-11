import mysql from 'mysql2/promise';
import logger from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

class Database {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'notification_service',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10')
    };
  }

  async connect(): Promise<void> {
    try {
      this.pool = mysql.createPool(this.config);
      
      // Test the connection
      const connection = await this.pool.getConnection();
      logger.info('Database connected successfully');
      connection.release();
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }

  getPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  async query(sql: string, params?: any[]): Promise<any> {
    const pool = this.getPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch (error) {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    return this.isConnected();
  }
}

const database = new Database();
export default database;
