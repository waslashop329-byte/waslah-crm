import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SegmentRow } from "@/lib/types/database";
import type { SegmentConditions } from "@/lib/intelligence/segments/segment-schema";

export interface SegmentWithConditions extends SegmentRow {
  conditions: SegmentConditions | null;
}

export async function listSegments(): Promise<SegmentWithConditions[]> {
  const supabase = await createClient();

  const { data: segments, error } = await supabase.from("segments").select("*").order("is_system", { ascending: false }).order("name");
  if (error) throw new Error(error.message);

  const { data: rules } = await supabase.from("segment_rules").select("segment_id, conditions");
  const conditionsBySegment = new Map((rules ?? []).map((rule) => [rule.segment_id, rule.conditions as unknown as SegmentConditions]));

  return (segments ?? []).map((segment) => ({ ...segment, conditions: conditionsBySegment.get(segment.id) ?? null }));
}

export async function getSegment(segmentId: string): Promise<SegmentWithConditions | null> {
  const supabase = await createClient();

  const { data: segment } = await supabase.from("segments").select("*").eq("id", segmentId).maybeSingle();
  if (!segment) return null;

  const { data: rule } = await supabase.from("segment_rules").select("conditions").eq("segment_id", segmentId).maybeSingle();

  return { ...segment, conditions: (rule?.conditions as unknown as SegmentConditions) ?? null };
}
