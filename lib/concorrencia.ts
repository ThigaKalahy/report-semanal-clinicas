/**
 * Executa as tarefas com no máximo `limit` em voo ao mesmo tempo, chamando
 * `onComplete` assim que cada uma termina (para a tela ir mostrando resultado
 * parcial em vez de esperar o lote inteiro).
 */
export async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onComplete: (result: T) => void
): Promise<void> {
  if (!tasks.length) return;
  const queue = [...tasks];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()!;
      const result = await task();
      onComplete(result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
}
