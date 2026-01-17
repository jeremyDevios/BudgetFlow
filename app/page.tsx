'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has completed onboarding
    if (typeof window !== 'undefined') {
      const profile = localStorage.getItem('budgetflow-profile');
      if (profile) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-xl text-gray-600">Chargement...</div>
    </div>
  );
}
