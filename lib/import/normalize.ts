/**
 * Merchant normalization: the same merchant must always produce the same
 * string, because merchant rules match exactly on the output. The PRD calls
 * this out as the real IP of the import layer.
 */

const PROCESSOR_PREFIXES = [
  /^SQ\s*\*\s*/i, // Square
  /^TST\*\s*/i, // Toast
  /^PAYPAL\s*\*\s*/i,
  /^PY\s*\*\s*/i,
  /^SP\s+/i, // Shopify
  /^AMZN\s+MKTP\s+/i,
  /^APLPAY\s+/i,
  /^GOOGLE\s*\*\s*/i,
];

const CANADIAN_PROVINCES = /\b(QC|ON|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)\b\s*$/i;

const CITY_SUFFIXES =
  /\b(MONTREAL|MONTREAL QC|TORONTO|VANCOUVER|CALGARY|OTTAWA|QUEBEC|LAVAL|LONGUEUIL|VERDUN|WESTMOUNT|BROSSARD)\b\s*$/i;

export function normalizeMerchant(description: string): string {
  let s = description.toUpperCase().trim();

  for (const prefix of PROCESSOR_PREFIXES) s = s.replace(prefix, "");

  // Strip long digit runs (card refs, phone numbers) and store numbers like #1234
  s = s.replace(/#\s*\d+/g, " ");
  s = s.replace(/\b\d{5,}\b/g, " ");

  // Strip trailing province, then trailing city (order matters: "IGA MONTREAL QC")
  s = s.replace(CANADIAN_PROVINCES, " ");
  s = s.replace(CITY_SUFFIXES, " ");
  s = s.replace(CANADIAN_PROVINCES, " ");

  // Collapse punctuation noise and whitespace
  s = s.replace(/[*_|]/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  s = s.replace(/[\s\-.,]+$/, "").trim();

  return s;
}
