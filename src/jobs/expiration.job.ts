import cron from 'node-cron';
import { db } from '../config/db';

// Runs daily at midnight (00:00)
export const initExpirationCron = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily enrollment expiration check...');
    try {
      // Transition ACTIVE -> GRACE_PERIOD
      const graceUpdate = await db.query(
        `UPDATE enrollments 
         SET status = 'GRACE_PERIOD' 
         WHERE status = 'ACTIVE' AND CURRENT_TIMESTAMP > access_end_date AND CURRENT_TIMESTAMP <= grace_period_end_date`
      );

      // Transition GRACE_PERIOD -> EXPIRED
      const expireUpdate = await db.query(
        `UPDATE enrollments 
         SET status = 'EXPIRED' 
         WHERE status IN ('ACTIVE', 'GRACE_PERIOD') AND CURRENT_TIMESTAMP > grace_period_end_date`
      );

      console.log(`[CRON] Updated ${graceUpdate.rowCount} enrollments to GRACE_PERIOD.`);
      console.log(`[CRON] Updated ${expireUpdate.rowCount} enrollments to EXPIRED.`);
    } catch (error) {
      console.error('[CRON] Failed to update expired enrollments:', error);
    }
  });
};