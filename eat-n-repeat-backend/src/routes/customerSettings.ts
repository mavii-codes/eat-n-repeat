import express, { Response } from 'express';
import { getPool } from '../database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/require-auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// GET /settings - Fetch customer settings and profile
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    const [rows]: any = await getPool().query(
      'SELECT id, name, email, phone, status, avatar_url, notification_preferences, created_at FROM customers WHERE id = ?',
      [customerId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const customer = rows[0];

    // Default preferences if none exist
    let preferences = customer.notification_preferences;
    if (!preferences) {
      preferences = {
        order_status: true,
        promotions: true,
        new_menu: true,
        announcements: true
      };
    } else if (typeof preferences === 'string') {
      try {
        preferences = JSON.parse(preferences);
      } catch(e) {}
    }

    res.json({
      ...customer,
      notification_preferences: preferences
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /settings - Update profile & preferences
router.put('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, avatar_url, notification_preferences } = req.body;
  const customerId = req.auth!.userId;

  try {
    const prefsJson = notification_preferences ? JSON.stringify(notification_preferences) : null;

    await getPool().query(
      'UPDATE customers SET name = ?, phone = ?, avatar_url = ?, notification_preferences = ? WHERE id = ?',
      [name, phone, avatar_url, prefsJson, customerId]
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /settings/password - Change Password
router.put('/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const customerId = req.auth!.userId;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Invalid password data provided' });
    return;
  }

  try {
    const [rows]: any = await getPool().query('SELECT password_hash FROM customers WHERE id = ?', [customerId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Incorrect current password' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await getPool().query('UPDATE customers SET password_hash = ? WHERE id = ?', [newHash, customerId]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /settings/account - Delete Account
router.delete('/account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    await getPool().query('DELETE FROM customers WHERE id = ?', [customerId]);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
