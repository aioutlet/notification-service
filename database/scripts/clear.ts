import mysql, { Connection } from 'mysql2/promise';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface CountStats {
  count: number;
}

class NotificationDatabaseCleaner {
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

  async clearAllData(): Promise<void> {
    console.log('🗑️  Clearing all notification service data...');

    try {
      const clearQueries = ['DELETE FROM notifications;', 'DELETE FROM notification_templates;'];

      for (const query of clearQueries) {
        await this.connection.execute(query);
        console.log(`✅ Executed: ${query}`);
      }

      console.log('✅ All notification service data cleared successfully!');
    } catch (error) {
      console.error('❌ Error clearing notification data:', error);
      throw error;
    }
  }

  async dropAllTables(): Promise<void> {
    console.log('💥 Dropping all notification service tables...');

    try {
      const dropQueries = ['DROP TABLE IF EXISTS notifications;', 'DROP TABLE IF EXISTS notification_templates;'];

      for (const query of dropQueries) {
        await this.connection.execute(query);
        console.log(`✅ Executed: ${query}`);
      }

      console.log('✅ All notification service tables dropped successfully!');
    } catch (error) {
      console.error('❌ Error dropping notification tables:', error);
      throw error;
    }
  }

  async getStats(): Promise<void> {
    console.log('\n📊 Database Statistics (before cleanup):');

    try {
      // Get notification count
      const [notificationCount] = await this.connection.execute<CountStats[]>(`
        SELECT COUNT(*) as count FROM notifications
      `);

      // Get template count
      const [templateCount] = await this.connection.execute<CountStats[]>(`
        SELECT COUNT(*) as count FROM notification_templates
      `);

      console.log(`📧 Notifications: ${notificationCount[0].count}`);
      console.log(`📝 Templates: ${templateCount[0].count}`);
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

// Run cleaner if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleaner = new NotificationDatabaseCleaner();
  const operation = process.argv[2] || 'clear';

  const runOperation = async () => {
    await cleaner.createConnection();
    await cleaner.getStats();

    if (operation === 'drop') {
      await cleaner.dropAllTables();
    } else {
      await cleaner.clearAllData();
    }
  };

  runOperation()
    .then(() => {
      console.log(`\n✅ Notification database ${operation} completed!`);
      return cleaner.close();
    })
    .catch((error) => {
      console.error(`\n❌ Notification database ${operation} failed:`, error);
      return cleaner.close().then(() => process.exit(1));
    });
}

export default NotificationDatabaseCleaner;
