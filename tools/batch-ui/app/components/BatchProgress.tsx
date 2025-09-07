'use client';

import { useEffect, useState } from 'react';

interface JobState {
  batchId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  items: Array<{
    sceneId: string;
    status: string;
    imageUrls?: string[];
    error?: string;
  }>;
}

export function BatchProgress({ batchId }: { batchId: string }) {
  const [state, setState] = useState<JobState | null>(null);
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    if (!batchId) return;
    
    const eventSource = new EventSource(`/api/progress/${batchId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        setError(data.error);
      } else {
        setState(data);
      }
    };
    
    eventSource.onerror = () => {
      setError('Connection lost');
      eventSource.close();
    };
    
    return () => eventSource.close();
  }, [batchId]);
  
  if (error) return <div className="text-red-500">{error}</div>;
  if (!state) return <div>Connecting...</div>;
  
  return (
    <div className="space-y-2">
      <div>Status: {state.status}</div>
      <div>Progress: {(state.progress * 100).toFixed(0)}%</div>
      <div className="text-sm">
        {state.items.map(item => (
          <div key={item.sceneId}>
            {item.sceneId}: {item.status}
          </div>
        ))}
      </div>
    </div>
  );
}