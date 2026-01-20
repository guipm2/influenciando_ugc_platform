
const LATENCY_MS = 100;

// Mock Supabase Client that tracks time and calls
const createMockSupabase = () => {
  let callCount = 0;

  const mock = {
    from: (table) => {
      return {
        select: (columns) => {
          const execute = async () => {
            callCount++;
            await new Promise(resolve => setTimeout(resolve, LATENCY_MS));

            if (table === 'profiles') { // Creators
                return { data: [{ id: 'c1', name: 'Creator 1' }], error: null };
            }
            if (table === 'opportunities') { // Opportunities or Companies
                 // Simulating we need to check chain for 'company' search or 'analyst_id'
                 return { data: [{ id: 'o1', title: 'Opp 1', company: 'Comp A' }], error: null };
            }
            if (table === 'opportunity_applications') {
                return { data: [{ opportunity_id: 'o1' }], error: null };
            }
            return { data: [], error: null };
          };

          return {
            or: () => ({ limit: execute, eq: () => ({ limit: execute }) }), // Mock chains
            ilike: () => ({ eq: execute }),
            in: execute,
            eq: () => ({ limit: execute })
          }
        }
      }
    },
    getCallCount: () => callCount,
    resetCallCount: () => { callCount = 0; }
  };
  return mock;
};

// Simulation of Current Sequential Search
const runSequentialSearch = async (supabase) => {
    // 1. Creators
    await supabase.from('profiles').select('*').or('search').limit(8);

    // 2. Opportunities (with nested count fetch)
    const { data: opportunities } = await supabase.from('opportunities').select('*').or('search').eq('analyst', '1').limit(5);
    if (opportunities) {
        // Fetch counts (batched)
        await supabase.from('opportunity_applications').select('id').in('opp_id', ['o1']);
    }

    // 3. Companies
    await supabase.from('opportunities').select('company').ilike('search').eq('status', 'active');
};

// Simulation of Proposed Parallel Search
const runParallelSearch = async (supabase) => {
    const fetchCreators = supabase.from('profiles').select('*').or('search').limit(8);

    const fetchOpportunities = (async () => {
        const { data: opportunities } = await supabase.from('opportunities').select('*').or('search').eq('analyst', '1').limit(5);
        if (opportunities) {
            await supabase.from('opportunity_applications').select('id').in('opp_id', ['o1']);
        }
        return opportunities;
    })();

    const fetchCompanies = supabase.from('opportunities').select('company').ilike('search').eq('status', 'active');

    await Promise.all([fetchCreators, fetchOpportunities, fetchCompanies]);
};

async function main() {
    const supabase = createMockSupabase();

    console.log("--- Running Full Search Benchmark ---");

    // Sequential
    supabase.resetCallCount();
    const startSeq = performance.now();
    await runSequentialSearch(supabase);
    const endSeq = performance.now();
    console.log(`[Sequential] Time: ${(endSeq - startSeq).toFixed(2)}ms`);

    // Parallel
    supabase.resetCallCount();
    const startPar = performance.now();
    await runParallelSearch(supabase);
    const endPar = performance.now();
    console.log(`[Parallel] Time: ${(endPar - startPar).toFixed(2)}ms`);

    const improvement = (endSeq - startSeq) - (endPar - startPar);
    console.log(`\nEstimated Time Saving: ${improvement.toFixed(2)}ms`);
}

main();
