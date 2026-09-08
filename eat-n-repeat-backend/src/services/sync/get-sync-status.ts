export class GetSyncStatusService {
  async execute() {
    return { success: true, isOffline: false };
  }
}

export const getSyncStatusService = new GetSyncStatusService();
