
const DELAY_MS = 10; // Simulated network latency per request

// Mock Data
const ANALYST_ID = 'analyst_1';
const CREATOR_COUNT = 20;

const MOCK_DATA = {
  conversations: Array.from({ length: CREATOR_COUNT }, (_, i) => ({
    id: `conv_${i}`,
    analyst_id: ANALYST_ID,
    creator_id: `creator_${i}`,
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    custom_title: null,
    tags: [],
    creator: {
        name: `Creator ${i}`,
        email: `creator${i}@test.com`
    }
  })),
  messages: Array.from({ length: CREATOR_COUNT * 5 }, (_, i) => ({
    id: `msg_${i}`,
    conversation_id: `conv_${Math.floor(i / 5)}`,
    content: `Message ${i}`,
    sender_type: 'creator',
    created_at: new Date().toISOString(),
    project_context: null
  })),
  opportunity_applications: [], // Simplify for this test as we focus on messages
  opportunities: []
};

// Mock Supabase Client
const createMockSupabase = () => {
  let queryCount = 0;

  const delay = () => new Promise(resolve => setTimeout(resolve, DELAY_MS));

  const queryBuilder = (table) => {
    let filters = [];
    let limitVal = null;
    let single = false;
    let selectString = '';

    const builder = {
      select: (str) => {
        selectString = str;
        return builder;
      },
      eq: (col, val) => {
        // filters.push(row => row[col] === val); // Simple mock doesn't need actual filtering logic for perf count
        return builder;
      },
      in: (col, vals) => {
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
        return builder;
      },
      returns: () => builder,
      then: async (resolve, reject) => {
        queryCount++;
        await delay();

        // Very basic data return just to keep code flowing
        let data = MOCK_DATA[table] || [];
        resolve({ data, error: null });
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

async function runCurrentImplementation() {
  console.log('--- Running Current Implementation ---');
  const start = performance.now();
  supabase.resetQueryCount();

  // Step 1: Get all conversations
  const { data: conversationData } = await supabase
    .from('conversations')
    .select(`...`);

  // Step 2: Group (logic omitted, just simulating structure)
  const creatorConversations = new Map();
  for (const conv of conversationData || []) {
      creatorConversations.set(conv.creator_id, conv);
  }

  // Step 3: Applications (already batched in real code)
  await supabase.from('opportunity_applications').select('...');

  // Step 4: The Loop with N+1
  const unifiedConversations = await Promise.all(
    Array.from(creatorConversations.values()).map(async (conv) => {
      // Get conversation IDs (mock)
      const conversationIds = [conv.id];

      // Get last message across all conversations with this creator
      if (conversationIds.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select(`...`)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
      }
      return conv;
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

  // Step 1: Get all conversations WITH messages embedded
  const { data: conversationData } = await supabase
    .from('conversations')
    .select(`
      ...,
      messages (
        content,
        sender_type,
        created_at,
        message_type,
        project_context
      )
    `)
    // In real implementation we add limits here, but for query counting it's 1 query
    .order('last_message_at', { ascending: false });

  // Step 2: Group (logic handles embedded messages)
  const creatorConversations = new Map();
  for (const conv of conversationData || []) {
      creatorConversations.set(conv.creator_id, conv);
  }

  // Step 3: Applications (Global)
  await supabase.from('opportunity_applications').select('...');

  // Step 4: Loop is now synchronous (no supabase calls)
  const unifiedConversations = await Promise.all(
    Array.from(creatorConversations.values()).map(async (conv) => {
       // logic extracts lastMessage from conv.messages
       return conv;
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
