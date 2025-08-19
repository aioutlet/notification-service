import mysql, { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface NotificationStats extends RowDataPacket {
  status: string;
  count: number;
}

interface TemplateStats extends RowDataPacket {
  count: number;
}

class NotificationDatabaseSeeder {
  private config: DatabaseConfig;
  private connection!: Connection;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'notification_user',
      password: process.env.DB_PASSWORD || 'notification_pass',
      database: process.env.DB_NAME || 'notification_service_dev',
    };
  }

  async createConnection(): Promise<void> {
    console.log('🔌 Connecting to MySQL database...');
    this.connection = await mysql.createConnection(this.config);
    console.log('✅ Connected to notification database');
  }

  async runSchemas(): Promise<void> {
    console.log('📋 Running notification service schemas...');

    try {
      const schemaPath = path.join(__dirname, '..', 'schemas', 'notifications.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');

      console.log('Running schema: notifications.sql');

      // Split by semicolon and execute each statement
      const statements = schema.split(';').filter((stmt) => stmt.trim().length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          await this.connection.execute(statement.trim());
        }
      }

      console.log('✅ Schema created successfully');
    } catch (error) {
      console.error('❌ Error running schemas:', error);
      throw error;
    }
  }

  async seedData(): Promise<void> {
    console.log('🌱 Seeding notification service data...');

    try {
      // Clear existing data first
      await this.clearData();

      // Seed sample data if it exists
      await this.seedSampleData();

      console.log('✅ Notification service data seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error seeding notification data:', error);
      throw error;
    }
  }

  async clearData(): Promise<void> {
    console.log('🗑️  Clearing existing notification data...');

    const clearQueries = [
      'DELETE FROM notifications;',
      'DELETE FROM notification_templates WHERE id > 5;', // Keep default templates
    ];

    for (const query of clearQueries) {
      await this.connection.execute(query);
    }

    console.log('✅ Existing data cleared');
  }

  async seedSampleData(): Promise<void> {
    const dataPath = path.join(__dirname, '..', 'data');

    try {
      const files = await fs.readdir(dataPath);
      const sqlFiles = files.filter((file) => file.endsWith('.sql'));

      if (sqlFiles.length === 0) {
        console.log('ℹ️  No sample data files found, skipping sample data insertion');
        return;
      }

      for (const file of sqlFiles) {
        console.log(`📦 Loading sample data: ${file}`);
        const filePath = path.join(dataPath, file);
        const data = await fs.readFile(filePath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = data.split(';').filter((stmt) => stmt.trim().length > 0);

        for (const statement of statements) {
          if (statement.trim()) {
            await this.connection.execute(statement.trim());
          }
        }
      }

      console.log('✅ Sample data loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('ℹ️  No data directory found, skipping sample data insertion');
      } else {
        throw error;
      }
    }
  }

  async getStats(): Promise<void> {
    console.log('\n📊 Database Statistics:');

    try {
      // Get notification count by status
      const [notificationStats] = await this.connection.execute<NotificationStats[]>(`
        SELECT status, COUNT(*) as count 
        FROM notifications 
        GROUP BY status
      `);

      if (notificationStats.length > 0) {
        console.log('📧 Notifications by Status:');
        notificationStats.forEach((stat) => {
          console.log(`   ${stat.status}: ${stat.count}`);
        });
      } else {
        console.log('📧 No notifications found');
      }

      // Get template count
      const [templateStats] = await this.connection.execute<TemplateStats[]>(`
        SELECT COUNT(*) as count 
        FROM notification_templates 
        WHERE is_active = 1
      `);

      console.log(`📝 Active Templates: ${templateStats[0].count}`);
    } catch (error) {
      console.error('❌ Error getting stats:', error);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new NotificationDatabaseSeeder();

  seeder
    .createConnection()
    .then(() => seeder.runSchemas())
    .then(() => seeder.seedData())
    .then(() => seeder.getStats())
    .then(() => {
      console.log('\n🎉 Notification database setup completed!');
      return seeder.close();
    })
    .catch((error) => {
      console.error('\n❌ Notification database setup failed:', error);
      return seeder.close().then(() => process.exit(1));
    });
}

export default NotificationDatabaseSeeder;
