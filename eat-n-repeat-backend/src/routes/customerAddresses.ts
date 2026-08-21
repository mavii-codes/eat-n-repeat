import express, { Response } from 'express';
import { getPool } from '../database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/require-auth.js';
import crypto from 'crypto';

const router = express.Router();

// GET /customer-addresses - Fetch all addresses
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    const [rows]: any = await getPool().query(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [customerId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /customer-addresses - Add a new address
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { address_name, full_address, barangay, municipality, landmarks, delivery_notes } = req.body;
  const userId = req.auth!.userId;

  if (!address_name || !full_address || !barangay || !municipality) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Check if customer has any addresses (first one becomes default)
    const [existing]: any = await getPool().query(
      'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = ?',
      [userId]
    );

    const isFirstAddress = existing[0].count === 0;
    const addressId = crypto.randomUUID();

    await getPool().query(
      `INSERT INTO customer_addresses 
      (id, customer_id, address_name, full_address, barangay, municipality, landmarks, delivery_notes, is_default) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [addressId, userId, address_name, full_address, barangay, municipality, landmarks || null, delivery_notes || null, isFirstAddress]
    );

    res.status(201).json({ id: addressId, message: 'Address created successfully' });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /customer-addresses/:id - Edit an address
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const addressId = req.params.id;
  const { address_name, full_address, barangay, municipality, landmarks, delivery_notes } = req.body;
  const userId = req.auth!.userId;

  try {
    const [result]: any = await getPool().query(
      `UPDATE customer_addresses SET 
      address_name = ?, full_address = ?, barangay = ?, municipality = ?, landmarks = ?, delivery_notes = ? 
      WHERE id = ? AND customer_id = ?`,
      [address_name, full_address, barangay, municipality, landmarks || null, delivery_notes || null, addressId, userId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Address not found or unauthorized' });
      return;
    }

    res.json({ success: true, message: 'Address updated successfully' });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /customer-addresses/:id - Delete an address
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const addressId = req.params.id;
  const userId = req.auth!.userId;

  try {
    const [result]: any = await getPool().query(
      'DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, userId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Address not found or unauthorized' });
      return;
    }

    // If we deleted the default address, make the most recent one default
    const [remaining]: any = await getPool().query(
      'SELECT id FROM customer_addresses WHERE customer_id = ? AND is_default = 1',
      [userId]
    );

    if (remaining.length === 0) {
      await getPool().query(
        'UPDATE customer_addresses SET is_default = 1 WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
    }

    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /customer-addresses/:id/default - Set as default
router.put('/:id/default', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const addressId = req.params.id;
  const userId = req.auth!.userId;

  try {
    // Check if address exists and belongs to user
    const [existing]: any = await getPool().query(
      'SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      res.status(404).json({ error: 'Address not found or unauthorized' });
      return;
    }

    // Unset current default
    await getPool().query(
      'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?',
      [userId]
    );

    // Set new default
    await getPool().query(
      'UPDATE customer_addresses SET is_default = 1 WHERE id = ?',
      [addressId]
    );

    res.json({ success: true, message: 'Default address updated successfully' });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
