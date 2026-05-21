import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken, getCurrentUser, userHasPermission } from '@/lib/auth';
import PageHeader from '@/components/layout/PageHeader';
import PrCreateForm from '@/components/purchase-requests/PrCreateForm';

export default async function CreatePurchaseRequestPage() {
  const token = cookies().get('portal_session')?.value;
  if (!token) redirect('/login');
  const session = await verifyToken(token);
  const user = await getCurrentUser(session);
  if (!user || !userHasPermission(user, ['pr.create'])) {
    redirect('/purchase-requests');
  }

  return (
    <div>
      <PageHeader
        title="New Purchase Request"
        description="Enter header details, line items, and attachments, then submit for approval."
        actions={
          <Link href="/purchase-requests" className="btn-secondary">
            Back to list
          </Link>
        }
      />
      <PrCreateForm />
    </div>
  );
}
