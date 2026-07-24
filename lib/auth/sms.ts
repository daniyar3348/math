// Абстракция SMS-провайдера (§4). Выбор через env SMS_PROVIDER.
// dev  — печатает код в консоль сервера; наружу код отдаётся ТОЛЬКО не в production.
// http — заготовка для реального шлюза (URL+token из env), без привязки к вендору.

export interface SmsProvider {
  /** Отправить OTP. Возвращает devCode только в безопасном dev-режиме. */
  sendOtp(phone: string, code: string): Promise<{ devCode?: string }>;
}

class DevSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    // Код в общий лог не «утекает» в production: провайдер dev там запрещён.
    console.log(`[sms:dev] OTP для ${phone.slice(0, 5)}***: ${code}`);
    if (process.env.NODE_ENV !== "production") return { devCode: code };
    return {};
  }
}

class HttpSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    const url = process.env.SMS_HTTP_URL;
    const token = process.env.SMS_HTTP_TOKEN;
    if (!url) throw new Error("SMS_HTTP_URL is not configured");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ phone, text: `BilimHub: код ${code}` }),
    });
    if (!res.ok) throw new Error(`SMS gateway error ${res.status}`);
    return {};
  }
}

export function smsProvider(): SmsProvider {
  const kind = process.env.SMS_PROVIDER ?? "dev";
  if (kind === "http") return new HttpSmsProvider();
  if (kind === "dev" && process.env.NODE_ENV === "production") {
    throw new Error("SMS_PROVIDER=dev запрещён в production");
  }
  return new DevSmsProvider();
}
