'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CustomerAuthForm } from '@/components/customer/CustomerAuthForm';

export default function CustomerRegisterPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/customer');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen bg-[#fffbf2] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return <CustomerAuthForm mode="signup" />;
}
