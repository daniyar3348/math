import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AttemptRunner } from "@/components/attempt/AttemptRunner";

export default async function AttemptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <AttemptRunner locale={locale} attemptId={id} />;
}
