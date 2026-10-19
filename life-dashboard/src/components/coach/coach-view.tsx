'use client';
import { useState } from 'react';
import { Segmented } from '@/components/ui/primitives';
import type { CoachData } from '@/server/coach/queries';
import { DecisionsTab } from './decisions-tab';
import { GoalsTab } from './goals-tab';
import { InterviewTab } from './interview-tab';
import { PanelTab } from './panel-tab';
import { ReviewsTab } from './reviews-tab';
import { COACH_TABS, type CoachTab } from './types';

const LABELS: Record<CoachTab, string> = { panel: 'Panel', mapa: 'Mapa de vida', objetivos: 'Objetivos', revisiones: 'Revisiones', decisiones: 'Decisiones' };

export function CoachView({ d, initialTab }: { d: CoachData; initialTab: CoachTab }) {
  const [tab, setTab] = useState<CoachTab>(initialTab);
  const go = (t: CoachTab) => { setTab(t); try { window.history.replaceState(null, '', `/coach?tab=${t}`); } catch { /* sin historial */ } };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Coach</h1>
          <p className="text-sm text-muted-foreground">Tu sistema de objetivos, hábitos y revisiones. Pocas cosas, bien elegidas.</p>
        </div>
      </div>
      <div className="overflow-x-auto"><Segmented label="Sección del coach" value={tab} onChange={go} options={COACH_TABS.map((t) => ({ value: t, label: LABELS[t] }))} /></div>
      {tab === 'panel' && <PanelTab d={d} go={go} />}
      {tab === 'mapa' && <InterviewTab d={d} go={go} />}
      {tab === 'objetivos' && <GoalsTab d={d} />}
      {tab === 'revisiones' && <ReviewsTab d={d} />}
      {tab === 'decisiones' && <DecisionsTab d={d} />}
    </div>
  );
}
