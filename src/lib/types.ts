export type Segment = 'agency' | 'creator' | 'studio' | 'partner' | 'advertiser' | 'sugar_platform'
export type OutreachStatus = 'not_contacted' | 'contacted' | 'replied' | 'meeting_set' | 'negotiating' | 'closed_won' | 'closed_lost'
export type UserRole = 'admin' | 'sales' | 'support' | 'client'

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
  lead_id?: number
  is_private: boolean
  created_at: string
}

export interface ChatMessage {
  id: number
  room_id: number
  sender_id: string
  content: string
  is_encrypted: boolean
  read: boolean
  created_at: string
  profiles?: Profile
}
