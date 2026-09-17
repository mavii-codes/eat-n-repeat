'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  CustomerReview,
  MenuItemRatingSummary,
  ReviewInput,
  ReviewsState,
} from '@/lib/customer/review-types';

const STORAGE_KEY = 'eat-n-repeat-reviews';

function createReviewId() {
  return `rev-${crypto.randomUUID().slice(0, 8)}`;
}

// Seed data: realistic mock reviews for existing menu items
const seedReviews: CustomerReview[] = [
  {
    id: 'rev-seed-1',
    orderId: 'seed-order-1',
    menuItemId: 'mi-1',
    menuItemName: 'House Special Latte',
    customerName: 'Maria Santos',
    customerEmail: 'maria@example.com',
    rating: 5,
    comment: 'Best latte in Cordova! The vanilla bean flavor is so smooth and rich. Will definitely order again.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-2',
    orderId: 'seed-order-2',
    menuItemId: 'mi-1',
    menuItemName: 'House Special Latte',
    customerName: 'Juan Dela Cruz',
    customerEmail: 'juan@example.com',
    rating: 4,
    comment: 'Really good coffee. A bit pricey but the quality is there.',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  // 10 reviews for Signature Chicken Inasal Rice Bowl (mi-5) -> 4.9 avg rating -> triggers Auto Top Rated Badge!
  {
    id: 'rev-seed-3',
    orderId: 'seed-order-3',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Ana Reyes',
    customerEmail: 'ana@example.com',
    rating: 5,
    comment: 'Authentic Cebuano flavors! The chicken is perfectly grilled and the garlic rice is amazing.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3b',
    orderId: 'seed-order-3b',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Dexter Pacana',
    customerEmail: 'dexter@example.com',
    rating: 5,
    comment: 'Juicy chicken with perfect inasal marinade! Worth every peso.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3c',
    orderId: 'seed-order-3c',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Clarisse Tan',
    customerEmail: 'clarisse@example.com',
    rating: 5,
    comment: 'Generous portion and delicious chicken oil rice!',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3d',
    orderId: 'seed-order-3d',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Mark Ybañez',
    customerEmail: 'mark@example.com',
    rating: 5,
    comment: 'Hands down the best rice bowl in Cordova!',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3e',
    orderId: 'seed-order-3e',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Sarah Lim',
    customerEmail: 'sarah@example.com',
    rating: 4,
    comment: 'Smoky grilled flavor and great calamansi soy dip.',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3f',
    orderId: 'seed-order-3f',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Paul Bentulan',
    customerEmail: 'paul@example.com',
    rating: 5,
    comment: 'Always hot when delivered! High quality comfort meal.',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3g',
    orderId: 'seed-order-3g',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Bea Alonzo',
    customerEmail: 'bea@example.com',
    rating: 5,
    comment: 'A staple order for lunch at the office.',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3h',
    orderId: 'seed-order-3h',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Gabriel Suico',
    customerEmail: 'gabriel@example.com',
    rating: 5,
    comment: 'Love the charred skin and aromatic spices.',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3i',
    orderId: 'seed-order-3i',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Hannah Vance',
    customerEmail: 'hannah@example.com',
    rating: 5,
    comment: 'Top tier food quality! Very satisfying.',
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-3j',
    orderId: 'seed-order-3j',
    menuItemId: 'mi-5',
    menuItemName: 'Signature Chicken Inasal Rice Bowl',
    customerName: 'Rico Blanco',
    customerEmail: 'rico@example.com',
    rating: 5,
    comment: 'Super fast delivery and still steaming hot!',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-4',
    orderId: 'seed-order-4',
    menuItemId: 'mi-3',
    menuItemName: 'Uji Matcha Milktea',
    customerName: 'Carlo Mendoza',
    customerEmail: 'carlo@example.com',
    rating: 4,
    comment: 'Love the cheese foam on top! Perfect drink on a hot day here in Cordova.',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
  {
    id: 'rev-seed-5',
    orderId: 'seed-order-5',
    menuItemId: 'mi-7',
    menuItemName: 'Spam & Egg Comfort Bowl',
    customerName: 'Jen Villanueva',
    customerEmail: 'jen@example.com',
    rating: 5,
    comment: 'Comfort food at its finest. The runny egg on top makes it so good!',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    hidden: false,
  },
];

type ReviewsContextValue = {
  reviews: CustomerReview[];
  addReview: (input: ReviewInput) => void;
  getReviewsByMenuItem: (menuItemId: string) => CustomerReview[];
  getAverageRating: (menuItemId: string) => MenuItemRatingSummary;
  hasReviewedOrder: (orderId: string) => boolean;
  getAllReviews: () => CustomerReview[];
  hideReview: (id: string) => void;
  unhideReview: (id: string) => void;
  deleteReview: (id: string) => void;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ReviewsState>({ reviews: seedReviews });

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ReviewsState;
      if (parsed.reviews && parsed.reviews.length > 0) {
        setState(parsed);
      }
    } catch {
      // Keep seed data on parse error
    }
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addReview = useCallback((input: ReviewInput) => {
    const newReview: CustomerReview = {
      id: createReviewId(),
      ...input,
      createdAt: new Date().toISOString(),
      hidden: false,
    };
    setState((prev) => ({
      reviews: [newReview, ...prev.reviews],
    }));
  }, []);

  const getReviewsByMenuItem = useCallback(
    (menuItemId: string) => {
      return state.reviews
        .filter((r) => r.menuItemId === menuItemId && !r.hidden)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [state.reviews],
  );

  const getAverageRating = useCallback(
    (menuItemId: string): MenuItemRatingSummary => {
      const visible = state.reviews.filter((r) => r.menuItemId === menuItemId && !r.hidden);
      if (visible.length === 0) {
        return { averageRating: 0, totalReviews: 0 };
      }
      const sum = visible.reduce((acc, r) => acc + r.rating, 0);
      return {
        averageRating: Math.round((sum / visible.length) * 10) / 10,
        totalReviews: visible.length,
      };
    },
    [state.reviews],
  );

  const hasReviewedOrder = useCallback(
    (orderId: string) => {
      return state.reviews.some((r) => r.orderId === orderId);
    },
    [state.reviews],
  );

  const getAllReviews = useCallback(() => {
    return [...state.reviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [state.reviews]);

  const hideReview = useCallback((id: string) => {
    setState((prev) => ({
      reviews: prev.reviews.map((r) => (r.id === id ? { ...r, hidden: true } : r)),
    }));
  }, []);

  const unhideReview = useCallback((id: string) => {
    setState((prev) => ({
      reviews: prev.reviews.map((r) => (r.id === id ? { ...r, hidden: false } : r)),
    }));
  }, []);

  const deleteReview = useCallback((id: string) => {
    setState((prev) => ({
      reviews: prev.reviews.filter((r) => r.id !== id),
    }));
  }, []);

  const value = useMemo<ReviewsContextValue>(
    () => ({
      reviews: state.reviews,
      addReview,
      getReviewsByMenuItem,
      getAverageRating,
      hasReviewedOrder,
      getAllReviews,
      hideReview,
      unhideReview,
      deleteReview,
    }),
    [state.reviews, addReview, getReviewsByMenuItem, getAverageRating, hasReviewedOrder, getAllReviews, hideReview, unhideReview, deleteReview],
  );

  return (
    <ReviewsContext.Provider value={value}>
      {children}
    </ReviewsContext.Provider>
  );
}

export function useReviews() {
  const ctx = useContext(ReviewsContext);
  if (!ctx) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }
  return ctx;
}
