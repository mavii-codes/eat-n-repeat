import { customerAddressesRepository } from "@/repositories/customer-addresses.repository";

export class SetDefaultAddressService {
  async execute(customerId: string, addressId: string) {
    const existing = await customerAddressesRepository.findFirst({ id: addressId, customerId });

    if (!existing) {
      return null;
    }

    await customerAddressesRepository.clearAllDefaults(customerId);

    await customerAddressesRepository.updateById(addressId, { isDefault: true });

    return existing;
  }
}

export const setDefaultAddressService = new SetDefaultAddressService();
