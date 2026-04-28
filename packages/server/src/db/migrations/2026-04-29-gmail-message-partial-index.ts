import { pool } from '../../config/database';
import { logger } from '../../utils/logger';

const CREATE_PARTIAL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_messages_tenant_inbound_active
    ON messages (tenant_id, sent_at DESC)
    WHERE direction = 'inbound' AND deleted_at IS NULL;
`;

export async function migrateGmailMessagePartialIndex(): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query(CREATE_PARTIAL_INDEX);
    logger.debug('gmail-message-partial-index migration applied');
  } finally {
    c.release();
  }
}
