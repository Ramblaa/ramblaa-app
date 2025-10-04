import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addTaskManagementColumns() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Adding task management columns to sandbox_tasks table...');

    // Add the missing columns
    const alterQueries = [
      `ALTER TABLE sandbox_tasks ADD COLUMN IF NOT EXISTS task_bucket VARCHAR(100)`,
      `ALTER TABLE sandbox_tasks ADD COLUMN IF NOT EXISTS action_holder VARCHAR(50)`,
      `ALTER TABLE sandbox_tasks ADD COLUMN IF NOT EXISTS guest_requirements TEXT`,
      `ALTER TABLE sandbox_tasks ADD COLUMN IF NOT EXISTS staff_requirements TEXT`,
      `ALTER TABLE sandbox_tasks ADD COLUMN IF NOT EXISTS host_escalation BOOLEAN DEFAULT FALSE`
    ];

    for (const query of alterQueries) {
      console.log(`Executing: ${query}`);
      await client.query(query);
    }

    await client.query('COMMIT');
    console.log('Successfully added task management columns');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding task management columns:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
addTaskManagementColumns()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });