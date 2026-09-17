import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as service from "@/services/customer-addresses";

function toResponse(row: {
  id: string;
  customerId: string;
  addressName: string;
  fullAddress: string;
  barangay: string;
  municipality: string;
  landmarks: string | null;
  deliveryNotes: string | null;
  isDefault: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    customer_id: row.customerId,
    address_name: row.addressName,
    full_address: row.fullAddress,
    barangay: row.barangay,
    municipality: row.municipality,
    landmarks: row.landmarks,
    delivery_notes: row.deliveryNotes,
    is_default: row.isDefault ? 1 : 0,
    created_at: row.createdAt,
  };
}

export class CustomerAddressesController {
  async getAddresses(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = req.auth!.userId;
      const addresses = await service.getAddresses(customerId);
      const mapped = addresses.map(toResponse);
      res.json(mapped);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createAddress(req: AuthenticatedRequest, res: Response) {
    const { address_name, full_address, barangay, municipality, landmarks, delivery_notes } = req.body;
    const userId = req.auth!.userId;

    if (!address_name || !full_address || !barangay || !municipality) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    try {
      const address = await service.createAddress(userId, {
        addressName: address_name,
        fullAddress: full_address,
        barangay,
        municipality,
        landmarks: landmarks || null,
        deliveryNotes: delivery_notes || null,
      });

      res.status(201).json({ id: address.id, message: "Address created successfully" });
    } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateAddress(req: AuthenticatedRequest, res: Response) {
    const addressId = req.params.id as string;
    const { address_name, full_address, barangay, municipality, landmarks, delivery_notes } = req.body;
    const userId = req.auth!.userId;

    try {
      const count = await service.updateAddress(userId, addressId, {
        addressName: address_name,
        fullAddress: full_address,
        barangay,
        municipality,
        landmarks: landmarks || null,
        deliveryNotes: delivery_notes || null,
      });

      if (count === 0) {
        res.status(404).json({ error: "Address not found or unauthorized" });
        return;
      }

      res.json({ success: true, message: "Address updated successfully" });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteAddress(req: AuthenticatedRequest, res: Response) {
    const addressId = req.params.id as string;
    const userId = req.auth!.userId;

    try {
      const count = await service.deleteAddress(userId, addressId);

      if (count === 0) {
        res.status(404).json({ error: "Address not found or unauthorized" });
        return;
      }

      res.json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async setDefaultAddress(req: AuthenticatedRequest, res: Response) {
    const addressId = req.params.id as string;
    const userId = req.auth!.userId;

    try {
      const existing = await service.setDefaultAddress(userId, addressId);

      if (!existing) {
        res.status(404).json({ error: "Address not found or unauthorized" });
        return;
      }

      res.json({ success: true, message: "Default address updated successfully" });
    } catch (error) {
      console.error("Error setting default address:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const customerAddressesController = new CustomerAddressesController();
