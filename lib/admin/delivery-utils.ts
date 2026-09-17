import type {
  AvailabilityStatus,
  DeliveryRoleType,
  DeliveryStatus,
  DeliveryTeamMember,
} from "@/lib/admin/types";

export const initialDeliveryTeam: DeliveryTeamMember[] = [
  {
    id: "dtm-rider",
    name: "Delivery Rider",
    role: "Delivery Rider",
    personType: "RIDER",
    status: "Available",
    activeDeliveriesCount: 1,
  },
  {
    id: "dtm-owner",
    name: "Café Owner",
    role: "Café Owner",
    personType: "OWNER",
    status: "Available",
    activeDeliveriesCount: 0,
  },
];

export const availabilityStatusStyles: Record<AvailabilityStatus, string> = {
  Available: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Unavailable: "bg-rose-50 text-rose-800 border-rose-200",
};

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  preparing: "Preparing",
  ready_for_delivery: "Ready for Delivery",
  assigned: "Assigned",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const activeDeliveryStatuses: DeliveryStatus[] = [
  "pending",
  "preparing",
  "ready_for_delivery",
  "assigned",
  "out_for_delivery",
];

export const historyDeliveryStatuses: DeliveryStatus[] = [
  "delivered",
  "cancelled",
];

export const deliveryStatusStyles: Record<DeliveryStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  awaiting_payment: "bg-yellow-50 text-yellow-800 border-yellow-200",
  preparing: "bg-orange-50 text-orange-800 border-orange-200",
  ready_for_delivery: "bg-teal-50 text-teal-800 border-teal-200",
  assigned: "bg-indigo-50 text-indigo-800 border-indigo-200",
  out_for_delivery: "bg-rose-50 text-rose-800 border-rose-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-stone-100 text-stone-600 border-stone-200",
};

export function getRoleBadgeInfo(role?: DeliveryRoleType | string) {
  if (role === "Delivery Rider" || role === "Rider" || role === "RIDER") {
    return {
      label: "Rider Delivery",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    };
  }
  return {
    label: "Owner Delivery",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  };
}

/**
 * Priority Suggestion for 2-Person Delivery Assignment:
 * 1. Delivery Rider (if Available)
 * 2. Café Owner (if Rider Unavailable or fallback)
 */
export function getSuggestedDeliveryPerson(team: DeliveryTeamMember[]): DeliveryTeamMember {
  const rider = team.find((t) => t.personType === "RIDER" || t.role === "Delivery Rider");
  if (rider && rider.status === "Available") {
    return rider;
  }

  const owner = team.find((t) => t.personType === "OWNER" || t.role === "Café Owner");
  if (owner && owner.status === "Available") {
    return owner;
  }

  return rider || owner || initialDeliveryTeam[0];
}

export function formatDeliveryDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
