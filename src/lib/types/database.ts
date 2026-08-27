// Hand-written to mirror supabase/migrations/*.sql. Once the project is linked
// to a real Supabase project, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.ts
// and re-apply any manual additions below the generated block if needed.
//
// Row types must be `type` aliases, not `interface`s: interfaces don't satisfy
// the `extends Record<string, unknown>` constraint supabase-js's generic
// client requires, which silently collapses every query result to `never`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update = Partial<Insert>, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type PermissionRow = {
  id: string;
  key: string;
  description: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerStatus = "active" | "inactive" | "blocked" | "merged";
export type ScoreCategory = "excellent" | "trusted" | "medium_risk" | "high_risk";

export type CustomerRow = {
  id: string;
  full_name: string;
  email: string | null;
  status: CustomerStatus;
  source: string | null;
  assigned_to: string | null;
  merged_into: string | null;
  customer_since: string;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  total_spend: number;
  avg_order_value: number;
  first_order_at: string | null;
  last_order_at: string | null;
  score: number;
  score_category: ScoreCategory;
  referred_by_customer_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CustomerListViewRow = {
  id: string;
  full_name: string;
  email: string | null;
  status: CustomerStatus;
  score: number;
  score_category: ScoreCategory;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  total_spend: number;
  avg_order_value: number;
  last_order_at: string | null;
  customer_since: string;
  assigned_to: string | null;
  created_at: string;
  deleted_at: string | null;
  primary_phone: string | null;
  order_ids: string;
  tag_names: string[];
  tag_ids: string[];
  cancelled_gt_delivered: boolean;
};

export type SegmentCustomerViewRow = {
  id: string;
  full_name: string;
  email: string | null;
  status: CustomerStatus;
  score: number;
  score_category: ScoreCategory;
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  total_spend: number;
  avg_order_value: number;
  last_order_at: string | null;
  customer_since: string;
  assigned_to: string | null;
  deleted_at: string | null;
  tag_names: string[];
  cancellation_risk_category: RiskLevel;
  delivery_risk_category: RiskLevel;
  return_risk_category: RiskLevel;
  overall_risk_category: RiskLevel;
  governorates: string[];
  purchased_categories: string[];
  purchased_products: string[];
};

export type CustomerPhoneRow = {
  id: string;
  customer_id: string;
  phone: string;
  phone_normalized: string | null;
  is_primary: boolean;
  created_at: string;
};

export type CustomerAddressRow = {
  id: string;
  customer_id: string;
  label: string | null;
  address_line: string;
  city: string | null;
  governorate: string | null;
  area: string | null;
  details: string | null;
  country: string;
  is_primary: boolean;
  created_at: string;
};

export type TagRow = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
};

export type TagSource = "manual" | "rule" | "ai";

export type CustomerTagRow = {
  id: string;
  customer_id: string;
  tag_id: string;
  source: TagSource;
  added_by: string | null;
  created_at: string;
  removed_at: string | null;
};

export type CustomerEventRow = {
  id: string;
  customer_id: string;
  event_type: string;
  title: string | null;
  description: string | null;
  metadata: Json;
  related_order_id: string | null;
  related_employee_id: string | null;
  created_at: string;
};

export type CustomerNoteRow = {
  id: string;
  customer_id: string;
  author_id: string;
  content: string;
  related_order_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type FollowUpType = "call" | "whatsapp" | "general";
export type FollowUpPriority = "low" | "medium" | "high" | "urgent";
// Stored status never includes "overdue" — that's derived at query time from
// (status = 'pending' AND due_date < now()). See DisplayFollowUpStatus below.
export type FollowUpStatus = "pending" | "completed" | "cancelled";
export type DisplayFollowUpStatus = FollowUpStatus | "overdue";

export type FollowUpRow = {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  type: FollowUpType;
  title: string;
  due_date: string;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ScoreHistoryRow = {
  id: string;
  customer_id: string;
  score: number;
  category: ScoreCategory;
  previous_score: number | null;
  score_diff: number | null;
  trigger_event: string | null;
  reason: string | null;
  created_at: string;
};

export type ScoringRuleRow = {
  id: string;
  key: string;
  label: string;
  weight: number;
  threshold: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ScoreCategoryThresholdRow = {
  id: string;
  category: ScoreCategory;
  min_score: number;
  label: string;
  created_at: string;
  updated_at: string;
};

export type RiskLevel = "low" | "medium" | "high";
export type RiskType = "cancellation" | "delivery" | "return" | "overall";

export type CustomerRiskProfileRow = {
  customer_id: string;
  cancellation_risk: number;
  delivery_risk: number;
  return_risk: number;
  overall_risk: number;
  cancellation_risk_category: RiskLevel;
  delivery_risk_category: RiskLevel;
  return_risk_category: RiskLevel;
  overall_risk_category: RiskLevel;
  computed_at: string;
};

export type RiskConfigRow = {
  id: string;
  risk_type: RiskType;
  category: RiskLevel;
  min_threshold: number;
  created_at: string;
  updated_at: string;
};

export type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  is_dynamic: boolean;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SegmentRuleRow = {
  id: string;
  segment_id: string;
  conditions: Json;
  created_at: string;
};

export type IntegrationStatus = "not_configured" | "connected" | "disconnected" | "error";

export type IntegrationRow = {
  id: string;
  name: string;
  provider: string;
  type: "rest" | "webhook";
  config: Json;
  capabilities: Json;
  is_active: boolean;
  status: IntegrationStatus;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SyncRunStatus = "queued" | "running" | "completed" | "partially_failed" | "failed";
export type SyncRunType = "manual" | "scheduled" | "webhook";

export type SyncRunRow = {
  id: string;
  integration_id: string | null;
  source: string;
  event_type: string | null;
  sync_type: SyncRunType;
  status: SyncRunStatus;
  total_records: number;
  successful_records: number;
  failed_records: number;
  error_summary: string | null;
  errors: Json | null;
  retry_count: number;
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
};

export type SyncRunItemStatus = "success" | "failed" | "skipped";

export type SyncRunItemRow = {
  id: string;
  sync_run_id: string;
  entity_type: string;
  external_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  status: SyncRunItemStatus;
  error: string | null;
  created_at: string;
};

export type WebhookEventStatus = "received" | "processing" | "processed" | "failed" | "duplicate";

export type WebhookEventRow = {
  id: string;
  source: string;
  event_type: string;
  external_event_id: string | null;
  payload: Json;
  idempotency_key: string;
  status: WebhookEventStatus;
  error: string | null;
  retry_count: number;
  next_retry_at: string | null;
  processed_at: string | null;
  created_at: string;
};

export type CustomerExternalIdRow = {
  id: string;
  customer_id: string;
  source: string;
  external_id: string;
  metadata: Json;
  created_at: string;
};

export type ExternalStatusMappingRow = {
  id: string;
  source: string;
  external_status: string;
  internal_status: OrderStatus;
  created_at: string;
};

export type DuplicateCandidateRow = {
  id: string;
  customer_id_a: string;
  customer_id_b: string;
  confidence_score: number;
  signals: Json;
  status: "pending" | "ignored" | "merged";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type CustomerMergeRow = {
  id: string;
  primary_customer_id: string;
  merged_customer_id: string;
  merged_by: string | null;
  audit: Json;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  created_at: string;
};

export type AiInsightCategory =
  | "cancellation"
  | "churn"
  | "repeat_purchase"
  | "high_value"
  | "risk_trend"
  | "follow_up_performance"
  | "automation_performance";

export type AiInsightRow = {
  id: string;
  category: string;
  title: string;
  description: string;
  fact_summary: string;
  inference: string | null;
  recommended_action: string | null;
  supporting_metrics: Json;
  priority: string;
  confidence: number | null;
  provider: string | null;
  model: string | null;
  data_snapshot_hash: string | null;
  related_customer_id: string | null;
  generated_at: string;
};

export type AiCustomerSummaryRow = {
  customer_id: string;
  summary: string;
  key_points: Json;
  concerns: Json;
  recommended_action: string | null;
  data_snapshot_hash: string;
  is_stale: boolean;
  provider: string;
  model: string;
  generated_at: string;
  updated_at: string;
};

export type AiSuggestionType = "next_best_action" | "tag_suggestion" | "duplicate_merge" | "new_tag_request";
export type AiSuggestionStatus = "pending" | "approved" | "rejected" | "expired" | "applied" | "failed";

export type AiSuggestionRow = {
  id: string;
  type: AiSuggestionType;
  customer_id: string | null;
  duplicate_candidate_id: string | null;
  proposed_action: Json;
  reason: string;
  priority: string | null;
  confidence: number | null;
  suggested_timing: string | null;
  status: AiSuggestionStatus;
  applied_result: Json | null;
  error: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  usage_log_id: string | null;
  created_at: string;
};

export type AiFeature =
  | "customer_summary"
  | "next_best_action"
  | "tag_suggestion"
  | "risk_explanation"
  | "duplicate_analysis"
  | "business_insight"
  | "assistant"
  | "call_note_analysis";

export type AiUsageLogRow = {
  id: string;
  user_id: string | null;
  feature: AiFeature;
  entity_type: string | null;
  entity_id: string | null;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  cost_is_estimated: boolean;
  duration_ms: number | null;
  status: "success" | "failed";
  error: string | null;
  created_at: string;
};

export type AiModelPricingRow = {
  id: string;
  provider: string;
  model: string;
  input_price_per_1k: number;
  output_price_per_1k: number;
  effective_from: string;
  created_at: string;
};

export type AiFeedbackRow = {
  id: string;
  user_id: string;
  output_type: string;
  output_id: string;
  rating: "helpful" | "not_helpful";
  feedback_text: string | null;
  created_at: string;
};

export type AiConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls: Json | null;
  created_at: string;
};

export type AutomationRuleRow = {
  id: string;
  name: string;
  trigger_event: string;
  conditions: Json;
  actions: Json;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type AutomationExecutionRow = {
  id: string;
  automation_rule_id: string | null;
  customer_id: string | null;
  trigger_event: string | null;
  status: AutomationExecutionStatus;
  result: Json | null;
  error: string | null;
  idempotency_key: string | null;
  started_at: string;
  completed_at: string | null;
};

export type NotificationType = "high_risk_customer" | "duplicate_candidate" | "automation_failed" | "follow_up_assigned";

export type NotificationRow = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

// "new" and "processing"/"failed_delivery" cover statuses external sources use
// that don't map 1:1 onto the original Phase 2 set (see external_status_mappings).
export type OrderStatus =
  | "new"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "failed_delivery";

export type OrderRow = {
  id: string;
  customer_id: string;
  source: string;
  external_order_id: string | null;
  status: OrderStatus;
  product_summary: string | null;
  total_amount: number;
  ordered_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  returned_at: string | null;
  ad_cost: number | null;
  shipping_cost: number | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type CallAttemptResult = "no_answer" | "confirmed" | "cancelled" | "reschedule" | "invalid_number";

export type OrderCallAttemptRow = {
  id: string;
  order_id: string;
  agent_id: string;
  result: CallAttemptResult;
  notes: string | null;
  reason_category: string | null;
  attempted_at: string;
};

export type ExperimentStatus = "running" | "completed";

export type ExperimentRow = {
  id: string;
  name: string;
  category: string;
  hypothesis: string | null;
  variant_a_name: string;
  variant_a_metric_value: number | null;
  variant_b_name: string;
  variant_b_metric_value: number | null;
  metric_label: string;
  status: ExperimentStatus;
  winner: string | null;
  notes: string | null;
  created_by: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  default_price: number;
  cost_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name_raw: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  created_at: string;
};

export type MessageChannel = "whatsapp" | "sms";
export type CommunicationStatus = "sent" | "failed";

export type CommunicationRow = {
  id: string;
  customer_id: string;
  channel: MessageChannel;
  direction: "outbound" | "inbound";
  body: string;
  status: CommunicationStatus;
  provider: string;
  provider_message_id: string | null;
  error: string | null;
  related_order_id: string | null;
  sent_by: string | null;
  created_at: string;
};

export type CampaignTriggerType = "order_delivered" | "customer_inactive";
export type CampaignEnrollmentStatus = "active" | "completed" | "exited";

export type CampaignRow = {
  id: string;
  name: string;
  trigger_type: CampaignTriggerType;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignStepRow = {
  id: string;
  campaign_id: string;
  step_order: number;
  delay_days: number;
  channel: MessageChannel;
  message_template: string;
  created_at: string;
};

export type CampaignEnrollmentRow = {
  id: string;
  campaign_id: string;
  customer_id: string;
  related_order_id: string | null;
  current_step_index: number;
  next_send_at: string;
  status: CampaignEnrollmentStatus;
  exit_reason: string | null;
  enrolled_at: string;
  completed_at: string | null;
};

export type OfferRow = {
  id: string;
  name: string;
  description: string | null;
  loyalty_tier_id: string | null;
  segment_id: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CouponDiscountType = "percentage" | "fixed";

export type CouponRow = {
  id: string;
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  loyalty_tier_id: string | null;
  segment_id: string | null;
  usage_limit: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CouponRedemptionRow = {
  id: string;
  coupon_id: string;
  customer_id: string;
  related_order_id: string | null;
  redeemed_by: string | null;
  redeemed_at: string;
};

export type CustomerAcquisitionRow = {
  customer_id: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  landing_page: string | null;
  first_touch_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CallAttemptAnalysisRow = {
  call_attempt_id: string;
  quality_score: number | null;
  attempted_upsell: boolean | null;
  customer_objection: string | null;
  improvement_suggestion: string | null;
  provider: string;
  model: string;
  generated_at: string;
};

export type AgentGoalRow = {
  id: string;
  agent_id: string;
  period_month: string;
  target_confirmed_orders: number;
  target_revenue: number;
  created_at: string;
  updated_at: string;
};

export type PerformanceConfigRow = {
  id: string;
  commission_rate_percent: number;
  xp_per_confirmed_order: number;
  xp_per_completed_followup: number;
  updated_at: string;
};

export type ComplaintType = "complaint" | "inquiry" | "product_issue" | "shipping_issue" | "refund_request" | "replacement_request" | "warranty";
export type ComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

export type ComplaintRow = {
  id: string;
  customer_id: string;
  order_id: string | null;
  type: ComplaintType;
  status: ComplaintStatus;
  subject: string;
  description: string | null;
  resolution_notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LoyaltyTierRow = {
  id: string;
  name: string;
  min_orders: number;
  min_spend: number;
  benefits: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ExternalProductMappingRow = {
  id: string;
  source: string;
  external_product_text: string;
  product_id: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      roles: Table<RoleRow, Omit<RoleRow, "id" | "created_at" | "updated_at">>;
      permissions: Table<PermissionRow, Omit<PermissionRow, "id" | "created_at">>;
      role_permissions: Table<
        { role_id: string; permission_id: string; created_at: string },
        { role_id: string; permission_id: string }
      >;
      profiles: Table<ProfileRow, Omit<ProfileRow, "created_at" | "updated_at">>;
      customers: Table<CustomerRow, Partial<Omit<CustomerRow, "id" | "created_at" | "updated_at">> & { full_name: string }>;
      customer_phones: Table<CustomerPhoneRow, Omit<CustomerPhoneRow, "id" | "created_at">>;
      customer_addresses: Table<CustomerAddressRow, Omit<CustomerAddressRow, "id" | "created_at">>;
      orders: Table<
        OrderRow,
        Omit<OrderRow, "id" | "created_at" | "updated_at" | "ad_cost" | "shipping_cost" | "assigned_to"> &
          Partial<Pick<OrderRow, "ad_cost" | "shipping_cost" | "assigned_to">>,
        Partial<Omit<OrderRow, "id" | "created_at" | "updated_at">>,
        [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ]
      >;
      products: Table<ProductRow, Partial<Omit<ProductRow, "id" | "created_at" | "updated_at">> & { name: string }>;
      order_items: Table<
        OrderItemRow,
        Omit<OrderItemRow, "id" | "created_at">,
        Partial<Omit<OrderItemRow, "id" | "created_at" | "order_id">>,
        [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ]
      >;
      external_product_mappings: Table<ExternalProductMappingRow, Omit<ExternalProductMappingRow, "id" | "created_at">>;
      communications: Table<
        CommunicationRow,
        Partial<Omit<CommunicationRow, "id" | "created_at">> & { customer_id: string; channel: MessageChannel; body: string; status: CommunicationStatus; provider: string }
      >;
      campaigns: Table<CampaignRow, Partial<Omit<CampaignRow, "id" | "created_at" | "updated_at">> & { name: string; trigger_type: CampaignTriggerType }>;
      campaign_steps: Table<
        CampaignStepRow,
        Omit<CampaignStepRow, "id" | "created_at">,
        Partial<Omit<CampaignStepRow, "id" | "created_at" | "campaign_id">>,
        [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ]
      >;
      campaign_enrollments: Table<
        CampaignEnrollmentRow,
        Omit<CampaignEnrollmentRow, "id" | "enrolled_at"> & { enrolled_at?: string },
        Partial<Omit<CampaignEnrollmentRow, "id" | "campaign_id" | "customer_id">>,
        [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_enrollments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ]
      >;
      offers: Table<
        OfferRow,
        Partial<Omit<OfferRow, "id" | "created_at" | "updated_at">> & { name: string; starts_at: string; ends_at: string },
        Partial<Omit<OfferRow, "id" | "created_at" | "updated_at">>,
        [
          {
            foreignKeyName: "offers_loyalty_tier_id_fkey";
            columns: ["loyalty_tier_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offers_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "segments";
            referencedColumns: ["id"];
          },
        ]
      >;
      coupons: Table<
        CouponRow,
        Partial<Omit<CouponRow, "id" | "created_at" | "updated_at">> & { code: string; discount_type: CouponDiscountType; discount_value: number },
        Partial<Omit<CouponRow, "id" | "created_at" | "updated_at">>,
        [
          {
            foreignKeyName: "coupons_loyalty_tier_id_fkey";
            columns: ["loyalty_tier_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupons_segment_id_fkey";
            columns: ["segment_id"];
            isOneToOne: false;
            referencedRelation: "segments";
            referencedColumns: ["id"];
          },
        ]
      >;
      coupon_redemptions: Table<
        CouponRedemptionRow,
        Omit<CouponRedemptionRow, "id" | "redeemed_at" | "related_order_id"> & { redeemed_at?: string; related_order_id?: string | null },
        Partial<Omit<CouponRedemptionRow, "id" | "coupon_id" | "customer_id">>,
        [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ]
      >;
      customer_acquisition: Table<
        CustomerAcquisitionRow,
        Partial<Omit<CustomerAcquisitionRow, "customer_id" | "created_at" | "updated_at">> & { customer_id: string }
      >;
      order_call_attempts: Table<
        OrderCallAttemptRow,
        Partial<Omit<OrderCallAttemptRow, "id" | "attempted_at">> & { order_id: string; agent_id: string; result: CallAttemptResult },
        Partial<Omit<OrderCallAttemptRow, "id" | "attempted_at">>,
        [
          {
            foreignKeyName: "order_call_attempts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      tags: Table<TagRow, Omit<TagRow, "id" | "created_at">>;
      customer_tags: Table<
        CustomerTagRow,
        Omit<CustomerTagRow, "id" | "created_at" | "removed_at">,
        Partial<Omit<CustomerTagRow, "id" | "created_at">>,
        [
          {
            foreignKeyName: "customer_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ]
      >;
      customer_events: Table<
        CustomerEventRow,
        Omit<CustomerEventRow, "id" | "created_at">,
        Partial<Omit<CustomerEventRow, "id" | "created_at">>,
        [
          {
            foreignKeyName: "customer_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_events_related_employee_id_fkey";
            columns: ["related_employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      customer_notes: Table<
        CustomerNoteRow,
        Omit<CustomerNoteRow, "id" | "created_at" | "updated_at" | "deleted_at">,
        Partial<Omit<CustomerNoteRow, "id" | "created_at" | "updated_at">>,
        [
          {
            foreignKeyName: "customer_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      follow_ups: Table<FollowUpRow, Omit<FollowUpRow, "id" | "created_at" | "updated_at">>;
      score_history: Table<ScoreHistoryRow, Omit<ScoreHistoryRow, "id" | "created_at">>;
      scoring_rules: Table<ScoringRuleRow, Omit<ScoringRuleRow, "id" | "created_at" | "updated_at">>;
      score_category_thresholds: Table<
        ScoreCategoryThresholdRow,
        Omit<ScoreCategoryThresholdRow, "id" | "created_at" | "updated_at">,
        Partial<Omit<ScoreCategoryThresholdRow, "id" | "created_at" | "updated_at">>
      >;
      customer_risk_profiles: Table<
        CustomerRiskProfileRow,
        Omit<CustomerRiskProfileRow, "computed_at"> & { computed_at?: string },
        Partial<Omit<CustomerRiskProfileRow, "customer_id">>
      >;
      risk_config: Table<RiskConfigRow, Omit<RiskConfigRow, "id" | "created_at" | "updated_at">>;
      segments: Table<
        SegmentRow,
        Partial<Omit<SegmentRow, "id" | "created_at" | "updated_at">> & { name: string }
      >;
      segment_rules: Table<SegmentRuleRow, Omit<SegmentRuleRow, "id" | "created_at">>;
      integrations: Table<
        IntegrationRow,
        Partial<Omit<IntegrationRow, "id" | "created_at" | "updated_at">> & { name: string }
      >;
      sync_runs: Table<
        SyncRunRow,
        Partial<Omit<SyncRunRow, "id" | "started_at">>,
        Partial<Omit<SyncRunRow, "id" | "started_at">>,
        [
          {
            foreignKeyName: "sync_runs_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "integrations";
            referencedColumns: ["id"];
          },
        ]
      >;
      sync_run_items: Table<
        SyncRunItemRow,
        Omit<SyncRunItemRow, "id" | "created_at">,
        Partial<Omit<SyncRunItemRow, "id" | "created_at">>,
        [
          {
            foreignKeyName: "sync_run_items_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
        ]
      >;
      webhook_events: Table<WebhookEventRow, Partial<Omit<WebhookEventRow, "id" | "created_at">> & { source: string; event_type: string; payload: Json; idempotency_key: string }>;
      customer_external_ids: Table<CustomerExternalIdRow, Omit<CustomerExternalIdRow, "id" | "created_at">>;
      external_status_mappings: Table<ExternalStatusMappingRow, Omit<ExternalStatusMappingRow, "id" | "created_at">>;
      duplicate_candidates: Table<DuplicateCandidateRow, Omit<DuplicateCandidateRow, "id" | "created_at">>;
      customer_merges: Table<CustomerMergeRow, Omit<CustomerMergeRow, "id" | "created_at">>;
      audit_logs: Table<AuditLogRow, Omit<AuditLogRow, "id" | "created_at">>;
      ai_insights: Table<AiInsightRow, Partial<Omit<AiInsightRow, "id" | "generated_at">> & { category: string; title: string; description: string; fact_summary: string }>;
      ai_customer_summaries: Table<
        AiCustomerSummaryRow,
        Partial<Omit<AiCustomerSummaryRow, "customer_id" | "updated_at">> & { customer_id: string }
      >;
      ai_suggestions: Table<
        AiSuggestionRow,
        Partial<Omit<AiSuggestionRow, "id" | "created_at">> & { type: AiSuggestionType; proposed_action: Json; reason: string }
      >;
      ai_usage_logs: Table<AiUsageLogRow, Omit<AiUsageLogRow, "id" | "created_at">>;
      ai_model_pricing: Table<AiModelPricingRow, Omit<AiModelPricingRow, "id" | "created_at">>;
      ai_feedback: Table<AiFeedbackRow, Omit<AiFeedbackRow, "id" | "created_at">>;
      ai_conversations: Table<AiConversationRow, Omit<AiConversationRow, "id" | "created_at" | "updated_at">>;
      ai_messages: Table<AiMessageRow, Omit<AiMessageRow, "id" | "created_at">>;
      automation_rules: Table<AutomationRuleRow, Omit<AutomationRuleRow, "id" | "created_at" | "updated_at">>;
      automation_executions: Table<
        AutomationExecutionRow,
        Partial<Omit<AutomationExecutionRow, "id" | "started_at">> & { automation_rule_id: string },
        Partial<Omit<AutomationExecutionRow, "id" | "started_at">>
      >;
      notifications: Table<NotificationRow, Omit<NotificationRow, "id" | "created_at" | "is_read"> & { is_read?: boolean }>;
      call_attempt_analysis: Table<
        CallAttemptAnalysisRow,
        Partial<Omit<CallAttemptAnalysisRow, "call_attempt_id">> & { call_attempt_id: string; provider: string; model: string },
        Partial<Omit<CallAttemptAnalysisRow, "call_attempt_id" | "generated_at">>,
        [
          {
            foreignKeyName: "call_attempt_analysis_call_attempt_id_fkey";
            columns: ["call_attempt_id"];
            isOneToOne: true;
            referencedRelation: "order_call_attempts";
            referencedColumns: ["id"];
          },
        ]
      >;
      agent_goals: Table<
        AgentGoalRow,
        Partial<Omit<AgentGoalRow, "id" | "created_at" | "updated_at">> & { agent_id: string; period_month: string },
        Partial<Omit<AgentGoalRow, "id" | "created_at" | "updated_at">>
      >;
      performance_config: Table<PerformanceConfigRow, Partial<Omit<PerformanceConfigRow, "id" | "updated_at">>>;
      complaints: Table<
        ComplaintRow,
        Partial<Omit<ComplaintRow, "id" | "created_at" | "updated_at">> & { customer_id: string; type: ComplaintType; subject: string },
        Partial<Omit<ComplaintRow, "id" | "created_at" | "updated_at">>,
        [
          {
            foreignKeyName: "complaints_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ]
      >;
      loyalty_tiers: Table<
        LoyaltyTierRow,
        Partial<Omit<LoyaltyTierRow, "id" | "created_at" | "updated_at">> & { name: string; sort_order: number },
        Partial<Omit<LoyaltyTierRow, "id" | "created_at" | "updated_at">>
      >;
      experiments: Table<
        ExperimentRow,
        Partial<Omit<ExperimentRow, "id" | "created_at" | "updated_at">> & { name: string; category: string; variant_a_name: string; variant_b_name: string }
      >;
    };
    Views: {
      customer_list_view: View<CustomerListViewRow>;
      segment_customer_view: View<SegmentCustomerViewRow>;
    };
    Functions: {
      find_similar_customer_names: {
        Args: { similarity_threshold?: number };
        Returns: { customer_id_a: string; customer_id_b: string; name_similarity: number }[];
      };
      merge_customers: {
        Args: { p_primary_id: string; p_secondary_id: string; p_actor_id: string };
        Returns: Json;
      };
    };
  };
};
