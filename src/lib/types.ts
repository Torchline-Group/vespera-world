export type Segment = 'agency' | 'creator' | 'studio' | 'partner' | 'advertiser' | 'sugar_platform'
export type OutreachStatus = 'not_contacted' | 'contacted' | 'replied' | 'meeting_set' | 'negotiating' | 'closed_won' | 'closed_lost'
export type UserRole = 'admin' | 'sales' | 'support' | 'client'
export type ChannelType = 'internal' | 'email' | 'whatsapp' | 'telegram' | 'call'
export type ProviderType = 'native' | 'chatwoot' | 'helpwise' | 'whatsapp' | 'telegram' | 'email' | 'voice'
export type StorefrontMode = 'liquid' | 'headless'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  avatar_url?: string
  created_at: string
}

export interface Lead {
  id: number
  company_name: string
  segment: Segment
  sub_segment?: string
  contact_name?: string
  contact_role?: string
  contact_email?: string
  contact_social?: string
  website_url?: string
  creator_count: number
  est_monthly_revenue: number
  current_platforms?: string
  current_tools?: string
  pain_points?: string
  source?: string
  source_url?: string
  outreach_status: OutreachStatus
  fit_score: number
  close_probability: number
  est_deal_value: number
  next_action?: string
  next_action_date?: string
  notes?: string
  assigned_to?: string
  created_at: string
  updated_at: string
}

export interface Activity {
  id: number
  lead_id: number
  type: string
  description: string
  created_by?: string
  created_at: string
}

export interface ChatRoom {
  id: number
  name: string
  channel: ChannelType
  lead_id?: number
  is_private: boolean
  external_contact?: string
  provider: ProviderType
  provider_room_id?: string
  assigned_to?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'pending' | 'resolved' | 'closed'
  last_inbound_at?: string
  first_response_at?: string
  sla_first_response_due_at?: string
  sla_status: 'none' | 'active' | 'met' | 'breached'
  created_at: string
}

export interface ChatMessage {
  id: number
  room_id: number
  sender_id: string
  content: string
  direction: 'inbound' | 'outbound' | 'system'
  original_language?: string
  translated_language?: string
  translated_content?: string
  metadata?: Record<string, unknown>
  is_encrypted: boolean
  read: boolean
  created_at: string
  profiles?: Profile
}

export interface ChannelConnection {
  id: number
  provider: Exclude<ProviderType, 'native'>
  label: string
  is_active: boolean
  webhook_url?: string
  api_key?: string
  config: Record<string, unknown>
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CommunicationEvent {
  id: number
  lead_id?: number
  room_id?: number
  channel: ChannelType
  direction: 'inbound' | 'outbound'
  subject?: string
  body: string
  status: string
  external_id?: string
  created_by?: string
  created_at: string
}

export interface CannedResponse {
  id: number
  title: string
  language: 'en' | 'es'
  channel: 'all' | ChannelType
  body: string
  tags?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Product {
  id: number
  source: 'shopify' | 'manual' | 'csv'
  external_id?: string
  handle: string
  title: string
  body_html?: string
  vendor?: string
  product_type?: string
  tags?: string
  status: 'draft' | 'active' | 'archived'
  price: number
  compare_at_price?: number
  sku?: string
  inventory_qty: number
  featured_image_url?: string
  published_at?: string
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: number
  product_id: number
  src: string
  alt?: string
  position: number
  created_at: string
}

export interface ContentBlock {
  id: number
  slug: string
  title: string
  body: string
  type: 'hero' | 'rich_text' | 'faq' | 'banner' | 'custom'
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface PortalForm {
  id: number
  title: string
  description?: string
  fields_json: string
  status: 'draft' | 'published' | 'archived'
  created_by?: string
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: number
  form_id: number
  submitted_by?: string
  payload_json: string
  created_at: string
}

export interface DocumentAcknowledgement {
  id: number
  title: string
  content: string
  signer_name: string
  signer_email?: string
  signed_at: string
  signer_ip?: string
  signer_user_agent?: string
  created_by?: string
}
