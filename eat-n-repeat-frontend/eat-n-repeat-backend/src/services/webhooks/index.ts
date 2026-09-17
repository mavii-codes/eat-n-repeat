import { handleXenditWebhookService } from "./handle-xendit-webhook";

export async function handleXenditWebhook(event: any) {
  return handleXenditWebhookService.execute(event);
}
