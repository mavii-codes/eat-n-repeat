import { getAddressesService } from "./get-addresses";
import { createAddressService } from "./create-address";
import { updateAddressService } from "./update-address";
import { deleteAddressService } from "./delete-address";
import { setDefaultAddressService } from "./set-default-address";

export async function getAddresses(customerId: string) {
  return getAddressesService.execute(customerId);
}

export async function createAddress(
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
  return createAddressService.execute(customerId, data);
}

export async function updateAddress(
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
  return updateAddressService.execute(customerId, addressId, data);
}

export async function deleteAddress(customerId: string, addressId: string) {
  return deleteAddressService.execute(customerId, addressId);
}

export async function setDefaultAddress(customerId: string, addressId: string) {
  return setDefaultAddressService.execute(customerId, addressId);
}
