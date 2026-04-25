// Run: DATABASE_URL=... node migrate.js
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL first');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  // Read and split migration file by statements
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '001_point_ab.sql'),
    'utf8'
  );

  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Running migration 001_point_ab.sql (${statements.length} statements)...`);

  for (const stmt of statements) {
    try {
      await sql(stmt);
      console.log('  OK:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
    } catch (err) {
      console.error('  FAIL:', stmt.substring(0, 60), err.message);
    }
  }

  console.log('Done.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
