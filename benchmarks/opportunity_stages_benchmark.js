
const OPPORTUNITIES_COUNT = 10;
const LATENCY_MS = 50;

// Mock Supabase Client
const createMockSupabase = () => {
  let callCount = 0;

  const mock = {
    from: (table) => {
      return {
        select: (columns, options) => {
          const state = {
             table,
             filters: []
          };

          const execute = async () => {
             callCount++;
             await new Promise(resolve => setTimeout(resolve, LATENCY_MS));

             // Return dummy data
             if (table === 'opportunities') {
                 return {
                     data: Array.from({ length: OPPORTUNITIES_COUNT }, (_, i) => ({
                         id: `opp-${i}`,
                         title: `Opportunity ${i}`,
                         created_by: 'analyst-1'
                     })),
                     error: null
                 };
             }

             if (table === 'opportunity_applications') {
                 // Check if it's a count query
                 if (options && options.count) {
                     return { count: 5, data: [], error: null };
                 }
                 // Return dummy data
                 return { data: [{ id: 'app-1', opportunity_id: 'opp-1' }], error: null };
             }

             if (table === 'opportunity_stages') {
                 return { data: [], error: null };
             }

             return { data: [], error: null };
          };

          const chain = {
            eq: (col, val) => {
                state.filters.push({ col, op: 'eq', val });
                return chain;
            },
            in: (col, vals) => {
                state.filters.push({ col, op: 'in', val: vals });
                return chain;
            },
            order: () => chain,
            limit: () => chain,
            then: (cb) => execute().then(cb)
          };

          return chain;
        }
      }
    },
    getCallCount: () => callCount,
    resetCallCount: () => { callCount = 0; }
  };
  return mock;
};

const runOldLogic = async (supabase) => {
  // 1. Fetch opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('id')
    .eq('created_by', 'analyst-1');

  if (opportunities) {
    // 2. Loop over opportunities (N+1 problem)
    await Promise.all(
        opportunities.map(async (opp) => {
            // A. Count candidates
            await supabase
                .from('opportunity_applications')
                .select('id', { count: 'exact', head: true })
                .eq('opportunity_id', opp.id);

            // B. Get approved applications
            await supabase
                .from('opportunity_applications')
                .select('*')
                .eq('opportunity_id', opp.id)
                .eq('status', 'approved');

            // C. Get stages
            await supabase
                .from('opportunity_stages')
                .select('*')
                .eq('opportunity_id', opp.id);
        })
    );
  }
};

const runNewLogic = async (supabase) => {
    // 1. Fetch opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('id')
    .eq('created_by', 'analyst-1');

  if (opportunities) {
      const opportunityIds = opportunities.map(o => o.id);

      // 2. Fetch all related data in parallel (Bulk)
      await Promise.all([
          // Get all applications (for counting in memory)
          supabase
            .from('opportunity_applications')
            .select('opportunity_id')
            .in('opportunity_id', opportunityIds),

          // Get approved applications
          supabase
            .from('opportunity_applications')
            .select('*')
            .in('opportunity_id', opportunityIds)
            .eq('status', 'approved'),

          // Get stages
          supabase
            .from('opportunity_stages')
            .select('*')
            .in('opportunity_id', opportunityIds)
      ]);
  }
};

async function main() {
    const supabase = createMockSupabase();

    console.log("--- Opportunity Stages Benchmark ---");
    console.log(`Simulating ${OPPORTUNITIES_COUNT} opportunities with ${LATENCY_MS}ms network latency.`);

    // Baseline
    supabase.resetCallCount();
    const startOld = performance.now();
    await runOldLogic(supabase);
    const endOld = performance.now();
    const callsOld = supabase.getCallCount();
    console.log(`[Baseline (N+1)] Time: ${(endOld - startOld).toFixed(2)}ms, Network Calls: ${callsOld}`);

    // Optimized
    supabase.resetCallCount();
    const startNew = performance.now();
    await runNewLogic(supabase);
    const endNew = performance.now();
    const callsNew = supabase.getCallCount();
    console.log(`[Optimized (Bulk)] Time: ${(endNew - startNew).toFixed(2)}ms, Network Calls: ${callsNew}`);

    const improvement = callsOld > 0 ? Math.round((callsOld-callsNew)/callsOld*100) : 0;
    console.log(`\nImprovement: Call reduction: ${callsOld} -> ${callsNew} (${improvement}%)`);

    // Theoretical calculations
    // Old: 1 (opps) + N (count) + N (approved) + N (stages) = 1 + 3N
    // New: 1 (opps) + 3 (parallel queries) = 4
    console.log(`Theoretical calls for N=${OPPORTUNITIES_COUNT}: Old=${1 + 3*OPPORTUNITIES_COUNT}, New=4`);
}

main();
