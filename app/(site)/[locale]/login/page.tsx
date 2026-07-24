import { notFound } from "next/navigation";
import { isLocale, t } from "@/lib/i18n";
import { LoginForm } from "@/components/site/LoginForm";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="container-app max-w-md py-14">
      <h1 className="text-2xl font-extrabold">{t(locale, "auth.loginTitle")}</h1>
      <LoginForm locale={locale} />
    </div>
  );
}
