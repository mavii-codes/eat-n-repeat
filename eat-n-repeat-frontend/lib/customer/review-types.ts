export type CustomerReview = {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  customerName: string;
  customerEmail: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
  hidden: boolean;
};

export type ReviewInput = {
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
};

export type ReviewsState = {
  reviews: CustomerReview[];
};

export type MenuItemRatingSummary = {
  averageRating: number;
  totalReviews: number;
};

// ---------------------------------------------------------------------------
// Server-backed (global) review shapes. The backend owns the aggregate and
// 1-decimal rounding; the frontend renders these values as-is and never
// recomputes them. customerId / email / tokens are never exposed here.
// ---------------------------------------------------------------------------

export type ServerReview = {
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

export type ServerItemReviewsResponse = {
  menuItemId: string;
  averageRating: number;
  ratingCount: number;
  myRating: number | null;
  myReview: ServerReview | null;
  hasReviewed: boolean;
  reviews: ServerReview[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type MyServerReview = ServerReview & {
  menuItemName: string;
  hidden: boolean;
  orderId: string | null;
};

export type AdminServerReview = ServerReview & {
  menuItemName: string;
  hidden: boolean;
  orderId: string | null;
};

export type AdminReviewsResponse = {
  reviews: AdminServerReview[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    total: number;
    visible: number;
    hidden: number;
    averageRating: number;
    distribution: Record<number, number>;
  };
};

export type MenuRatingEntry = {
  averageRating: number;
  ratingCount: number;
  myRating: number | null;
  hasReviewed: boolean;
};
