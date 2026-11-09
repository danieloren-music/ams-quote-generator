export const CATEGORIES = [
  { key: 'mechanics', label: 'מכניקה' },
  { key: 'sheet_metal', label: 'Sheet Metal' },
  { key: 'fasteners', label: 'Fasteners' },
  { key: 'packaging', label: 'אריזות (Package)' },
  { key: 'optic', label: 'Optic' },
  { key: 'electronic', label: 'Electronic' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

export const categoryLabel = (key: string) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;
