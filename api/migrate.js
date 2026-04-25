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

  // Run all migration files in order
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = migration
      .split(';')
      .map(s => s.replace(/--[^\n]*/g, '').trim())
      .filter(s => s.length > 0);

    console.log(`Running ${file} (${statements.length} statements)...`);

    for (const stmt of statements) {
      try {
        await sql(stmt);
        console.log('  OK:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
      } catch (err) {
        console.error('  FAIL:', stmt.substring(0, 60), err.message);
      }
    }
  }

  console.log('All migrations done.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
