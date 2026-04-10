import type { ComponentType } from 'react';
import type { InvoiceTemplateProps } from './types';

// Templates will be registered here as they are created
const templateRegistry: Record<string, ComponentType<InvoiceTemplateProps>> = {};

export function registerTemplate(id: string, component: ComponentType<InvoiceTemplateProps>) {
  templateRegistry[id] = component;
}

export function getTemplate(templateId: string): ComponentType<InvoiceTemplateProps> {
  return templateRegistry[templateId] || templateRegistry.classic;
}

export function getAvailableTemplates(): Array<{ id: string; name: string }> {
  return Object.keys(templateRegistry).map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
}

export type { InvoiceTemplateProps };

import { ClassicTemplate } from './classic';
registerTemplate('classic', ClassicTemplate);

import { ModernTemplate } from './modern';
registerTemplate('modern', ModernTemplate);
