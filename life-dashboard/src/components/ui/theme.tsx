'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './primitives';

export const themeInitScript = `(function(){try{var t=localStorage.getItem('ld_theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('ld_theme', next ? 'dark' : 'light'); } catch { /* modo privado */ }
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
