import fetch from 'node-fetch';
const api = process.env.API_BASE!;
const key = process.env.AI_PLATFORM_API_KEY_1 || 'aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc';

async function main() {
  const items = Array.from({ length: 100 }, (_, i) => ({
    scene_id: `DRY-${String(i + 1).padStart(3, '0')}`,
    prompt: `Batch dry-run test ${i + 1}`,
    variants: ((i % 3) + 1) as 1 | 2 | 3
  }));
  
  console.log('🚀 Running 100-row dry run test...');
  console.log(`📊 Distribution: ${items.filter(i => i.variants === 1).length} x1, ${items.filter(i => i.variants === 2).length} x2, ${items.filter(i => i.variants === 3).length} x3`);
  
  const startTime = Date.now();
  const res = await fetch(`${api}/batch/images`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ runMode: 'dry_run', items })
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HTTP ${res.status}: ${error}`);
  }
  
  const result = await res.json();
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log('✅ Dry run completed');
  console.log(`⏱️  Time: ${elapsed.toFixed(1)}s`);
  console.log(`📊 Results: ${result.accepted} accepted, ${result.rejected?.length || 0} rejected`);
  console.log(`💰 Estimated cost: $${result.estimatedCost}`);
  
  // Validate performance gates
  if (elapsed > 600) {
    console.error('❌ FAILED: Test took longer than 10 minutes');
    process.exit(1);
  }
  
  const errorRate = (result.rejected?.length || 0) / items.length;
  if (errorRate > 0.05) {
    console.error(`❌ FAILED: Error rate ${(errorRate * 100).toFixed(1)}% exceeds 5% threshold`);
    process.exit(1);
  }
  
  console.log('✅ All performance gates passed');
  return result;
}

main().catch((e) => { console.error('❌ Test failed:', e); process.exit(1); });