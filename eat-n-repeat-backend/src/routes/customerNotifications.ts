import express, { Response } from 'express';
import { getPool } from '../database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/require-auth.js';
import crypto from 'crypto';

const router = express.Router();

// GET /notifications - Fetch all notifications for the customer
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    const [rows] = await getPool().query(
      'SELECT * FROM customer_notifications WHERE customer_id = ? ORDER BY created_at DESC',
      [customerId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications - Create a new notification
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { type, title, description } = req.body;
  const customerId = req.auth!.userId;
  const id = `note-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await getPool().query(
      'INSERT INTO customer_notifications (id, customer_id, type, title, description) VALUES (?, ?, ?, ?, ?)',
      [id, customerId, type, title, description]
    );
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /notifications/:id/read - Mark single notification as read
router.put('/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    await getPool().query(
      'UPDATE customer_notifications SET is_read = TRUE WHERE id = ? AND customer_id = ?',
      [req.params.id, customerId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /notifications/read-all - Mark all as read
router.put('/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    await getPool().query(
      'UPDATE customer_notifications SET is_read = TRUE WHERE customer_id = ? AND is_read = FALSE',
      [customerId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /notifications/:id - Delete single notification
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    await getPool().query(
      'DELETE FROM customer_notifications WHERE id = ? AND customer_id = ?',
      [req.params.id, customerId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /notifications/clear-all - Clear all notifications
router.delete('/clear-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    await getPool().query(
      'DELETE FROM customer_notifications WHERE customer_id = ?',
      [customerId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
