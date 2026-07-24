import { TestBuilder } from "@/components/admin/TestBuilder";

export default async function TestBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestBuilder testId={id === "new" ? null : id} />;
}
