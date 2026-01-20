
const OPPORTUNITIES_COUNT = 5;
const LATENCY_MS = 50;

// Mock Supabase Client
const createMockSupabase = () => {
  let callCount = 0;

  const mock = {
    from: (table) => {
      return {
        select: (columns, options) => {
          return {
            eq: (column, value) => {
              // Simulate chain
              const execute = async () => {
                callCount++;
                await new Promise(resolve => setTimeout(resolve, LATENCY_MS));

                if (table === 'opportunities') {
                  // Return 5 fake opportunities
                  return {
                    data: Array.from({ length: OPPORTUNITIES_COUNT }, (_, i) => ({
                      id: `opp-${i}`,
                      title: `Opportunity ${i}`
                    })),
                    error: null
                  };
                }

                if (table === 'opportunity_applications') {
                   // Return random count
                   return {
                     count: Math.floor(Math.random() * 10),
                     data: [], // empty if head: true
                     error: null
                   };
                }

                return { data: [], error: null };
              };

              // Allow chaining limit
              const chain = {
                limit: async () => execute(),
                then: (cb) => execute().then(cb)
              };

              return chain;
            },
            in: (column, values) => {
              const execute = async () => {
                 callCount++;
                 await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
                 if (table === 'opportunity_applications') {
                    // Return flat list of applications for these IDs
                    // For simulation, let's say each opportunity has 2 applications
                    const data = [];
                    values.forEach(id => {
                        data.push({ opportunity_id: id });
                        data.push({ opportunity_id: id });
                    });
                    return { data, error: null };
                 }
                 return { data: [], error: null };
              };
              return {
                 then: (cb) => execute().then(cb)
              };
            },
            or: (query) => {
               // Chaining for opportunities search
               return {
                  eq: (col, val) => ({
                     limit: async () => {
                        callCount++;
                        await new Promise(resolve => setTimeout(resolve, LATENCY_MS));
                        return {
                            data: Array.from({ length: OPPORTUNITIES_COUNT }, (_, i) => ({
                              id: `opp-${i}`,
                              title: `Opportunity ${i}`
                            })),
                            error: null
                        };
                     }
                  })
               }
            }
          }
        }
      }
    },
    getCallCount: () => callCount,
    resetCallCount: () => { callCount = 0; }
  };
  return mock;
};

const runOldSearch = async (supabase) => {
  // Simulate fetching opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .or('search')
    .eq('analyst_id', '123')
    .limit(5);

  if (opportunities) {
    await Promise.all(
        opportunities.map(async (opp) => {
            await supabase
                .from('opportunity_applications')
                .select('*', { count: 'exact', head: true })
                .eq('opportunity_id', opp.id);
        })
    );
  }
};

const runNewSearch = async (supabase) => {
    // Simulate fetching opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .or('search')
    .eq('analyst_id', '123')
    .limit(5);

  if (opportunities) {
      const ids = opportunities.map(o => o.id);
      await supabase
        .from('opportunity_applications')
        .select('opportunity_id')
        .in('opportunity_id', ids);
  }
};

async function main() {
    const supabase = createMockSupabase();

    console.log("--- Running Benchmark ---");

    // Baseline
    supabase.resetCallCount();
    const startOld = performance.now();
    await runOldSearch(supabase);
    const endOld = performance.now();
    const callsOld = supabase.getCallCount();
    console.log(`[Baseline] Time: ${(endOld - startOld).toFixed(2)}ms, Network Calls: ${callsOld}`);

    // Optimized
    supabase.resetCallCount();
    const startNew = performance.now();
    await runNewSearch(supabase);
    const endNew = performance.now();
    const callsNew = supabase.getCallCount();
    console.log(`[Optimized] Time: ${(endNew - startNew).toFixed(2)}ms, Network Calls: ${callsNew}`);

    console.log(`\nImprovement: Call reduction: ${callsOld} -> ${callsNew} (${Math.round((callsOld-callsNew)/callsOld*100)}%)`);
}

main();
