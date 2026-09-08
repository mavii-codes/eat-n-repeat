import crypto from "crypto";
import { customerAddressesRepository } from "@/repositories/customer-addresses.repository";

export class CreateAddressService {
  async execute(
    customerId: string,
    data: {
      addressName: string;
      fullAddress: string;
      barangay: string;
      municipality: string;
      landmarks?: string | null;
      deliveryNotes?: string | null;
    },
  ) {
    const count = await customerAddressesRepository.countByCustomerId(customerId);
    const isFirstAddress = count === 0;
    const addressId = crypto.randomUUID();

    const address = await customerAddressesRepository.create({
      id: addressId,
      customerId,
      addressName: data.addressName,
      fullAddress: data.fullAddress,
      barangay: data.barangay,
      municipality: data.municipality,
      landmarks: data.landmarks ?? null,
      deliveryNotes: data.deliveryNotes ?? null,
      isDefault: isFirstAddress,
    });

    return address;
  }
}

export const createAddressService = new CreateAddressService();
