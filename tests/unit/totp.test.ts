// TOTP (RFC 6238): проверка по официальным тестовым векторам SHA-1 и окно ±1 шаг.
import { describe, it, expect } from "vitest";
import { base32Decode, base32Encode, totpCode, verifyTotp, generateTotpSecret } from "@/lib/auth/totp";

// ASCII-секрет из RFC 6238 Appendix B
const RFC_SECRET_B32 = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("encode/decode — обратимы", () => {
    const buf = Buffer.from("бөлшек bilim 2026", "utf8");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
});

describe("totpCode", () => {
  it("совпадает с векторами RFC 6238 (SHA-1, 8 цифр)", () => {
    expect(totpCode(RFC_SECRET_B32, 59_000, 30, 8)).toBe("94287082");
    expect(totpCode(RFC_SECRET_B32, 1_111_111_109_000, 30, 8)).toBe("07081804");
    expect(totpCode(RFC_SECRET_B32, 20_000_000_000_000, 30, 8)).toBe("65353130");
  });
});

describe("verifyTotp", () => {
  it("принимает текущий код и коды соседних шагов (±30с)", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, totpCode(secret))).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, Date.now() - 30_000))).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, Date.now() + 30_000))).toBe(true);
  });
  it("отклоняет устаревший код и неверный формат", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, totpCode(secret, Date.now() - 120_000))).toBe(false);
    expect(verifyTotp(secret, "abc123")).toBe(false);
    expect(verifyTotp(secret, "12345")).toBe(false);
  });
});
