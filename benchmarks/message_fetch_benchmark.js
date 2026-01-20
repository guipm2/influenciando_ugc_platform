
const DELAY_MS = 10; // Simulated network latency per request

// Mock Data
const MOCK_DATA = {
  conversations: Array.from({ length: 10 }, (_, i) => ({
    id: `conv_${i}`,
    analyst_id: `analyst_${i % 5}`,
    creator_id: 'user_1',
    opportunity_id: `opp_${i}`,
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    custom_title: null,
    tags: []
  })),
  analysts: Array.from({ length: 5 }, (_, i) => ({
    id: `analyst_${i}`,
    name: `Analyst ${i}`,
    email: `analyst${i}@test.com`,
    avatar_url: null
  })),
  opportunity_applications: Array.from({ length: 20 }, (_, i) => ({
    id: `app_${i}`,
    opportunity_id: `opp_${i % 10}`,
    creator_id: 'user_1',
    status: 'approved',
    applied_at: new Date().toISOString()
  })),
  opportunities: Array.from({ length: 10 }, (_, i) => ({
    id: `opp_${i}`,
    title: `Opportunity ${i}`,
    company: `Company ${i % 5}`,
    analyst_id: `analyst_${i % 5}`,
    created_by: `analyst_${i % 5}`
  })),
  messages: Array.from({ length: 50 }, (_, i) => ({
    id: `msg_${i}`,
    conversation_id: `conv_${i % 10}`,
    content: `Message ${i}`,
    sender_type: 'analyst',
    sender_id: `analyst_${i % 5}`,
    read: false,
    created_at: new Date().toISOString()
  })),
  profiles: []
};

// Mock Supabase Client
const createMockSupabase = () => {
  let queryCount = 0;

  const delay = () => new Promise(resolve => setTimeout(resolve, DELAY_MS));

  const queryBuilder = (table) => {
    let filters = [];
    let limitVal = null;
    let single = false;

    const builder = {
      select: () => builder,
      eq: (col, val) => {
        filters.push(row => row[col] === val);
        return builder;
      },
      in: (col, vals) => {
        filters.push(row => vals.includes(row[col]));
        return builder;
      },
      order: () => builder,
      limit: (n) => {
        limitVal = n;
        return builder;
      },
      single: () => {
        single = true;
        return builder;
      },
      maybeSingle: () => {
        single = true;
        return builder;
      },
      neq: (col, val) => {
        filters.push(row => row[col] !== val);
        return builder;
      },
      returns: () => builder,
      then: async (resolve, reject) => {
        queryCount++;
        await delay();

        let data = MOCK_DATA[table] || [];
        for (const filter of filters) {
          data = data.filter(filter);
        }

        if (limitVal) {
          data = data.slice(0, limitVal);
        }

        if (single) {
           resolve({ data: data[0] || null, error: null, count: data.length });
        } else {
           resolve({ data, error: null, count: data.length });
        }
      }
    };
    return builder;
  };

  return {
    from: queryBuilder,
    getQueryCount: () => queryCount,
    resetQueryCount: () => { queryCount = 0; }
  };
};

const supabase = createMockSupabase();
const user = { id: 'user_1' };

async function runCurrentImplementation() {
  console.log('--- Running Current Implementation ---');
  const start = performance.now();
  supabase.resetQueryCount();

  // Step 1: Get all conversations
  const { data: conversationData } = await supabase
    .from('conversations')
    .select()
    .eq('creator_id', user.id);

  // Step 2: Group
  const analystConversations = new Map();
  const allConversationsByAnalyst = new Map();

  for (const conv of conversationData || []) {
    if (!analystConversations.has(conv.analyst_id)) {
      analystConversations.set(conv.analyst_id, conv);
      allConversationsByAnalyst.set(conv.analyst_id, []);
    }
    allConversationsByAnalyst.get(conv.analyst_id).push(conv.id);
  }

  // Step 3: Loop
  const unifiedConversations = await Promise.all(
    Array.from(analystConversations.values()).map(async (conv) => {
      // Get analyst info
      const { data: analystData } = await supabase
        .from('analysts')
        .select()
        .eq('id', conv.analyst_id)
        .single();

      // Get all approved projects
      const { data: applications } = await supabase
        .from('opportunity_applications')
        .select()
        .eq('creator_id', user.id)
        .eq('status', 'approved');

      // Get opportunity details for each application
      const projectPromises = (applications || []).map(async (app) => {
        const { data: opportunity } = await supabase
          .from('opportunities')
          .select()
          .eq('id', app.opportunity_id)
          .eq('analyst_id', conv.analyst_id)
          .maybeSingle();
        return opportunity;
      });

      await Promise.all(projectPromises);

      // Get Last Message
      const conversationIds = allConversationsByAnalyst.get(conv.analyst_id) || [];
      await supabase
          .from('messages')
          .select()
          .in('conversation_id', conversationIds)
          .order('created_at')
          .limit(1)
          .maybeSingle();

       // Count unread
       await supabase
        .from('messages')
        .select()
        .in('conversation_id', conversationIds)
        .eq('read', false);

      return {};
    })
  );

  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Queries: ${supabase.getQueryCount()}`);
  return { time: end - start, queries: supabase.getQueryCount() };
}

async function runOptimizedImplementation() {
  console.log('--- Running Optimized Implementation ---');
  const start = performance.now();
  supabase.resetQueryCount();

  // Step 1: Get all conversations
  const { data: conversationData } = await supabase
    .from('conversations')
    .select()
    .eq('creator_id', user.id);

  // Step 2: Group and Collect IDs
  const analystConversations = new Map();
  const allConversationsByAnalyst = new Map();
  const allAnalystIds = new Set();

  for (const conv of conversationData || []) {
    allAnalystIds.add(conv.analyst_id);
    if (!analystConversations.has(conv.analyst_id)) {
      analystConversations.set(conv.analyst_id, conv);
      allConversationsByAnalyst.set(conv.analyst_id, []);
    }
    allConversationsByAnalyst.get(conv.analyst_id).push(conv.id);
  }

  // Step 3: Batch Fetch Data
  const analystIdsArray = Array.from(allAnalystIds);

  if (analystIdsArray.length > 0) {
      await supabase.from('analysts').select().in('id', analystIdsArray);
      await supabase.from('profiles').select().in('id', analystIdsArray);
  }

  // Fetch Applications (Global)
  const { data: applications } = await supabase
    .from('opportunity_applications')
    .select()
    .eq('creator_id', user.id)
    .eq('status', 'approved');

  // Fetch Opportunities (Batch)
  const opportunityIds = (applications || []).map(app => app.opportunity_id);
  if (opportunityIds.length > 0) {
      await supabase.from('opportunities').select().in('id', opportunityIds);
  }

  // Fetch Unread Counts (Batch)
  const allConvIds = [];
  allConversationsByAnalyst.forEach(ids => allConvIds.push(...ids));
  if (allConvIds.length > 0) {
      await supabase.from('messages').select().in('conversation_id', allConvIds).eq('read', false);
  }

  // Step 4: Process per analyst
  await Promise.all(
    Array.from(analystConversations.values()).map(async (conv) => {
       const conversationIds = allConversationsByAnalyst.get(conv.analyst_id) || [];
       if (conversationIds.length > 0) {
           await supabase.from('messages').select().in('conversation_id', conversationIds).limit(1).maybeSingle();
       }
    })
  );

  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Queries: ${supabase.getQueryCount()}`);
  return { time: end - start, queries: supabase.getQueryCount() };
}

async function main() {
  await runCurrentImplementation();
  console.log('\n');
  await runOptimizedImplementation();
}

main();
