import { customerAddressesRepository } from "@/repositories/customer-addresses.repository";

export class DeleteAddressService {
  async execute(customerId: string, addressId: string) {
    const result = await customerAddressesRepository.deleteMany({ id: addressId, customerId });

    if (result === 0) {
      return 0;
    }

    const hasDefault = await customerAddressesRepository.findFirst({ customerId, isDefault: true });

    if (!hasDefault) {
      const mostRecent = await customerAddressesRepository.findFirstRecent(customerId);

      if (mostRecent) {
        await customerAddressesRepository.updateById(mostRecent.id, { isDefault: true });
      }
    }

    return result;
  }
}

export const deleteAddressService = new DeleteAddressService();
