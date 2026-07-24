import { notFound } from "next/navigation";
import { isLocale, t, pickPair } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const s = await getSettings();
  const kk = `Біз тек оқу процесіне қажетті ең аз дербес деректерді жинаймыз: аты-жөні, байланыс деректері (телефон/email), оқу нәтижелері. Деректер үшінші тұлғаларға сатылмайды. Кәмелетке толмағандардың деректері ерекше қорғаумен өңделеді; жария рейтингтен бас тарту мүмкіндігі бар. Сұрақтар бойынша: ${s.contacts.email ?? ""}.`;
  const ru = `Мы собираем только минимально необходимые для обучения персональные данные: имя, контакты (телефон/email), учебные результаты. Данные не продаются третьим лицам. Данные несовершеннолетних обрабатываются с повышенной защитой; предусмотрен отказ от публичного рейтинга. Вопросы: ${s.contacts.email ?? ""}.`;
  return (
    <div className="container-app max-w-2xl py-12">
      <h1 className="text-3xl font-extrabold">{t(locale, "footer.privacy")}</h1>
      <p className="mt-5 leading-relaxed text-slate-700">{pickPair(locale, kk, ru)}</p>
    </div>
  );
}
