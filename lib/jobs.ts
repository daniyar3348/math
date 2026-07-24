// Мини-очередь фоновых задач (D-002): дедупликация по ключу, последовательное
// исполнение, безопасные ошибки. Интерфейс совместим со свапом на BullMQ.

type Job = () => Promise<void>;

const pending = new Map<string, Job>();
let running = false;

export function enqueue(key: string, job: Job): void {
  pending.set(key, job); // последняя версия задачи с этим ключом побеждает
  void drain();
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (pending.size > 0) {
      const [key, job] = pending.entries().next().value as [string, Job];
      pending.delete(key);
      try {
        await job();
      } catch (e) {
        console.error(`[jobs] ${key} failed:`, e);
      }
    }
  } finally {
    running = false;
  }
}
