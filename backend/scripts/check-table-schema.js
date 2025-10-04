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

async function checkTableSchema() {
  const client = await pool.connect();

  try {
    console.log('Checking sandbox_tasks table schema...');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'sandbox_tasks'
      ORDER BY ordinal_position;
    `);

    console.log('Current sandbox_tasks columns:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('Error checking table schema:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableSchema();