import type { NormalizedPhone } from "@/lib/integrations/types/normalized";

// One normalizer function per supported country, keyed by ISO code. Adding a
// new country later means adding one entry here — nothing else in the
// integration layer needs to change.
type CountryNormalizer = (digits: string) => string | null;

// Egyptian mobile numbers: 10 digits after the country code, starting with
// 1 then one of 0/1/2/5 (the four network prefixes: 010, 011, 012, 015).
const EGYPT_MOBILE_PATTERN = /^1[0125]\d{8}$/;

const normalizeEgypt: CountryNormalizer = (digits) => {
  // +201012345678 / 201012345678 -> digits === "201012345678"
  if (digits.startsWith("20") && digits.length === 12 && EGYPT_MOBILE_PATTERN.test(digits.slice(2))) {
    return `+${digits}`;
  }
  // 01012345678
  if (digits.startsWith("0") && digits.length === 11 && EGYPT_MOBILE_PATTERN.test(digits.slice(1))) {
    return `+20${digits.slice(1)}`;
  }
  // 1012345678 (leading 0 already stripped by whoever entered it)
  if (digits.length === 10 && EGYPT_MOBILE_PATTERN.test(digits)) {
    return `+20${digits}`;
  }
  return null;
};

const COUNTRY_NORMALIZERS: Record<string, CountryNormalizer> = {
  EG: normalizeEgypt,
};

export const DEFAULT_PHONE_COUNTRY = "EG";

export function normalizePhone(raw: string, country: string = DEFAULT_PHONE_COUNTRY): NormalizedPhone {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const normalizer = COUNTRY_NORMALIZERS[country];
  const normalized = normalizer ? normalizer(digits) : null;

  return { raw, normalized, country };
}
