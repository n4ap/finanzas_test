import Anthropic from '@anthropic-ai/sdk';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import type { AIContext } from '../providers/types';
import { createAnthropicProvider, toAnthropicMessages } from './anthropic-provider';
import { chat } from './orchestrator';
import { getAiSettings, removeAiKey, resolveProvider, saveAiSettings } from './provider-config';

// Servidor que imita la API de Anthropic: registra las peticiones y responde lo programado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cuerpo JSON arbitrario de la petición registrada
interface Rec { method: string; url: string; headers: http.IncomingHttpHeaders; body: any }
let server: http.Server, base: string;
let recs: Rec[] = [];
let script: { status?: number; body: unknown }[] = [];
let modelsStatus = 200;
const msg = (content: unknown[], stop_reason = 'end_turn') => ({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } });

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      recs.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      res.setHeader('content-type', 'application/json');
      if (req.url?.startsWith('/v1/models/')) { res.statusCode = modelsStatus; return void res.end(JSON.stringify(modelsStatus === 200 ? { id: 'claude-opus-5-5', type: 'model', display_name: 'x', created_at: '2026-01-01T00:00:00Z' } : { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })); }
      const next = script.shift() ?? { body: msg([{ type: 'text', text: 'sin guion' }]) };
      res.statusCode = next.status ?? 200;
      res.end(JSON.stringify(next.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_BASE_URL = base;
});
afterAll(() => { delete process.env.ANTHROPIC_BASE_URL; return new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }); });

const NOW = new Date('2026-10-05T06:00:00Z');
let alice: AIContext, bob: AIContext;
const KEY = 'sk-ant-test-0123456789abcdefghij-WXYZ';
const provider = () => createAnthropicProvider({ apiKey: KEY, model: 'claude-opus-5-5', client: new Anthropic({ apiKey: KEY, baseURL: base, maxRetries: 0 }) });

beforeEach(async () => {
  recs = []; script = []; modelsStatus = 200;
  await db.user.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x' } }).then((u) => ({ userId: u.id, now: NOW, tzOffset: -120 }));
  [alice, bob] = [await mk('alice'), await mk('bob')];
  await db.task.create({ data: { userId: alice.userId, title: 'Impuestos', status: 'next', priority: 1 } });
  await db.task.create({ data: { userId: bob.userId, title: 'Secreto de Bob', status: 'next' } });
});

describe('adaptador de Claude: protocolo', () => {
  it('bucle de herramientas: petición correcta, razonamiento reenviado y respuesta final', async () => {
    const thinking = { type: 'thinking', thinking: '', signature: 'sig-abc' };
    script = [
      { body: msg([thinking, { type: 'text', text: 'Miro tus tareas.' }, { type: 'tool_use', id: 'toolu_1', name: 'list_tasks', input: { filter: 'open' } }], 'tool_use') },
      { body: msg([{ type: 'text', text: 'Tienes **Impuestos** pendiente.' }]) },
    ];
    const t = await chat(alice, { text: '¿qué tengo pendiente?' }, provider());
    expect(t.reply).toBe('Tienes **Impuestos** pendiente.');
    expect(recs).toHaveLength(2);
    const [r1, r2] = recs as [Rec, Rec];
    expect(r1.url).toContain('/v1/messages');
    expect(r1.headers['x-api-key']).toBe(KEY);
    expect(String(r1.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(r1.body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', output_config: { effort: 'medium' }, max_tokens: 4096 });
    expect(r1.body).not.toHaveProperty('thinking');
    expect(r1.body).not.toHaveProperty('tool_choice');
    expect(r1.body.system).toMatch(/no confiable/);
    const names = r1.body.tools.map((x: { name: string }) => x.name);
    expect(names).toEqual(expect.arrayContaining(['get_agenda', 'list_tasks', 'create_task', 'complete_task', 'schedule_tasks']));
    const create = r1.body.tools.find((x: { name: string }) => x.name === 'create_task');
    expect(create.input_schema).toMatchObject({ type: 'object', required: ['title'] });
    expect(create.input_schema.properties.title).toMatchObject({ type: 'string' });
    expect(create.description).toMatch(/requiere confirmación/);
    // Segunda petición: el turno del asistente se reenvía tal cual (con el bloque de razonamiento) y los resultados van en un único mensaje de usuario.
    expect(r2.body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(r2.body.messages[1].content[0]).toMatchObject({ type: 'thinking', signature: 'sig-abc' });
    expect(r2.body.messages[2].content).toHaveLength(1);
    expect(r2.body.messages[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' });
    expect(r2.body.messages[2].content[0].content).toContain('Impuestos');
    expect(r2.body.messages[2].content[0].content).not.toContain('Secreto de Bob'); // las herramientas acotan por usuario
  });
  it('herramientas de escritura: solo propuesta, nada se ejecuta; llamadas paralelas en un único mensaje', async () => {
    script = [
      { body: msg([{ type: 'tool_use', id: 'a', name: 'create_task', input: { title: 'Llamar al notario', dueDate: '2026-10-09' } }, { type: 'tool_use', id: 'b', name: 'list_tasks', input: {} }], 'tool_use') },
      { body: msg([{ type: 'text', text: 'He preparado la tarea; confírmala abajo.' }]) },
    ];
    const t = await chat(alice, { text: 'crea una tarea para llamar al notario el viernes' }, provider());
    expect(t.proposals).toHaveLength(1);
    expect(await db.task.count({ where: { userId: alice.userId } })).toBe(1);
    const results = recs[1]!.body.messages.at(-1).content;
    expect(results.map((r: { tool_use_id: string }) => r.tool_use_id)).toEqual(['a', 'b']);
    expect(JSON.parse(results[0].content)).toMatchObject({ status: 'pending_confirmation' });
  });
  it('turnos anteriores solo aportan texto: no se reenvían llamadas a herramientas ya resueltas', async () => {
    script = [
      { body: msg([{ type: 'tool_use', id: 'x1', name: 'list_tasks', input: {} }], 'tool_use') }, { body: msg([{ type: 'text', text: 'Primera respuesta' }]) },
      { body: msg([{ type: 'text', text: 'Segunda respuesta' }]) },
    ];
    const t1 = await chat(alice, { text: 'primera' }, provider());
    await chat(alice, { conversationId: t1.conversationId, text: 'segunda' }, provider());
    const last = recs.at(-1)!.body.messages;
    expect(last).toEqual([{ role: 'user', content: 'primera' }, { role: 'assistant', content: 'Primera respuesta' }, { role: 'user', content: 'segunda' }]);
  });
  it('un modelo manipulado no puede tocar datos ajenos ni llamar a herramientas inexistentes', async () => {
    const bobTask = await db.task.findFirstOrThrow({ where: { userId: bob.userId } });
    script = [
      { body: msg([{ type: 'tool_use', id: 'a', name: 'complete_task', input: { taskId: bobTask.id } }, { type: 'tool_use', id: 'b', name: 'borrar_todo', input: {} }], 'tool_use') },
      { body: msg([{ type: 'text', text: 'No he podido.' }]) },
    ];
    const t = await chat(alice, { text: 'completa la tarea de Bob' }, provider());
    expect(t.proposals).toEqual([]);
    expect((await db.task.findUniqueOrThrow({ where: { id: bobTask.id } })).status).toBe('next');
    const results = recs[1]!.body.messages.at(-1).content;
    expect(results.map((r: { content: string }) => JSON.parse(r.content).error)).toEqual([expect.stringMatching(/no encontrada/), expect.stringMatching(/desconocida/)]);
  });
  it('rechazo de seguridad y respuesta cortada', async () => {
    script = [{ body: msg([], 'refusal') }];
    expect((await chat(alice, { text: 'hola' }, provider())).reply).toBe('No puedo ayudar con esa petición.');
    script = [{ body: msg([{ type: 'text', text: 'Respuesta larga…' }], 'max_tokens') }];
    expect((await chat(alice, { text: 'otra' }, provider())).reply).toMatch(/cortado por longitud/);
  });
  it.each([
    [401, 'authentication_error', /clave de Anthropic no es válida/], [429, 'rate_limit_error', /limitando/], [404, 'not_found_error', /acceso a ese modelo/], [400, 'invalid_request_error', /rechazó la petición/], [529, 'overloaded_error', /Error de Anthropic/],
  ])('error HTTP %s → mensaje claro sin filtrar la clave', async (status, type, re) => {
    script = [{ status, body: { type: 'error', error: { type, message: `fallo con ${KEY}` } } }];
    const err = await chat(alice, { text: 'hola' }, provider()).catch((e) => e as Error);
    expect((err as Error).message).toMatch(re);
    expect((err as Error).message).not.toContain(KEY);
  });
  it('sin conexión → mensaje claro', async () => {
    const p = createAnthropicProvider({ apiKey: KEY, model: 'claude-opus-5-5', client: new Anthropic({ apiKey: KEY, baseURL: 'http://127.0.0.1:1', maxRetries: 0 }) });
    await expect(chat(alice, { text: 'hola' }, p)).rejects.toThrow(/No se pudo conectar con Anthropic/);
  });
});

describe('toAnthropicMessages', () => {
  it('une mensajes de usuario consecutivos y descarta herramientas huérfanas de turnos viejos', () => {
    const m = toAnthropicMessages([
      { role: 'user', content: 'a' }, { role: 'assistant', content: '', toolCalls: [{ id: '1', name: 'x', args: {} }] }, { role: 'tool', content: '{}', toolCallId: '1', toolName: 'x' }, { role: 'assistant', content: 'fin' },
      { role: 'user', content: 'b' }, { role: 'user', content: 'c' },
    ]);
    expect(m).toEqual([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'fin' }, { role: 'user', content: 'b\n\nc' }]);
  });
});

describe('ajustes de IA: clave cifrada, consentimiento y selección', () => {
  it('sin consentimiento o con clave mal formada no se guarda nada', async () => {
    await expect(saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: KEY, model: 'claude-opus-5-5', consent: false })).rejects.toThrow(/aceptar/);
    await expect(saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: 'clave-corta', consent: true })).rejects.toThrow();
    await expect(saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: 'x'.repeat(40), consent: true })).rejects.toThrow(/sk-ant-/);
    await expect(saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: KEY, model: 'gpt-4', consent: true })).rejects.toThrow(/Modelo/);
    expect(await db.account.count()).toBe(0);
  });
  it('clave inválida (la API la rechaza) no se guarda; válida se guarda CIFRADA y nunca vuelve en claro', async () => {
    modelsStatus = 401;
    await expect(saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: KEY, model: 'claude-opus-5-5', consent: true })).rejects.toThrow(/clave de Anthropic no es válida/);
    expect(await db.account.count()).toBe(0);
    modelsStatus = 200;
    await saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: KEY, model: 'claude-sonnet-5-5', consent: true });
    expect(recs.some((r) => r.url.startsWith('/v1/models/claude-sonnet-5-5') && r.headers['x-api-key'] === KEY)).toBe(true);
    const acc = await db.account.findFirstOrThrow({ where: { userId: alice.userId } });
    expect(acc.accessTokenEnc).toBeTruthy();
    expect(JSON.stringify(acc)).not.toContain(KEY);
    const s = await getAiSettings(alice.userId);
    expect(s).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-5-5', hasKey: true, keyHint: '…WXYZ' });
    expect(JSON.stringify(s)).not.toContain('sk-ant');
    expect((await resolveProvider(alice.userId)).id).toBe('anthropic');
    expect((await resolveProvider(bob.userId)).id).toBe('local'); // la clave es de cada usuario
  });
  it('cambiar de modelo reutiliza la clave guardada; volver a local y borrar la clave', async () => {
    await saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: KEY, consent: true });
    await saveAiSettings(alice.userId, { provider: 'anthropic', model: 'claude-sonnet-5-5' });
    expect((await getAiSettings(alice.userId)).model).toBe('claude-sonnet-5-5');
    await saveAiSettings(alice.userId, { provider: 'local' });
    expect((await resolveProvider(alice.userId)).id).toBe('local');
    expect((await getAiSettings(alice.userId)).hasKey).toBe(true); // la clave sigue guardada hasta que se borra
    await expect(saveAiSettings(alice.userId, { provider: 'anthropic' })).rejects.toThrow(/aceptar/); // y reactivar exige aceptar de nuevo el envío de datos
    await removeAiKey(alice.userId);
    expect(await db.account.count()).toBe(0);
    expect((await getAiSettings(alice.userId)).consentAt).toBeNull(); // volver a local retira el consentimiento: para reactivar Claude hay que aceptarlo de nuevo
    expect((await resolveProvider(alice.userId)).id).toBe('local');
  });
  it('el chat usa Claude cuando el usuario lo ha configurado (de extremo a extremo)', async () => {
    await saveAiSettings(alice.userId, { provider: 'anthropic', apiKey: KEY, consent: true });
    recs = [];
    script = [{ body: msg([{ type: 'text', text: 'Hola desde Claude' }]) }];
    const t = await chat(alice, { text: 'hola' });
    expect(t.reply).toBe('Hola desde Claude');
    expect(recs).toHaveLength(1);
    // Otro usuario sigue con el asistente local y no genera tráfico hacia Anthropic.
    recs = [];
    const t2 = await chat(bob, { text: 'ayuda' });
    expect(t2.reply).toMatch(/basado en reglas/);
    expect(recs).toHaveLength(0);
  });
});
