export const NEWS_CATEGORIES = [
  { id: 'ia', label: 'IA' }, { id: 'tecnologia', label: 'Tecnología' }, { id: 'economia', label: 'Economía' }, { id: 'finanzas', label: 'Finanzas' },
  { id: 'deportes', label: 'Deportes' }, { id: 'espana', label: 'España' }, { id: 'mundo', label: 'Mundo' },
] as const;
export type NewsCategoryId = (typeof NEWS_CATEGORIES)[number]['id'];
export const NEWS_CATEGORY_IDS = NEWS_CATEGORIES.map((c) => c.id) as [NewsCategoryId, ...NewsCategoryId[]];
export const categoryLabel = (id: string) => NEWS_CATEGORIES.find((c) => c.id === id)?.label ?? id;
