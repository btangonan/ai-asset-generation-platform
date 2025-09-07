import fetch from 'node-fetch';
const api = process.env.API_BASE!;
const key = process.env.AI_PLATFORM_API_KEY_1 || 'aip_XBvepbgodm3UjQkWzyW5OQWwxnZZD3z0mXjodee5eTc';

async function main() {
  const items = Array.from({ length: 10 }, (_, i) => ({
    scene_id: `LIVE-${i + 1}`,
    prompt: `Studio product still ${i + 1}`,
    variants: 1
  }));
  console.log('🚀 Running live test with 10 items...');
  const res = await fetch(`${api}/batch/images`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ runMode: 'live', items })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  console.log('✅ Live test completed');
  console.log(`📊 Results: ${result.accepted} accepted, ${result.rejected?.length || 0} rejected`);
  console.log(`💰 Actual cost: $${result.actualCost}`);
  return result;
}
main().catch((e) => { console.error('❌ Test failed:', e); process.exit(1); });