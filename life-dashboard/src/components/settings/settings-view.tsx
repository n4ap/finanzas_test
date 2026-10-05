'use client';
import { useState } from 'react';
import { Segmented } from '@/components/ui/primitives';
import type { SettingsData } from '@/server/settings/queries';
import { AiTab } from './ai-tab';
import { ConnectionsTab } from './connections-tab';
import { DataTab } from './data-tab';
import { ProfileTab } from './profile-tab';
import { SecurityTab } from './security-tab';

type Tab = 'profile' | 'connections' | 'ai' | 'security' | 'data';

export function SettingsView({ d, initialTab }: { d: SettingsData; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <div className="overflow-x-auto pb-1">
        <Segmented label="Sección de ajustes" value={tab} onChange={setTab} options={[{ value: 'profile', label: 'Perfil' }, { value: 'connections', label: 'Conexiones' }, { value: 'ai', label: 'IA' }, { value: 'security', label: 'Seguridad' }, { value: 'data', label: 'Datos y privacidad' }]} />
      </div>
      {tab === 'profile' && <ProfileTab profile={d.profile} />}
      {tab === 'connections' && <ConnectionsTab connections={d.connections} />}
      {tab === 'ai' && <AiTab ai={d.ai} />}
      {tab === 'security' && <SecurityTab sessions={d.sessions} />}
      {tab === 'data' && <DataTab email={d.profile.email} backups={d.backups} />}
    </div>
  );
}
