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
