// Templates are code, not database rows — a new auction format ships as a
// new module that calls registerTemplate(), not a config row an admin fills
// in. lib/auctionos/templates/index.ts imports every template module for
// its registration side effect; import that file (not this one directly)
// to guarantee the registry is populated before getTemplate() is called.

import type { AuctionTemplate } from "./template";

const templates = new Map<string, AuctionTemplate>();

export function registerTemplate(template: AuctionTemplate): void {
  templates.set(template.id, template);
}

export function getTemplate(templateId: string): AuctionTemplate {
  const template = templates.get(templateId);
  if (!template) {
    throw new Error(`Unknown AuctionOS template: "${templateId}"`);
  }
  return template;
}
