import { cafeAvailabilityService } from "@/services/cafe-availability";

export class GetSyncStatusService {
  async execute() {
    const availability = await cafeAvailabilityService.resolve();
    return {
      success: true,
      isOffline: availability.isOffline,
      onlineOrdering: availability.onlineOrdering,
      reason: availability.reason,
    };
  }
}

export const getSyncStatusService = new GetSyncStatusService();
