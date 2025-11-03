import CustomerManager from '@/components/CustomerManager';
import { loadCustomerRecords, loadTemplateDefinitions } from '@/lib/markdown';

export default async function Home() {
  const [customers, templates] = await Promise.all([
    loadCustomerRecords(),
    loadTemplateDefinitions(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CustomerManager customers={customers} templates={templates} />
    </div>
  );
}
