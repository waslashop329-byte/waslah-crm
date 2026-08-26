export interface MessageTemplateVars {
  customerName: string;
}

// Pure — no DB access — so it's unit-testable the same way applyStatusMapping
// and calculateOrderProfit are. Deliberately tiny: one placeholder for now
// ({{customer_name}}), not a general templating engine — extend the vars
// interface and the replacements map together if a future action needs more.
export function renderMessageTemplate(template: string, vars: MessageTemplateVars): string {
  return template.replace(/\{\{\s*customer_name\s*\}\}/g, vars.customerName);
}
