
const performance = require('perf_hooks').performance;

// Mock Data
const USER_ID = 'user-123';
const TOTAL_OPPORTUNITIES = 100;
const APPS_PER_OPPORTUNITY = 20;
const TOTAL_APPLICATIONS = TOTAL_OPPORTUNITIES * APPS_PER_OPPORTUNITY;

const opportunities = Array.from({ length: TOTAL_OPPORTUNITIES }, (_, i) => ({
  id: `opp-${i}`,
  title: `Opportunity ${i}`,
  status: i % 2 === 0 ? 'ativo' : 'concluido',
  created_by: USER_ID,
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
}));

const applications = Array.from({ length: TOTAL_APPLICATIONS }, (_, i) => ({
  id: `app-${i}`,
  opportunity_id: `opp-${Math.floor(i / APPS_PER_OPPORTUNITY)}`,
  creator_id: `creator-${i % 100}`,
  status: 'pending',
}));

// Mock Supabase Client
const createMockSupabase = () => {
  let rowsFetched = 0;
  let networkCalls = 0;

  const mock = {
    from: (table) => {
      let query = {
        table,
        select: null,
        filters: [],
        order: null,
        limit: null,
        head: false,
        countType: null,
      };

      const chain = {
        select: (columns, options) => {
          query.select = columns;
          if (options) {
            query.head = options.head;
            query.countType = options.count;
          }
          return chain;
        },
        eq: (col, val) => {
          query.filters.push({ type: 'eq', col, val });
          return chain;
        },
        in: (col, vals) => {
          query.filters.push({ type: 'in', col, vals });
          return chain;
        },
        order: (col, options) => {
          query.order = { col, ...options };
          return chain;
        },
        limit: (n) => {
          query.limit = n;
          return chain;
        },
        then: async (callback) => {
          networkCalls++;

          // Simulate latency
          await new Promise(resolve => setTimeout(resolve, 50));

          let result = [];
          if (query.table === 'opportunities') {
            result = [...opportunities];
          } else if (query.table === 'opportunity_applications') {
            result = [...applications];
          }

          // Apply filters
          for (const filter of query.filters) {
            if (filter.type === 'eq') {
              result = result.filter(item => item[filter.col] === filter.val);
            } else if (filter.type === 'in') {
              result = result.filter(item => filter.vals.includes(item[filter.col]));
            }
          }

          // Apply order
          if (query.order) {
            result.sort((a, b) => {
              if (query.order.ascending) {
                return a[query.order.col] > b[query.order.col] ? 1 : -1;
              } else {
                return a[query.order.col] < b[query.order.col] ? 1 : -1;
              }
            });
          }

          let count = null;
          if (query.countType === 'exact') {
            count = result.length;
          }

          // Apply limit
          if (query.limit) {
            result = result.slice(0, query.limit);
          }

          if (!query.head) {
            rowsFetched += result.length;
          }

          const response = {
            data: query.head ? null : result,
            error: null,
            count: count,
          };

          return callback(response);
        }
      };
      return chain;
    },
    getMetrics: () => ({ rowsFetched, networkCalls }),
  };
  return mock;
};

// Legacy Approach
async function measureLegacyApproach() {
  const supabase = createMockSupabase();
  const start = performance.now();

  // 1. Fetch all opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .eq('created_by', USER_ID)
    .order('created_at', { ascending: false });

  // 2. Fetch all applications (simulated inner join or huge IN query)
  // In reality, Supabase limits URL length, but assuming it works for "all"
  const { data: allApplications } = await supabase
    .from('opportunity_applications')
    .select('opportunity_id')
    .in('opportunity_id', opportunities.map(op => op.id));

  // 3. Calculate stats in memory
  const activeOpportunities = opportunities.filter(op => op.status === 'ativo').length;
  const completedOpportunities = opportunities.filter(op => op.status === 'concluido').length;
  const totalOpportunities = opportunities.length;
  const totalApplications = allApplications.length;

  // 4. Client side grouping
  const applicationCounts = allApplications.reduce((acc, app) => {
    acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
    return acc;
  }, {});

  const opportunitiesWithCandidatesCount = opportunities.map((opp) => ({
    ...opp,
    candidates_count: applicationCounts[opp.id] || 0
  }));

  const recentOpportunities = opportunitiesWithCandidatesCount.slice(0, 5);

  const end = performance.now();
  const metrics = supabase.getMetrics();

  return {
    time: end - start,
    ...metrics,
    results: { totalOpportunities, totalApplications, recentCount: recentOpportunities.length }
  };
}

// Optimized Approach
async function measureOptimizedApproach() {
  const supabase = createMockSupabase();
  const start = performance.now();

  // 1. Get counts using HEAD
  const [
    { count: activeOpportunities },
    { count: completedOpportunities },
    { count: totalOpportunities },
    { count: totalApplications } // Relying on RLS
  ] = await Promise.all([
    supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('created_by', USER_ID).eq('status', 'ativo'),
    supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('created_by', USER_ID).eq('status', 'concluido'),
    supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('created_by', USER_ID),
    supabase.from('opportunity_applications').select('*', { count: 'exact', head: true })
  ]);

  // 2. Fetch only top 5 opportunities
  const { data: recentOpportunities } = await supabase
    .from('opportunities')
    .select('*')
    .eq('created_by', USER_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  // 3. Fetch applications for ONLY these 5
  const { data: applicationsForRecent } = await supabase
    .from('opportunity_applications')
    .select('opportunity_id')
    .in('opportunity_id', recentOpportunities.map(op => op.id));

  // 4. Map counts
  const applicationCounts = applicationsForRecent.reduce((acc, app) => {
    acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
    return acc;
  }, {});

  const opportunitiesWithCandidatesCount = recentOpportunities.map((opp) => ({
    ...opp,
    candidates_count: applicationCounts[opp.id] || 0
  }));

  const end = performance.now();
  const metrics = supabase.getMetrics();

  return {
    time: end - start,
    ...metrics,
    results: { totalOpportunities, totalApplications, recentCount: recentOpportunities.length }
  };
}

async function runBenchmarks() {
  console.log('Running Benchmarks...');
  console.log(`Dataset: ${TOTAL_OPPORTUNITIES} Opportunities, ${TOTAL_APPLICATIONS} Applications`);

  const legacy = await measureLegacyApproach();
  console.log('\n--- Legacy Approach ---');
  console.log(`Time: ${legacy.time.toFixed(2)}ms`);
  console.log(`Rows Fetched: ${legacy.rowsFetched}`);
  console.log(`Network Calls: ${legacy.networkCalls}`);

  const optimized = await measureOptimizedApproach();
  console.log('\n--- Optimized Approach ---');
  console.log(`Time: ${optimized.time.toFixed(2)}ms`);
  console.log(`Rows Fetched: ${optimized.rowsFetched}`);
  console.log(`Network Calls: ${optimized.networkCalls}`);

  console.log('\n--- Improvement ---');
  console.log(`Rows Reduction: ${legacy.rowsFetched - optimized.rowsFetched} rows (${((1 - optimized.rowsFetched/legacy.rowsFetched)*100).toFixed(1)}%)`);

  // Note: Time might be similar in mock because mock is fast, but rows fetched translates to network bandwidth and parsing time
}

runBenchmarks();
