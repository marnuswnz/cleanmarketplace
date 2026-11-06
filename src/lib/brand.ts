/** Brand placeholders — swap when the name is final. */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "[BRAND]",
  city: "Christchurch",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hello@example.co.nz",
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@example.co.nz",
  legalEntity: process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? "[BRAND] Limited",
};
