import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { emitReviewEvent } from "@/lib/sse";
import { reviewsRepository } from "@/repositories/reviews.repository";

export type PublicReview = {
  id: string;
  menuItemId: string;
  rating: number;
  comment: string;
  displayName: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
};

type ReviewRow = {
  id: string;
  menuItemId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string | null;
  orderId: string | null;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Single rounding site for review aggregates (backend owns rounding; the
// frontend must render these values as-is).
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toPublicReview(row: ReviewRow, viewerCustomerId?: string): PublicReview {
  return {
    id: row.id,
    menuItemId: row.menuItemId,
    rating: row.rating,
    comment: row.comment ?? "",
    displayName: row.customerName,
    customerName: row.customerName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isMine: !!viewerCustomerId && row.customerId === viewerCustomerId,
  };
}

function paginationOf(page: number, limit: number, total: number) {
  const p = Math.max(1, Math.floor(page) || 1);
  const l = Math.min(100, Math.max(1, Math.floor(limit) || 50));
  return { page: p, limit: l, total, totalPages: Math.max(1, Math.ceil(total / l)) };
}

function serviceError(statusCode: number, message: string) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function ensureMenuItemExists(menuItemId: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    select: { id: true },
  });
  if (!item) throw serviceError(404, "Menu item not found.");
  return item;
}

async function resolveCustomerName(customerId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true },
  });
  return customer?.name?.trim() || "Customer";
}

async function resolveMenuItemNames(menuItemIds: string[]): Promise<Record<string, string>> {
  if (menuItemIds.length === 0) return {};
  const items = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true },
  });
  const out: Record<string, string> = {};
  for (const item of items) out[item.id] = item.name;
  return out;
}

export class ReviewsService {
  async getItemReviews(
    menuItemId: string,
    viewerCustomerId?: string,
    page = 1,
    limit = 50,
  ) {
    await ensureMenuItemExists(menuItemId);
    const [{ rows, total }, agg, my] = await Promise.all([
      reviewsRepository.findVisibleByMenuItem(menuItemId, page, limit),
      reviewsRepository.aggregateByMenuItem(menuItemId),
      viewerCustomerId
        ? reviewsRepository.findByMenuItemAndCustomer(menuItemId, viewerCustomerId)
        : Promise.resolve(null),
    ]);
    const pag = paginationOf(page, limit, total);
    return {
      menuItemId,
      averageRating: round1(agg.average),
      ratingCount: agg.count,
      myRating: my && !my.hidden ? my.rating : null,
      myReview: my && !my.hidden ? toPublicReview(my, viewerCustomerId) : null,
      hasReviewed: !!my && !my.hidden,
      reviews: rows.map((r) => toPublicReview(r, viewerCustomerId)),
      pagination: pag,
    };
  }

  async createReview(
    customerId: string,
    input: { menuItemId: string; rating: number; comment?: string; orderId?: string },
  ) {
    await ensureMenuItemExists(input.menuItemId);
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw serviceError(400, "Rating must be a whole number from 1 to 5.");
    }
    const comment = (input.comment ?? "").trim().slice(0, 500);
    const orderId = input.orderId?.trim() || null;
    const customerName = await resolveCustomerName(customerId);
    const id = `rev-${crypto.randomUUID().slice(0, 8)}`;

    try {
      const { row, agg } = await prisma.$transaction(async (tx) => {
        const row = await tx.menuReview.create({
          data: {
            id,
            menuItemId: input.menuItemId,
            customerId,
            customerName,
            rating: input.rating,
            comment: comment || null,
            orderId,
          },
        });
        const aggResult = await tx.menuReview.aggregate({
          where: { menuItemId: input.menuItemId, hidden: false },
          _avg: { rating: true },
          _count: { _all: true },
        });
        return {
          row,
          agg: { average: aggResult._avg.rating ?? 0, count: aggResult._count._all },
        };
      });
      const averageRating = round1(agg.average);
      // Realtime: broadcast AFTER commit so viewers refresh. Public fields only.
      emitReviewEvent({
        type: "REVIEW_CREATED",
        menuItemId: row.menuItemId,
        averageRating,
        ratingCount: agg.count,
        review: {
          id: row.id,
          rating: row.rating,
          comment: row.comment ?? "",
          displayName: row.customerName,
          createdAt: row.createdAt.toISOString(),
        },
      }).catch((e) => console.error("Failed to emit REVIEW_CREATED:", e));
      return {
        review: toPublicReview(row, customerId),
        averageRating,
        ratingCount: agg.count,
      };
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw serviceError(409, "You have already reviewed this item.");
      }
      throw error;
    }
  }

  async updateReview(
    customerId: string,
    reviewId: string,
    patch: { rating?: number; comment?: string },
  ) {
    const existing = await reviewsRepository.findById(reviewId);
    if (!existing) throw serviceError(404, "Review not found.");
    if (existing.customerId !== customerId) {
      throw serviceError(403, "You can only edit your own review.");
    }
    if (patch.rating !== undefined && (!Number.isInteger(patch.rating) || patch.rating < 1 || patch.rating > 5)) {
      throw serviceError(400, "Rating must be a whole number from 1 to 5.");
    }
    if (patch.rating === undefined && patch.comment === undefined) {
      throw serviceError(400, "Nothing to update.");
    }
    const data: { rating?: number; comment?: string | null } = {};
    if (patch.rating !== undefined) data.rating = patch.rating;
    if (patch.comment !== undefined) data.comment = patch.comment.trim().slice(0, 500) || null;

    const { row, agg } = await prisma.$transaction(async (tx) => {
      const row = await tx.menuReview.update({ where: { id: reviewId }, data });
      const aggResult = await tx.menuReview.aggregate({
        where: { menuItemId: row.menuItemId, hidden: false },
        _avg: { rating: true },
        _count: { _all: true },
      });
      return {
        row,
        agg: { average: aggResult._avg.rating ?? 0, count: aggResult._count._all },
      };
    });
    const averageRating = round1(agg.average);
    emitReviewEvent({
      type: "REVIEW_UPDATED",
      menuItemId: row.menuItemId,
      averageRating,
      ratingCount: agg.count,
      review: {
        id: row.id,
        rating: row.rating,
        comment: row.comment ?? "",
        displayName: row.customerName,
        createdAt: row.createdAt.toISOString(),
      },
    }).catch((e) => console.error("Failed to emit REVIEW_UPDATED:", e));
    return {
      review: toPublicReview(row, customerId),
      averageRating,
      ratingCount: agg.count,
    };
  }

  async deleteReviewAsCustomer(customerId: string, reviewId: string) {
    const existing = await reviewsRepository.findById(reviewId);
    if (!existing) throw serviceError(404, "Review not found.");
    if (existing.customerId !== customerId) {
      throw serviceError(403, "You can only delete your own review.");
    }
    const menuItemId = existing.menuItemId;
    const agg = await prisma.$transaction(async (tx) => {
      await tx.menuReview.delete({ where: { id: reviewId } });
      const aggResult = await tx.menuReview.aggregate({
        where: { menuItemId, hidden: false },
        _avg: { rating: true },
        _count: { _all: true },
      });
      return { average: aggResult._avg.rating ?? 0, count: aggResult._count._all };
    });
    const averageRating = round1(agg.average);
    emitReviewEvent({
      type: "REVIEW_DELETED",
      menuItemId,
      averageRating,
      ratingCount: agg.count,
      reviewId,
    }).catch((e) => console.error("Failed to emit REVIEW_DELETED:", e));
    return { menuItemId, averageRating, ratingCount: agg.count };
  }

  async adminDeleteReview(reviewId: string) {
    const existing = await reviewsRepository.findById(reviewId);
    if (!existing) throw serviceError(404, "Review not found.");
    const menuItemId = existing.menuItemId;
    const agg = await prisma.$transaction(async (tx) => {
      await tx.menuReview.delete({ where: { id: reviewId } });
      const aggResult = await tx.menuReview.aggregate({
        where: { menuItemId, hidden: false },
        _avg: { rating: true },
        _count: { _all: true },
      });
      return { average: aggResult._avg.rating ?? 0, count: aggResult._count._all };
    });
    const averageRating = round1(agg.average);
    emitReviewEvent({
      type: "REVIEW_DELETED",
      menuItemId,
      averageRating,
      ratingCount: agg.count,
      reviewId,
    }).catch((e) => console.error("Failed to emit REVIEW_DELETED:", e));
    return { menuItemId, averageRating, ratingCount: agg.count };
  }

  async setVisibility(reviewId: string, hidden: boolean) {
    const existing = await reviewsRepository.findById(reviewId);
    if (!existing) throw serviceError(404, "Review not found.");
    const { row, agg } = await prisma.$transaction(async (tx) => {
      const row = await tx.menuReview.update({ where: { id: reviewId }, data: { hidden } });
      const aggResult = await tx.menuReview.aggregate({
        where: { menuItemId: row.menuItemId, hidden: false },
        _avg: { rating: true },
        _count: { _all: true },
      });
      return {
        row,
        agg: { average: aggResult._avg.rating ?? 0, count: aggResult._count._all },
      };
    });
    const averageRating = round1(agg.average);
    if (hidden) {
      // Hiding removes the review from every viewer's list.
      emitReviewEvent({
        type: "REVIEW_DELETED",
        menuItemId: row.menuItemId,
        averageRating,
        ratingCount: agg.count,
        reviewId: row.id,
      }).catch((e) => console.error("Failed to emit REVIEW_DELETED:", e));
    } else {
      // Unhiding (re)publishes it to every viewer.
      emitReviewEvent({
        type: "REVIEW_CREATED",
        menuItemId: row.menuItemId,
        averageRating,
        ratingCount: agg.count,
        review: {
          id: row.id,
          rating: row.rating,
          comment: row.comment ?? "",
          displayName: row.customerName,
          createdAt: row.createdAt.toISOString(),
        },
      }).catch((e) => console.error("Failed to emit REVIEW_CREATED:", e));
    }
    return {
      review: {
        ...toPublicReview(row, undefined),
        hidden: row.hidden,
        orderId: row.orderId,
      },
      menuItemId: row.menuItemId,
      averageRating,
      ratingCount: agg.count,
    };
  }

  async getMine(customerId: string) {
    const rows = await reviewsRepository.findManyByCustomerId(customerId);
    const names = await resolveMenuItemNames([...new Set(rows.map((r) => r.menuItemId))]);
    return {
      reviews: rows.map((r) => ({
        ...toPublicReview(r, customerId),
        menuItemName: names[r.menuItemId] ?? "Menu item",
        hidden: r.hidden,
        orderId: r.orderId,
      })),
    };
  }

  async getAdminList(filter: {
    rating?: number;
    status?: "visible" | "hidden" | "all";
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const status = filter.status === "all" ? undefined : filter.status;
    const { rows, total } = await reviewsRepository.findManyForAdmin({
      rating: filter.rating,
      status,
      search: filter.search,
      page: filter.page,
      limit: filter.limit,
    });
    const names = await resolveMenuItemNames([...new Set(rows.map((r) => r.menuItemId))]);
    const stats = await reviewsRepository.adminStats();
    const pag = paginationOf(filter.page ?? 1, filter.limit ?? 50, total);
    return {
      reviews: rows.map((r) => ({
        ...toPublicReview(r, undefined),
        menuItemName: names[r.menuItemId] ?? "Menu item",
        hidden: r.hidden,
        orderId: r.orderId,
      })),
      pagination: pag,
      stats: {
        total: stats.total,
        visible: stats.visible,
        hidden: stats.hidden,
        averageRating: round1(stats.average),
        distribution: stats.distribution,
      },
    };
  }
}

export const reviewsService = new ReviewsService();

export async function isReviewAdminUserId(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "admin" || user?.role === "head_staff";
}
