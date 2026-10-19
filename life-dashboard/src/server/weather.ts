import 'server-only';

const CITIES: Record<string, [number, number]> = {
  madrid: [40.4168, -3.7038], barcelona: [41.3874, 2.1686], valencia: [39.4699, -0.3763], sevilla: [37.3891, -5.9845],
  bilbao: [43.263, -2.935], malaga: [36.7213, -4.4214], zaragoza: [41.6488, -0.8891],
};

export interface Weather { tempC: number; label: string; emoji: string }

const codeMap = (c: number): [string, string] =>
  c === 0 ? ['Despejado', '☀️'] : c <= 2 ? ['Poco nuboso', '🌤️'] : c === 3 ? ['Nublado', '☁️'] : c <= 48 ? ['Niebla', '🌫️']
  : c <= 67 ? ['Lluvia', '🌧️'] : c <= 77 ? ['Nieve', '❄️'] : c <= 82 ? ['Chubascos', '🌦️'] : ['Tormenta', '⛈️'];

/** Clima vía Open-Meteo (sin clave). Solo se envía la latitud/longitud de la ciudad, nada personal. Falla en silencio. */
export async function getWeather(city: string): Promise<Weather | null> {
  const [lat, lon] = CITIES[city.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')] ?? CITIES.madrid!;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`, {
      next: { revalidate: 900 }, signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { current?: { temperature_2m: number; weather_code: number } };
    if (!j.current) return null;
    const [label, emoji] = codeMap(j.current.weather_code);
    return { tempC: Math.round(j.current.temperature_2m), label, emoji };
  } catch {
    return null;
  }
}
