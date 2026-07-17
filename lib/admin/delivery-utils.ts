import type { DeliveryStatus } from "@/lib/admin/types";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const activeDeliveryStatuses: DeliveryStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
];

export const historyDeliveryStatuses: DeliveryStatus[] = [
  "delivered",
  "cancelled",
];

export const deliveryStatusStyles: Record<DeliveryStatus, string> = {
  pending: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  confirmed: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  preparing: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  out_for_delivery: "bg-purple-100 text-purple-800 ring-1 ring-purple-200",
  delivered: "bg-green-100 text-green-800 ring-1 ring-green-200",
  cancelled: "bg-red-100 text-red-800 ring-1 ring-red-200",
};

export function formatDeliveryDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
