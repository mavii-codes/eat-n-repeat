import express, { Response } from 'express';
import { getPool } from '../database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/require-auth.js';

const router = express.Router();

// GET /api/customer-favorites - Fetch array of favorite menu item IDs
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.auth!.userId;
    const [rows]: any = await getPool().query(
      'SELECT menu_item_id FROM customer_favorites WHERE customer_id = ?',
      [customerId]
    );

    const favoriteIds = rows.map((row: any) => row.menu_item_id);
    res.json(favoriteIds);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customer-favorites - Add a new favorite
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { menuItemId } = req.body;
  const customerId = req.auth!.userId;

  if (!menuItemId) {
    res.status(400).json({ error: 'Menu item ID is required' });
    return;
  }

  try {
    await getPool().query(
      'INSERT IGNORE INTO customer_favorites (customer_id, menu_item_id) VALUES (?, ?)',
      [customerId, menuItemId]
    );
    res.status(201).json({ success: true, message: 'Favorite added' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/customer-favorites/:id - Remove a favorite
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const menuItemId = req.params.id;
  const customerId = req.auth!.userId;

  try {
    await getPool().query(
      'DELETE FROM customer_favorites WHERE customer_id = ? AND menu_item_id = ?',
      [customerId, menuItemId]
    );
    res.json({ success: true, message: 'Favorite removed' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
