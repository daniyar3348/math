import { notFound } from "next/navigation";
import { isLocale, t, pickPair } from "@/lib/i18n";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const kk =
    "Платформаны пайдалана отырып, сіз оқу материалдарын тек жеке білім алу мақсатында қолдануға, аккаунт деректерін бөгде адамдарға бермеуге және басқа пайдаланушыларды құрметтеуге келісесіз. Ақылы материалдарға қолжетімділік төлем расталғаннан кейін ашылады. Платформа әкімшілігі ережені бұзған аккаунттарды шектеуге құқылы.";
  const ru =
    "Используя платформу, вы соглашаетесь применять учебные материалы только в личных образовательных целях, не передавать данные аккаунта третьим лицам и уважительно относиться к другим пользователям. Доступ к платным материалам открывается после подтверждения оплаты. Администрация вправе ограничивать аккаунты, нарушающие правила.";
  return (
    <div className="container-app max-w-2xl py-12">
      <h1 className="text-3xl font-extrabold">{t(locale, "footer.terms")}</h1>
      <p className="mt-5 leading-relaxed text-slate-700">{pickPair(locale, kk, ru)}</p>
    </div>
  );
}
