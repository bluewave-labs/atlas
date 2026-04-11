import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function bootstrapDatabase() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS exists`,
    );
    if (rows[0]?.exists) {
      logger.info('Database already initialized — skipping bootstrap');
      return;
    }

    logger.info('Empty database detected — running initial schema');

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      logger.info({ file }, 'Applied migration');
    }

    logger.info('Database bootstrap complete');
  } finally {
    client.release();
  }
}
