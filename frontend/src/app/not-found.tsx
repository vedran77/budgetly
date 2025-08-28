import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-9xl font-bold text-gray-200">404</h1>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Page not found</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>
        <div className="space-y-4">
          <Link href="/dashboard">
            <Button className="w-full mb-3">Go to Dashboard</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full mt-1">Go to Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}