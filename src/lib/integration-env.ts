/**
 * Typed reads for third-party integration env vars.
 * Real secrets must come from `.env.local` / Vercel env — never hardcode.
 */

export function getShopifyEnv() {
  return {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN?.trim() ?? '',
    adminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ?? '',
  }
}

export function hasShopifyEnv() {
  const { storeDomain, adminAccessToken } = getShopifyEnv()
  return Boolean(storeDomain && adminAccessToken)
}

export function getPolarEnv() {
  return {
    accessToken: process.env.POLAR_ACCESS_TOKEN?.trim() ?? '',
    organizationId: process.env.POLAR_ORGANIZATION_ID?.trim() ?? '',
  }
}

export function hasPolarEnv() {
  return Boolean(getPolarEnv().accessToken)
}

export function getVenduraEnv() {
  return {
    apiKey: process.env.VENDURA_API_KEY?.trim() ?? '',
    apiBaseUrl: process.env.VENDURA_API_BASE_URL?.trim() ?? '',
  }
}

export function hasVenduraEnv() {
  const { apiKey } = getVenduraEnv()
  return Boolean(apiKey)
}

export function getStripeEnv() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '',
  }
}

export function hasStripeServerEnv() {
  return Boolean(getStripeEnv().secretKey)
}

export function hasStripePublishableEnv() {
  return Boolean(getStripeEnv().publishableKey)
}

export function hasStripeWebhookEnv() {
  return Boolean(getStripeEnv().webhookSecret)
}

export function hasOpenAiEnv() {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export function hasInboxApiEnv() {
  return Boolean(process.env.INBOX_API_KEY?.trim())
}

export function hasSnipcartPublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SNIPCART_PUBLIC_API_KEY?.trim())
}
