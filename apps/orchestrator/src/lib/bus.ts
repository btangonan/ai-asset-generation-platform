import { EventEmitter } from 'events';

type Event =
  | { type: 'started'; batchId: string }
  | { type: 'item_complete'; batchId: string; sceneId: string }
  | { type: 'error'; batchId: string; detail: string }
  | { type: 'done'; batchId: string; processed: number };

const bus = new EventEmitter();
// Prevent leak warnings at modest fanout
bus.setMaxListeners(100);

export function publish(ev: Event) {
  bus.emit(`batch:${ev.batchId}`, ev);
}

export function subscribe(batchId: string, cb: (ev: Event) => void) {
  const key = `batch:${batchId}`;
  bus.on(key, cb);
  return () => bus.off(key, cb);
}