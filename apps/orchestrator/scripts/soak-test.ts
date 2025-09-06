#!/usr/bin/env tsx
import { setTimeout } from 'timers/promises';

const API_URL = 'http://localhost:9090';
const TOTAL_REQUESTS = 30;
const DURATION_MINUTES = 10;
const INTERVAL_MS = (DURATION_MINUTES * 60 * 1000) / TOTAL_REQUESTS;

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
    user_id: 'soak-test-user',
    scene_id: `scene-${requestNum}`,
    prompt: `Soak test request ${requestNum}: Generate a serene landscape with mountains`,
    rows: [
      {
        row_id: `row-${requestNum}-1`,
        variant_count: 2
      }
    ]
  };

  try {
    const response = await fetch(`${API_URL}/batch/images`, {
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
    const [healthRes, readyRes, metricsRes] = await Promise.all([
      fetch(`${API_URL}/healthz`),
      fetch(`${API_URL}/readiness`),
      fetch(`${API_URL}/metrics`)
    ]);
    
    const [health, ready, metrics] = await Promise.all([
      healthRes.json(),
      readyRes.json(),
      metricsRes.json()
    ]);
    
    console.log('\n📊 System Health Check:');
    console.log('  Health:', health.status);
    console.log('  Ready:', ready.status);
    console.log('  Memory:', `${metrics.memory.heapUsedMB}/${metrics.memory.heapTotalMB}MB (${Math.round(metrics.memory.heapUsedMB/metrics.memory.heapTotalMB*100)}%)`);
    console.log('  Uptime:', `${Math.round(metrics.process.uptime/60)} minutes`);
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

async function runSoakTest() {
  console.log('🚀 Starting Functional Soak Test');
  console.log(`  Duration: ${DURATION_MINUTES} minutes`);
  console.log(`  Total requests: ${TOTAL_REQUESTS}`);
  console.log(`  Interval: ${Math.round(INTERVAL_MS/1000)} seconds\n`);
  
  const startTime = Date.now();
  
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    const result = await makeRequest(i);
    results.push(result);
    
    const progress = Math.round((i / TOTAL_REQUESTS) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[${new Date().toLocaleTimeString()}] Request ${i}/${TOTAL_REQUESTS} (${progress}%) - ${result.success ? '✅' : '❌'} ${result.responseTime}ms`);
    
    if (result.error) {
      console.error(`  Error: ${result.error}`);
    }
    
    // Health check every 10 requests
    if (i % 10 === 0) {
      await checkHealth();
    }
    
    // Wait before next request (except for the last one)
    if (i < TOTAL_REQUESTS) {
      await setTimeout(INTERVAL_MS);
    }
  }
  
  // Final summary
  const successCount = results.filter(r => r.success).length;
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length);
  const maxResponseTime = Math.max(...results.map(r => r.responseTime));
  const minResponseTime = Math.min(...results.map(r => r.responseTime));
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 SOAK TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Successful: ${successCount} (${Math.round(successCount/TOTAL_REQUESTS*100)}%)`);
  console.log(`Failed: ${TOTAL_REQUESTS - successCount}`);
  console.log(`Avg Response Time: ${avgResponseTime}ms`);
  console.log(`Min Response Time: ${minResponseTime}ms`);
  console.log(`Max Response Time: ${maxResponseTime}ms`);
  console.log(`Total Duration: ${Math.round((Date.now() - startTime) / 1000)} seconds`);
  
  // Final health check
  await checkHealth();
  
  // Save results to file
  const fs = await import('fs/promises');
  const resultsFile = `soak-test-results-${Date.now()}.json`;
  await fs.writeFile(resultsFile, JSON.stringify({ summary: { successCount, avgResponseTime, maxResponseTime, minResponseTime }, results }, null, 2));
  console.log(`\nResults saved to ${resultsFile}`);
}

// Run the test
runSoakTest().catch(console.error);