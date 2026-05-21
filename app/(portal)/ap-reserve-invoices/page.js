import PageHeader from '@/components/layout/PageHeader';
import ApriListManager from '@/components/ap-reserve-invoices/ApriListManager';

export default function ApReserveInvoicesPage() {
  return (
    <div>
      <PageHeader
        title="A/P Reserve Invoices"
        description="Reserve invoices created from SAP purchase orders."
      />
      <ApriListManager />
    </div>
  );
}
