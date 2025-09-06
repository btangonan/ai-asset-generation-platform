#!/usr/bin/env tsx
import { setTimeout } from 'timers/promises';

const API_URL = 'http://localhost:9090';
const TOTAL_REQUESTS = 5;  // Reduced for quick test
const INTERVAL_MS = 2000;  // 2 seconds between requests

interface TestResult {
  requestNum: number;
  timestamp: string;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  jobId?: string;
}

const results: TestResult[] = [];

async function makeRequest(requestNum: number): Promise<TestResult> {
  const startTime = Date.now();
  const payload = {
    items: [
      {
        scene_id: `scene-${requestNum}`,
        prompt: `Quick test ${requestNum}: Generate a serene landscape`,
        variants: 2
      }
    ],
    runMode: 'live'
  };

  try {
    const response = await fetch(`${API_URL}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    return {
      requestNum,
      timestamp: new Date().toISOString(),
      success: response.ok,
      responseTime,
      statusCode: response.status,
      jobId: data.job_id
    };
  } catch (error) {
    return {
      requestNum,
      timestamp: new Date().toISOString(),
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkHealth(): Promise<void> {
  try {
    const metricsRes = await fetch(`${API_URL}/metrics`);
    const metrics = await metricsRes.json();
    
    console.log(`  Memory: ${metrics.memory.heapUsedMB}/${metrics.memory.heapTotalMB}MB`);
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

async function runQuickSoakTest() {
  console.log('🚀 Starting Quick Soak Test');
  console.log(`  Requests: ${TOTAL_REQUESTS}`);
  console.log(`  Interval: ${INTERVAL_MS/1000} seconds\n`);
  
  const startTime = Date.now();
  
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    const result = await makeRequest(i);
    results.push(result);
    
    console.log(`[${new Date().toLocaleTimeString()}] Request ${i}/${TOTAL_REQUESTS} - ${result.success ? '✅' : '❌'} ${result.responseTime}ms`);
    
    if (result.error) {
      console.error(`  Error: ${result.error}`);
    }
    
    await checkHealth();
    
    if (i < TOTAL_REQUESTS) {
      await setTimeout(INTERVAL_MS);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
  
  console.log('\n📈 QUICK TEST RESULTS');
  console.log(`Success Rate: ${successCount}/${TOTAL_REQUESTS} (${Math.round(successCount/TOTAL_REQUESTS*100)}%)`);
  console.log(`Avg Response: ${avgResponseTime}ms`);
}

runQuickSoakTest().catch(console.error);