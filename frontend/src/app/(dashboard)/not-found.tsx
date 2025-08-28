'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardNotFound() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 md:ml-64">
            <div className="min-h-screen flex items-center justify-center">
              <div className="max-w-md w-full space-y-8 text-center">
                <div>
                  <h1 className="text-9xl font-bold text-gray-200">404</h1>
                  <h2 className="mt-6 text-3xl font-bold text-gray-900">Page not found</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    This page doesn&apos;t exist in your dashboard.
                  </p>
                </div>
                <div className="space-y-4">
                  <Link href="/dashboard">
                    <Button className="w-full">Go to Dashboard</Button>
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}