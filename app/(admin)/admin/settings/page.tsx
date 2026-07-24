"use client";

// Настройки платформы (§12/§15): бренд, цвета, контакты, hero и FAQ лендинга.
import { useEffect, useState } from "react";
import { api, Field, type Row } from "@/components/admin/kit";

interface Faq { qKk: string; qRu: string; aKk: string; aRu: string }

export default function SettingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [brandName, setBrandName] = useState("BilimHub");
  const [primaryColor, setPrimaryColor] = useState("#6d28d9");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressKk, setAddressKk] = useState("");
  const [addressRu, setAddressRu] = useState("");
  const [heroKk, setHeroKk] = useState("");
  const [heroRu, setHeroRu] = useState("");
  const [heroSubKk, setHeroSubKk] = useState("");
  const [heroSubRu, setHeroSubRu] = useState("");
  const [faq, setFaq] = useState<Faq[]>([]);

  useEffect(() => {
    api<{ row: Row | null }>("/api/admin/settings")
      .then(({ row }) => {
        if (row) {
          setBrandName(row.brandName);
          setPrimaryColor(row.primaryColor);
          setAccentColor(row.accentColor);
          const c = (row.contacts ?? {}) as Row;
          setPhone(c.phone ?? "");
          setEmail(c.email ?? "");
          setAddressKk(c.address?.kk ?? "");
          setAddressRu(c.address?.ru ?? "");
          const l = (row.landing ?? {}) as Row;
          setHeroKk(l.heroKk ?? "");
          setHeroRu(l.heroRu ?? "");
          setHeroSubKk(l.heroSubKk ?? "");
          setHeroSubRu(l.heroSubRu ?? "");
          if (Array.isArray(l.faq)) setFaq(l.faq as Faq[]);
        }
        setLoaded(true);
      })
      .catch((e) => { setError(e.message); setLoaded(true); });
  }, []);

  const save = async () => {
    setError("");
    setSaved(false);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          brandName,
          primaryColor,
          accentColor,
          contacts: {
            phone: phone || undefined,
            email: email || undefined,
            address: addressKk || addressRu ? { kk: addressKk || undefined, ru: addressRu || undefined } : undefined,
          },
          landing: {
            heroKk, heroRu, heroSubKk, heroSubRu,
            faq: faq.filter((f) => f.qKk || f.qRu),
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (!loaded) return <div className="skeleton h-60 w-full" />;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold">Настройки платформы</h1>
      <p className="mt-1 text-sm text-slate-400">Бренд, цвета и контакты применяются на всём сайте; hero и FAQ — на главной странице.</p>

      <section className="card mt-5 space-y-4 p-5">
        <h2 className="font-bold">Бренд</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Название">
            <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </Field>
          <Field label="Основной цвет">
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Основной цвет" className="h-10 w-12 cursor-pointer rounded border border-slate-200" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
          </Field>
          <Field label="Акцентный цвет">
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Акцентный цвет" className="h-10 w-12 cursor-pointer rounded border border-slate-200" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              <input className="input" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </div>
          </Field>
        </div>
      </section>

      <section className="card mt-4 space-y-4 p-5">
        <h2 className="font-bold">Контакты</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Телефон"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="E-mail"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Адрес (KK)"><input className="input" value={addressKk} onChange={(e) => setAddressKk(e.target.value)} /></Field>
          <Field label="Адрес (RU)"><input className="input" value={addressRu} onChange={(e) => setAddressRu(e.target.value)} /></Field>
        </div>
      </section>

      <section className="card mt-4 space-y-4 p-5">
        <h2 className="font-bold">Главная страница</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Заголовок hero (KK)"><input className="input" value={heroKk} onChange={(e) => setHeroKk(e.target.value)} /></Field>
          <Field label="Заголовок hero (RU)"><input className="input" value={heroRu} onChange={(e) => setHeroRu(e.target.value)} /></Field>
          <Field label="Подзаголовок (KK)"><textarea className="input resize-y" rows={2} value={heroSubKk} onChange={(e) => setHeroSubKk(e.target.value)} /></Field>
          <Field label="Подзаголовок (RU)"><textarea className="input resize-y" rows={2} value={heroSubRu} onChange={(e) => setHeroSubRu(e.target.value)} /></Field>
        </div>
        <div>
          <p className="label">FAQ</p>
          <div className="space-y-3">
            {faq.map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input className="input" placeholder="Вопрос (KK)" value={f.qKk} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, qKk: e.target.value } : x)))} />
                  <input className="input" placeholder="Вопрос (RU)" value={f.qRu} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, qRu: e.target.value } : x)))} />
                  <textarea className="input resize-y" rows={2} placeholder="Ответ (KK)" value={f.aKk} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, aKk: e.target.value } : x)))} />
                  <textarea className="input resize-y" rows={2} placeholder="Ответ (RU)" value={f.aRu} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, aRu: e.target.value } : x)))} />
                </div>
                <button className="btn-ghost mt-2 !px-2 !py-1 text-xs text-red-500" onClick={() => setFaq(faq.filter((_, j) => j !== i))}>Удалить вопрос</button>
              </div>
            ))}
            <button className="btn-ghost text-xs" onClick={() => setFaq([...faq, { qKk: "", qRu: "", aKk: "", aRu: "" }])}>+ вопрос FAQ</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Если FAQ пуст, на сайте показываются стандартные вопросы.</p>
        </div>
      </section>

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" onClick={save}>Сохранить настройки</button>
        {saved && <span role="status" className="text-sm font-semibold text-green-600">✓ Сохранено</span>}
        {error && <span role="alert" className="text-sm font-semibold text-red-600">{error}</span>}
      </div>
    </div>
  );
}
