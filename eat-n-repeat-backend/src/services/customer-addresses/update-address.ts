import { customerAddressesRepository } from "@/repositories/customer-addresses.repository";

export class UpdateAddressService {
  async execute(
    customerId: string,
    addressId: string,
    data: {
      addressName?: string;
      fullAddress?: string;
      barangay?: string;
      municipality?: string;
      landmarks?: string | null;
      deliveryNotes?: string | null;
    },
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.addressName !== undefined) updateData.addressName = data.addressName;
    if (data.fullAddress !== undefined) updateData.fullAddress = data.fullAddress;
    if (data.barangay !== undefined) updateData.barangay = data.barangay;
    if (data.municipality !== undefined) updateData.municipality = data.municipality;
    if (data.landmarks !== undefined) updateData.landmarks = data.landmarks;
    if (data.deliveryNotes !== undefined) updateData.deliveryNotes = data.deliveryNotes;

    return customerAddressesRepository.updateMany({ id: addressId, customerId }, updateData);
  }
}

export const updateAddressService = new UpdateAddressService();
