import type { Response } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { prisma } from "@/lib/prisma";
import {
  createReviewSchema,
  updateReviewSchema,
  visibilitySchema,
} from "@/schema/reviews/reviews.schema";
import {
  reviewsService,
  isReviewAdminUserId,
} from "@/services/reviews/index";

function dbError(res: Response, error: unknown, context: string) {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ message: (error as Error).message });
  }
  console.error(`Error ${context}:`, error);
  return res.status(500).json({ message: "Internal server error." });
}

// Viewer is a customer only when the JWT subject exists in customers.
// Staff/admin/user rows get the global data with customer-specific fields nulled.
async function resolveViewerCustomerId(req: AuthenticatedRequest): Promise<string | undefined> {
  const userId = req.auth?.userId;
  if (!userId) return undefined;
  const customer = await prisma.customer.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return customer?.id;
}

export class ReviewsController {
  // Public (guests included) — global aggregate + global list.
  async getItemReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const viewerCustomerId = await resolveViewerCustomerId(req);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const result = await reviewsService.getItemReviews(
        req.params.menuItemId as string,
        viewerCustomerId,
        page,
        limit,
      );
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "fetching item reviews");
    }
  }

  async createReview(req: AuthenticatedRequest, res: Response) {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Review details are invalid." });
    }
    try {
      const result = await reviewsService.createReview(req.auth!.userId, {
        menuItemId: parsed.data.menuItemId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? "",
        orderId: parsed.data.orderId,
      });
      return res.status(201).json(result);
    } catch (error) {
      return dbError(res, error, "creating review");
    }
  }

  async updateReview(req: AuthenticatedRequest, res: Response) {
    const parsed = updateReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Review details are invalid." });
    }
    try {
      const result = await reviewsService.updateReview(
        req.auth!.userId,
        req.params.id as string,
        { rating: parsed.data.rating, comment: parsed.data.comment },
      );
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "updating review");
    }
  }

  // Owner or admin/head_staff. Service owns the customer rule; the admin
  // branch is resolved here (same users-then-customers pattern as order-chat).
  async deleteReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.auth!.userId;
      if (await isReviewAdminUserId(userId)) {
        const result = await reviewsService.adminDeleteReview(req.params.id as string);
        return res.json(result);
      }
      const result = await reviewsService.deleteReviewAsCustomer(userId, req.params.id as string);
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "deleting review");
    }
  }

  async setVisibility(req: AuthenticatedRequest, res: Response) {
    const parsed = visibilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Visibility value is invalid." });
    }
    try {
      const result = await reviewsService.setVisibility(
        req.params.id as string,
        parsed.data.hidden,
      );
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "updating review visibility");
    }
  }

  async getMine(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await reviewsService.getMine(req.auth!.userId);
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "fetching own reviews");
    }
  }

  async getAdminList(req: AuthenticatedRequest, res: Response) {
    try {
      const ratingRaw = req.query.rating as string | undefined;
      const rating = ratingRaw && ratingRaw !== "all" ? Number(ratingRaw) : undefined;
      const statusRaw = (req.query.status as string | undefined) ?? "all";
      const status =
        statusRaw === "visible" || statusRaw === "hidden" ? statusRaw : ("all" as const);
      const result = await reviewsService.getAdminList({
        rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
        status,
        search: (req.query.search as string | undefined) ?? "",
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
      });
      return res.json(result);
    } catch (error) {
      return dbError(res, error, "listing reviews");
    }
  }
}

export const reviewsController = new ReviewsController();
