export const COACH_TABS = ['panel', 'mapa', 'objetivos', 'revisiones', 'decisiones'] as const;
export type CoachTab = (typeof COACH_TABS)[number];
