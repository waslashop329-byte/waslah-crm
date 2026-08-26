import "server-only";
import type { z } from "zod";
import type { AiProvider, AiUsageInfo } from "@/lib/ai/types/ai-types";
import { GROUNDING_INSTRUCTION } from "@/lib/ai/guardrails/guardrails";

export interface StructuredGenerationResult<T> {
  data: T;
  usage: AiUsageInfo;
  raw: string;
}

// Provider-agnostic structured output (Part 2): rather than depending on any
// one provider's native "JSON mode" feature, this asks for JSON in the
// prompt and Zod-validates whatever comes back — works identically no matter
// which AiProvider is behind it, and never trusts unvalidated text as data.
export async function generateStructuredOutput<T>(
  provider: AiProvider,
  params: { systemPrompt: string; userPrompt: string; schema: z.ZodType<T>; schemaDescription: string },
): Promise<StructuredGenerationResult<T>> {
  const systemPrompt = `${GROUNDING_INSTRUCTION}\n\n${params.systemPrompt}\n\nRespond with ONLY a single valid JSON object, no markdown code fences, no commentary, matching this shape:\n${params.schemaDescription}`;

  const attempt = async (extraInstruction?: string): Promise<StructuredGenerationResult<T>> => {
    const result = await provider.generateText({
      systemPrompt: extraInstruction ? `${systemPrompt}\n\n${extraInstruction}` : systemPrompt,
      userPrompt: params.userPrompt,
    });

    const parsed = extractAndValidateJson(result.text, params.schema);
    if (!parsed.success) {
      throw new InvalidStructuredOutputError(parsed.error, result.text);
    }

    return { data: parsed.data, usage: result.usage, raw: result.text };
  };

  try {
    return await attempt();
  } catch (firstError) {
    if (!(firstError instanceof InvalidStructuredOutputError)) throw firstError;
    // One retry with the validation error fed back — reject-or-retry-safely (Part 2), never store the invalid first attempt.
    return attempt(`Your previous response was invalid: ${firstError.validationError}. Return corrected JSON only.`);
  }
}

export class InvalidStructuredOutputError extends Error {
  constructor(
    public readonly validationError: string,
    public readonly rawResponse: string,
  ) {
    super(`AI response did not match the expected schema: ${validationError}`);
    this.name = "InvalidStructuredOutputError";
  }
}

function extractAndValidateJson<T>(text: string, schema: z.ZodType<T>): { success: true; data: T } | { success: false; error: string } {
  const jsonText = stripCodeFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { success: false, error: "Response was not valid JSON" };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }

  return { success: true, data: result.data };
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}
