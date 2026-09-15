export const landingConfig = {
  appStoreUrl: import.meta.env.VITE_APP_STORE_URL?.trim() ?? '',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '',
  canonicalUrl:
    import.meta.env.VITE_CANONICAL_URL?.trim() ?? 'https://ohgiwk.github.io/SmithNote/',
  updatedAt: '2026年8月10日',
} as const;
