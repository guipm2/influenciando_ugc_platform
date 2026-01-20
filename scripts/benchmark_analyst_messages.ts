
import { strict as assert } from 'assert';

// Mock Data
const ANALYST_ID = 'analyst-1';
const CREATORS = Array.from({ length: 10 }, (_, i) => ({
  id: `creator-${i}`,
  name: `Creator ${i}`,
  email: `creator${i}@example.com`
}));

const CONVERSATIONS = CREATORS.map((c, i) => ({
  id: `conv-${i}`,
  analyst_id: ANALYST_ID,
  creator_id: c.id,
  created_at: '2023-01-01T00:00:00Z',
  last_message_at: '2023-01-02T00:00:00Z',
  custom_title: null,
  tags: [],
  creator: { name: c.name, email: c.email }
}));

const OPPORTUNITIES = Array.from({ length: 20 }, (_, i) => ({
  id: `opp-${i}`,
  title: `Opportunity ${i}`,
  company: `Company ${i}`,
  analyst_id: ANALYST_ID
}));

// Assign 2 opportunities to each creator
const APPLICATIONS = CREATORS.flatMap((c, i) => {
  const opp1 = OPPORTUNITIES[i * 2];
  const opp2 = OPPORTUNITIES[i * 2 + 1];
  return [
    { id: `app-${c.id}-1`, opportunity_id: opp1.id, creator_id: c.id, status: 'approved', applied_at: '2023-01-01' },
    { id: `app-${c.id}-2`, opportunity_id: opp2.id, creator_id: c.id, status: 'approved', applied_at: '2023-01-02' }
  ];
});

const MESSAGES = CONVERSATIONS.map(c => ({
  content: 'Hello',
  sender_type: 'creator',
  created_at: '2023-01-02T00:00:00Z',
  message_type: 'general',
  project_context: null,
  conversation_id: c.id
}));

class MockQueryBuilder {
  table: string;
  filters: any[] = [];
  selectQuery = '';
  client: MockSupabase;

  constructor(client: MockSupabase, table: string) {
    this.client = client;
    this.table = table;
  }

  select(query: string) {
    this.selectQuery = query;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: 'in', column, value: values });
    return this;
  }

  order(column: string, opts: any) {
    return this;
  }

  limit(n: number) {
    return this;
  }

  maybeSingle() {
    return this.single();
  }

  async single() {
    const result = await this.execute();
    return { data: result.data ? result.data[0] : null, error: null };
  }

  async then(resolve: any, reject: any) {
    const result = await this.execute();
    resolve(result);
  }

  async execute() {
    this.client.incrementQueryCount();

    let data: any[] = [];

    if (this.table === 'conversations') {
        data = [...CONVERSATIONS];
    } else if (this.table === 'opportunity_applications') {
        data = [...APPLICATIONS];

        // Handle nested select if present
        if (this.selectQuery.includes('opportunity:opportunities')) {
             data = data.map(app => {
                 const opp = OPPORTUNITIES.find(o => o.id === app.opportunity_id);
                 return { ...app, opportunity: opp };
             });
        }
    } else if (this.table === 'opportunities') {
        data = [...OPPORTUNITIES];
    } else if (this.table === 'messages') {
        data = [...MESSAGES];
    }

    // Apply filters
    for (const filter of this.filters) {
        if (filter.type === 'eq') {
            if (filter.column === 'status' && filter.value === 'approved') {
                 data = data.filter(d => d.status === 'approved');
            } else if (filter.column === 'creator_id') {
                 data = data.filter(d => d.creator_id === filter.value);
            } else if (filter.column === 'id') {
                 data = data.filter(d => d.id === filter.value);
            } else if (filter.column === 'analyst_id') {
                 data = data.filter(d => d.analyst_id === filter.value);
            }
        } else if (filter.type === 'in') {
             if (filter.column === 'creator_id') {
                 data = data.filter(d => filter.value.includes(d.creator_id));
             } else if (filter.column === 'conversation_id') {
                 data = data.filter(d => filter.value.includes(d.conversation_id));
             }
        }
    }

    return { data, error: null };
  }
}

// Mock Supabase Client
class MockSupabase {
  queryCount = 0;

  from(table: string) {
    return new MockQueryBuilder(this, table);
  }

  incrementQueryCount() {
    this.queryCount++;
  }
}

async function runBenchmark() {
    console.log('Starting Benchmark...');

    // ---------------------------------------------------------
    // OLD LOGIC
    // ---------------------------------------------------------
    console.log('\n--- Running OLD Logic ---');
    const supabaseOld = new MockSupabase();

    const { data: conversationData } = await supabaseOld
        .from('conversations')
        .select('*')
        .eq('analyst_id', ANALYST_ID);

    const creatorConversations = new Map();
    const allConversationsByCreator = new Map();

    for (const conv of conversationData || []) {
        if (!creatorConversations.has(conv.creator_id)) {
            creatorConversations.set(conv.creator_id, { ...conv, projects: [] });
            allConversationsByCreator.set(conv.creator_id, []);
        }
        allConversationsByCreator.get(conv.creator_id).push(conv.id);
    }

    const unifiedConversationsOld = await Promise.all(
        Array.from(creatorConversations.values()).map(async (conv) => {
            const { data: applications } = await supabaseOld
                .from('opportunity_applications')
                .select('id, opportunity_id, status, applied_at')
                .eq('creator_id', conv.creator_id)
                .eq('status', 'approved');

            const projectPromises = (applications || []).map(async (app: any) => {
                const { data: opportunity } = await supabaseOld
                    .from('opportunities')
                    .select('id, title, company, analyst_id')
                    .eq('id', app.opportunity_id)
                    .eq('analyst_id', ANALYST_ID)
                    .maybeSingle();

                if (opportunity) {
                    return {
                        id: app.id,
                        opportunity_id: app.opportunity_id,
                        opportunity_title: opportunity.title,
                        status: 'active',
                        started_at: app.applied_at
                    };
                }
                return null;
            });

            const projectResults = await Promise.all(projectPromises);
            const formattedProjects = projectResults.filter(Boolean);

            const conversationIds = allConversationsByCreator.get(conv.creator_id) || [];
            if (conversationIds.length > 0) {
                 await supabaseOld
                    .from('messages')
                    .select('*')
                    .in('conversation_id', conversationIds)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
            }

            return {
                ...conv,
                projects: formattedProjects
            };
        })
    );

    console.log(`Old Logic Queries: ${supabaseOld.queryCount}`);

    // ---------------------------------------------------------
    // NEW LOGIC
    // ---------------------------------------------------------
    console.log('\n--- Running NEW Logic ---');
    const supabaseNew = new MockSupabase();

    const { data: conversationDataNew } = await supabaseNew
        .from('conversations')
        .select('*')
        .eq('analyst_id', ANALYST_ID);

    const creatorConversationsNew = new Map();
    const allConversationsByCreatorNew = new Map();

    for (const conv of conversationDataNew || []) {
        if (!creatorConversationsNew.has(conv.creator_id)) {
            creatorConversationsNew.set(conv.creator_id, { ...conv, projects: [] });
            allConversationsByCreatorNew.set(conv.creator_id, []);
        }
        allConversationsByCreatorNew.get(conv.creator_id).push(conv.id);
    }

    const creatorIds = Array.from(creatorConversationsNew.keys());

    const { data: allApplications } = await supabaseNew
        .from('opportunity_applications')
        .select(`
          id,
          opportunity_id,
          status,
          applied_at,
          creator_id,
          opportunity:opportunities (
            id,
            title,
            company,
            analyst_id
          )
        `)
        .in('creator_id', creatorIds)
        .eq('status', 'approved');

    const relevantApplications = (allApplications || []).filter((app: any) => {
        const opp = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
        return opp && opp.analyst_id === ANALYST_ID;
    });

    const applicationsByCreator = new Map();
    relevantApplications.forEach((app: any) => {
        if (!applicationsByCreator.has(app.creator_id)) {
            applicationsByCreator.set(app.creator_id, []);
        }
        applicationsByCreator.get(app.creator_id).push(app);
    });

    const unifiedConversationsNew = await Promise.all(
        Array.from(creatorConversationsNew.values()).map(async (conv) => {
             const creatorApps = applicationsByCreator.get(conv.creator_id) || [];

            const formattedProjects = creatorApps.map((app: any) => {
                const opp = Array.isArray(app.opportunity) ? app.opportunity[0] : app.opportunity;
                return {
                    id: app.id,
                    opportunity_id: app.opportunity_id,
                    opportunity_title: opp.title,
                    status: 'active',
                    started_at: app.applied_at
                };
            });

            const conversationIds = allConversationsByCreatorNew.get(conv.creator_id) || [];
            if (conversationIds.length > 0) {
                 await supabaseNew
                    .from('messages')
                    .select('*')
                    .in('conversation_id', conversationIds)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
            }

            return {
                ...conv,
                projects: formattedProjects
            };
        })
    );

    console.log(`New Logic Queries: ${supabaseNew.queryCount}`);

    // Validation
    console.log('\n--- Validation ---');
    console.log(`Creators: ${CREATORS.length}`);

    if (unifiedConversationsOld.length !== unifiedConversationsNew.length) {
        throw new Error('Mismatch in result length');
    }

    // Debug order
    console.log(`Old First Creator ID: ${unifiedConversationsOld[0].creator_id}`);

    const oldFirst = unifiedConversationsOld[0];
    const newFirst = unifiedConversationsNew.find((c: any) => c.creator_id === oldFirst.creator_id);

    if (!newFirst) {
        throw new Error(`Could not find matching creator in new results: ${oldFirst.creator_id}`);
    }

    console.log(`New Matching Creator ID: ${newFirst.creator_id}`);

    if (JSON.stringify(oldFirst.projects) !== JSON.stringify(newFirst.projects)) {
        console.error('Old Projects:', JSON.stringify(oldFirst.projects, null, 2));
        console.error('New Projects:', JSON.stringify(newFirst.projects, null, 2));
        throw new Error('Mismatch in projects data');
    }

    console.log('✅ Validation Successful! Logic is equivalent.');
}

runBenchmark().catch(console.error);
