
const DELAY_MS = 10; // Simulated network latency per request

// Mock Data
// Analyst has conversations with 10 creators. Each creator has 2 conversations.
const ANALYST_ID = 'analyst_1';
const CREATOR_COUNT = 10;
const CONVS_PER_CREATOR = 2;

const MOCK_DATA = {
  conversations: [],
  messages: [],
  opportunity_applications: [],
  opportunities: []
};

// Populate Mock Data
for (let i = 0; i < CREATOR_COUNT; i++) {
  const creatorId = `creator_${i}`;
  for (let j = 0; j < CONVS_PER_CREATOR; j++) {
    const convId = `conv_${i}_${j}`;
    MOCK_DATA.conversations.push({
      id: convId,
      analyst_id: ANALYST_ID,
      creator_id: creatorId,
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      messages: [ // Pre-populated for the join simulation
         { content: `Msg ${convId}`, sender_type: 'creator', created_at: new Date().toISOString() }
      ]
    });

    // Messages for independent query
    MOCK_DATA.messages.push({
      id: `msg_${convId}`,
      conversation_id: convId,
      content: `Msg ${convId}`,
      sender_type: 'creator',
      created_at: new Date().toISOString()
    });
  }
}

// Mock Supabase Client
const createMockSupabase = () => {
  let queryCount = 0;

  const delay = () => new Promise(resolve => setTimeout(resolve, DELAY_MS));

  const queryBuilder = (table) => {
    let filters = [];
    let limitVal = null;
    let single = false;
    let selects = '*';
    let foreignTableOrder = null;
    let foreignTableLimit = null;

    const builder = {
      select: (sel) => {
        selects = sel;
        return builder;
      },
      eq: (col, val) => {
        filters.push(row => row[col] === val);
        return builder;
      },
      in: (col, vals) => {
        filters.push(row => vals && vals.includes(row[col]));
        return builder;
      },
      order: (col, opts) => {
        if (opts && opts.foreignTable) {
           foreignTableOrder = { col, opts };
        }
        return builder;
      },
      limit: (n, opts) => {
        if (opts && opts.foreignTable) {
            foreignTableLimit = n;
        } else {
            limitVal = n;
        }
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
      then: async (resolve, reject) => {
        queryCount++;
        await delay();

        let data = JSON.parse(JSON.stringify(MOCK_DATA[table] || [])); // Deep copy

        // Simple filtering
        for (const filter of filters) {
          data = data.filter(filter);
        }

        // Handle Foreign Table Select (Join) simulation
        if (selects && selects.includes('messages')) {
            data.forEach(row => {
               // In a real join, this would fetch from messages table.
               // Here we assume it's pre-populated in MOCK_DATA.conversations for simplicity of mock
               // OR we can manually attach it if table is conversations
               if (table === 'conversations') {
                   // Simulate the join
                   const msgs = MOCK_DATA.messages.filter(m => m.conversation_id === row.id);
                   row.messages = msgs;

                   // Apply foreign table limit/order if present
                   if (foreignTableLimit) {
                       row.messages = row.messages.slice(0, foreignTableLimit);
                   }
               }
            });
        }

        if (limitVal) {
          data = data.slice(0, limitVal);
        }

        if (single) {
           resolve({ data: data[0] || null, error: null });
        } else {
           resolve({ data, error: null });
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
const analyst = { id: ANALYST_ID };

async function runCurrentImplementation() {
  console.log('--- Running Current Implementation (Simulation) ---');
  supabase.resetQueryCount();
  const start = performance.now();

  // Step 1: Get all unique analyst-creator pairs who have conversations
  const { data: conversationData } = await supabase
    .from('conversations')
    .select(`...`)
    .eq('analyst_id', analyst.id);

  // Step 2: Group conversations by creator
  const creatorConversations = new Map();
  const allConversationsByCreator = new Map();

  for (const conv of conversationData || []) {
    if (!creatorConversations.has(conv.creator_id)) {
      creatorConversations.set(conv.creator_id, conv);
      allConversationsByCreator.set(conv.creator_id, []);
    }
    allConversationsByCreator.get(conv.creator_id).push(conv.id);
  }

  // Step 3: Get all projects (simulated as 1 query)
  await supabase.from('opportunity_applications').select().in('creator_id', Array.from(creatorConversations.keys()));

  // The N+1 Loop
  await Promise.all(
    Array.from(creatorConversations.values()).map(async (conv) => {
      const conversationIds = allConversationsByCreator.get(conv.creator_id) || [];
      if (conversationIds.length > 0) {
        await supabase
          .from('messages')
          .select(`...`)
          .in('conversation_id', conversationIds)
          .limit(1)
          .maybeSingle();
      }
    })
  );

  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Queries: ${supabase.getQueryCount()}`);
}

async function runOptimizedImplementation() {
  console.log('--- Running Optimized Implementation (Simulation) ---');
  supabase.resetQueryCount();
  const start = performance.now();

  // Step 1: Get all conversations WITH messages
  const { data: conversationData } = await supabase
    .from('conversations')
    .select(`
      ...,
      messages (
        content,
        sender_type,
        created_at
      )
    `)
    .eq('analyst_id', analyst.id)
    .limit(1, { foreignTable: 'messages' }); // Mock client handles this simulated join

  // Step 2: Group conversations by creator AND process messages
  const creatorConversations = new Map();
  // ... (processing logic in memory) ...

  // Step 3: Get all projects (simulated as 1 query)
  await supabase.from('opportunity_applications').select().in('creator_id', Array.from(new Set(conversationData.map(c => c.creator_id))));

  // NO N+1 Loop for messages!

  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Queries: ${supabase.getQueryCount()}`);
}

async function main() {
  await runCurrentImplementation();
  console.log('');
  await runOptimizedImplementation();
}

main();
