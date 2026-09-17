import { customerAddressesRepository } from "@/repositories/customer-addresses.repository";

export class GetAddressesService {
  async execute(customerId: string) {
    return customerAddressesRepository.findManyByCustomerId(customerId);
  }
}

export const getAddressesService = new GetAddressesService();
