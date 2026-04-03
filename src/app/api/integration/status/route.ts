import {
  hasInboxApiEnv,
  hasOpenAiEnv,
  hasPolarEnv,
  hasShopifyEnv,
  hasSnipcartPublicEnv,
  hasStripePublishableEnv,
  hasStripeServerEnv,
  hasStripeWebhookEnv,
  hasVenduraEnv,
} from '@/lib/integration-env'
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * Returns which integration env vars are configured (booleans only — never secret values).
 * Requires a signed-in user so this is not a public probe endpoint.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    shopify: hasShopifyEnv(),
    polar: hasPolarEnv(),
    vendura: hasVenduraEnv(),
    stripe: {
      secret: hasStripeServerEnv(),
      publishable: hasStripePublishableEnv(),
      webhook: hasStripeWebhookEnv(),
    },
    openai: hasOpenAiEnv(),
    inbox: hasInboxApiEnv(),
    snipcartPublic: hasSnipcartPublicEnv(),
  })
}
