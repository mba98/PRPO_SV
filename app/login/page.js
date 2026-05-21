import { Suspense } from 'react';
import LoginForm from './LoginForm';
import { AnimatedSkeletonLoader } from '@/components/ui';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <AnimatedSkeletonLoader variant="card" count={1} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
