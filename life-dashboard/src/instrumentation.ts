/** Next.js llama a register() una vez al arrancar el servidor. */
export async function register() {
  // La condición va en línea para que el compilador elimine este import en el runtime «edge».
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SCHEDULER !== 'off') {
    const { startScheduler } = await import('./server/jobs/scheduler');
    startScheduler();
  }
}
