import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { ResultView } from "@/components/attempt/ResultView";

export default async function ResultPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <ResultView locale={locale} attemptId={id} />;
}
