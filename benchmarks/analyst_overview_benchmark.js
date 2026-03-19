
import { performance } from 'perf_hooks';

// Simulation parameters
const NUM_OPPORTUNITIES = 1000;
const APPS_PER_OPP = 20; // 20,000 total applications

// Mock data generation
const opportunities = Array.from({ length: NUM_OPPORTUNITIES }, (_, i) => ({
  id: `opp_${i}`,
  created_by: 'user_1',
  status: i % 3 === 0 ? 'ativo' : (i % 3 === 1 ? 'concluido' : 'draft'),
  created_at: new Date(Date.now() - i * 100000).toISOString()
}));

const applications = opportunities.flatMap(opp =>
  Array.from({ length: APPS_PER_OPP }, (_, i) => ({
    id: `app_${opp.id}_${i}`,
    opportunity_id: opp.id
  }))
);

// Mock Supabase client latency simulation
const NETWORK_LATENCY = 50; // ms
const DB_READ_TIME_PER_1000_ROWS = 10; // ms

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Current Implementation Simulation
async function currentImplementation() {
  const start = performance.now();

  // 1. Fetch ALL opportunities
  await sleep(NETWORK_LATENCY + (NUM_OPPORTUNITIES / 1000) * DB_READ_TIME_PER_1000_ROWS);
  const fetchedOpps = [...opportunities]; // Simulate data transfer

  // 2. Client-side filtering for stats
  const activeOpportunities = fetchedOpps.filter(op => op.status === 'ativo').length;
  const completedOpportunities = fetchedOpps.filter(op => op.status === 'concluido').length;
  const totalOpportunities = fetchedOpps.length;

  // 3. Fetch ALL applications for ALL opportunities
  await sleep(NETWORK_LATENCY + (applications.length / 1000) * DB_READ_TIME_PER_1000_ROWS);
  const fetchedApps = applications.filter(app => fetchedOpps.some(op => op.id === app.opportunity_id)); // Simulate .in() query

  const totalApplications = fetchedApps.length;

  // 4. Client-side aggregation
  const applicationCounts = fetchedApps.reduce((acc, app) => {
    acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
    return acc;
  }, {});

  const opportunitiesWithCandidatesCount = fetchedOpps.map((opp) => ({
    ...opp,
    candidates_count: applicationCounts[opp.id] || 0
  }));

  // 5. Slice for recent
  const recentOpportunities = opportunitiesWithCandidatesCount.slice(0, 5);

  const end = performance.now();
  return {
    time: end - start,
    dataTransfer: fetchedOpps.length + fetchedApps.length,
    recentOpportunities
  };
}

// Optimized Implementation Simulation
async function optimizedImplementation() {
  const start = performance.now();

  // 1. Fetch Stats (Count queries) - parallel
  const statsPromise = Promise.all([
    sleep(NETWORK_LATENCY).then(() => opportunities.filter(op => op.status === 'ativo').length),
    sleep(NETWORK_LATENCY).then(() => opportunities.filter(op => op.status === 'concluido').length),
    sleep(NETWORK_LATENCY).then(() => opportunities.length),
    sleep(NETWORK_LATENCY).then(() => applications.length) // Mocking the join count query
  ]);

  // 2. Fetch Recent Opportunities (Limit 5)
  const recentOppsPromise = sleep(NETWORK_LATENCY).then(() => opportunities.slice(0, 5));

  const [active, completed, totalOpp, totalApp] = await statsPromise;
  const recentOpps = await recentOppsPromise;

  // 3. Fetch applications ONLY for recent opportunities (Limit 5 * APPS_PER_OPP)
  const recentIds = recentOpps.map(op => op.id);
  await sleep(NETWORK_LATENCY); // Query for specific apps
  const recentApps = applications.filter(app => recentIds.includes(app.opportunity_id));

  // 4. Client-side aggregation for recent only
  const applicationCounts = recentApps.reduce((acc, app) => {
    acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
    return acc;
  }, {});

  const finalRecentOpps = recentOpps.map((opp) => ({
    ...opp,
    candidates_count: applicationCounts[opp.id] || 0
  }));

  const end = performance.now();
  return {
    time: end - start,
    dataTransfer: 5 + recentApps.length, // Only 5 opps + their apps
    recentOpportunities: finalRecentOpps
  };
}

async function runBenchmark() {
  console.log(`Benchmarking Analyst Overview with ${NUM_OPPORTUNITIES} opportunities and ${APPS_PER_OPP} apps/opp`);
  console.log('--------------------------------------------------');

  const currentResult = await currentImplementation();
  console.log(`Current Implementation:`);
  console.log(`  Time: ${currentResult.time.toFixed(2)} ms`);
  console.log(`  Rows Processed/Transferred: ${currentResult.dataTransfer}`);

  const optimizedResult = await optimizedImplementation();
  console.log(`Optimized Implementation:`);
  console.log(`  Time: ${optimizedResult.time.toFixed(2)} ms`);
  console.log(`  Rows Processed/Transferred: ${optimizedResult.dataTransfer}`);

  const improvement = currentResult.time / optimizedResult.time;
  console.log(`\nSpeedup: ${improvement.toFixed(2)}x`);
  console.log(`Data Transfer Reduction: ${((currentResult.dataTransfer - optimizedResult.dataTransfer) / currentResult.dataTransfer * 100).toFixed(2)}%`);
}

runBenchmark();
