import { z } from "zod";

export const createNoteSchema = z.object({
  customerId: z.string().uuid(),
  content: z.string().trim().min(1, "Note cannot be empty").max(4000, "Note is too long"),
});

export const tagActionSchema = z.object({
  customerId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export const createFollowUpSchema = z.object({
  customerId: z.string().uuid(),
  type: z.enum(["call", "whatsapp", "general"]),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  dueDate: z.string().min(1, "Due date is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
});

export const followUpIdSchema = z.object({
  followUpId: z.string().uuid(),
});

export const rescheduleFollowUpSchema = z.object({
  followUpId: z.string().uuid(),
  dueDate: z.string().min(1, "Due date is required"),
});

export const reassignFollowUpSchema = z.object({
  followUpId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  customerId: z.string().uuid(),
  channel: z.enum(["whatsapp", "sms"]),
  body: z.string().trim().min(1, "Message cannot be empty").max(1000, "Message is too long"),
});
