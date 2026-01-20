import pg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Client } = pg;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current columns
    const columnsResult = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'admins'
    `);
    console.log('Current columns:', columnsResult.rows.map(r => r.column_name));

    // Check if role column exists
    const hasRole = columnsResult.rows.some(r => r.column_name === 'role');
    
    if (!hasRole) {
      // Add role column with default 'admin'
      console.log('Adding role column...');
      await client.query(`
        ALTER TABLE admins 
        ADD COLUMN role VARCHAR(50) DEFAULT 'admin' NOT NULL
      `);
      console.log('Role column added successfully!');

      // Set the first admin (oldest) as super_admin
      console.log('Setting first admin as super_admin...');
      await client.query(`
        UPDATE admins 
        SET role = 'super_admin' 
        WHERE id = (SELECT id FROM admins ORDER BY created_at ASC LIMIT 1)
      `);
      console.log('First admin set as super_admin!');
    } else {
      console.log('Role column already exists');
    }

    // Show current admins with roles
    const adminsResult = await client.query('SELECT email, role, created_at FROM admins ORDER BY created_at ASC');
    console.log('\nCurrent admins:');
    adminsResult.rows.forEach(admin => {
      console.log(`  - ${admin.email}: ${admin.role}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();

