import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import { RedisService } from '@/modules/redis/redis.service';

export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  EMAIL: 'email',
  ANNOUNCEMENTS: 'announcements',
  SETTLEMENTS: 'settlements',
  MAINTENANCE: 'maintenance',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  // Exponential backoff keeps a failing downstream (FCM, SMTP) from being hammered.
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400 },
};

/**
 * Nothing slow happens inside a request. Email, push fan-out, invoices and
 * settlement all become jobs, so the API stays fast and a third-party outage
 * degrades into a retry rather than a failed order.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(private readonly redis: RedisService) {}

  queue(name: QueueName): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;

    const queue = new Queue(name, {
      connection: this.redis.createClient(`queue-${name}`),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    this.queues.set(name, queue);
    return queue;
  }

  async enqueue<T extends object>(
    name: QueueName,
    jobName: string,
    payload: T,
    options?: JobsOptions,
  ): Promise<void> {
    await this.queue(name).add(jobName, payload, options);
  }

  /** Registers a worker. `concurrency` is per process, so it multiplies by replicas. */
  registerWorker<T>(name: QueueName, processor: Processor<T>, concurrency = 5): Worker {
    const worker = new Worker(name, processor, {
      connection: this.redis.createClient(`worker-${name}`),
      concurrency,
    });

    worker.on('failed', (job, error) => {
      this.logger.error(
        { queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: error },
        `Job failed: ${error.message}`,
      );
    });

    this.workers.push(worker);
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    // Let in-flight jobs finish so a deploy does not lose a notification.
    await Promise.allSettled(this.workers.map((worker) => worker.close()));
    await Promise.allSettled([...this.queues.values()].map((queue) => queue.close()));
  }
}
