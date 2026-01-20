import { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectChat {
  project_id: string;
  opportunity_id: string;
  opportunity: {
    id: string;
    title: string;
    company: string;
    status: string;
    analyst_id: string;
    created_by: string;
  } | null;
  analyst: {
    name: string;
    company: string;
    avatar_url?: string | null;
  } | null;
  conversation_id: string | null;
  last_message_at: string | null;
  lastMessage?: {
    content: string;
    sender_type: string;
    created_at: string;
  };
  unread_count: number;
  custom_title?: string | null;
  tags?: string[] | null;
}

interface AnalystData {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

interface ApplicationData {
  id: string;
  opportunity_id: string;
  status: string;
  applied_at: string;
}

interface OpportunityData {
  id: string;
  title: string;
  company: string;
  analyst_id: string;
  created_by: string;
}

interface UnreadMessageData {
  conversation_id: string;
}

interface MessageData {
  conversation_id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

export const fetchCreatorChats = async (supabase: SupabaseClient, userId: string): Promise<ProjectChat[]> => {
  // Step 1: Get all conversations for this creator
  const { data: conversationData, error: convError } = await supabase
    .from('conversations')
    .select(`
      id,
      analyst_id,
      creator_id,
      opportunity_id,
      created_at,
      last_message_at,
      custom_title,
      tags
    `)
    .eq('creator_id', userId)
    .order('last_message_at', { ascending: false });

  if (convError) {
    console.error('❌ [MESSAGES] Erro ao buscar conversas:', convError);
    return [];
  }

  // Step 2: Group conversations by analyst and collect conversation IDs
  const analystConversations = new Map();
  const allConversationsByAnalyst = new Map();
  const allAnalystIds = new Set<string>();

  for (const conv of conversationData || []) {
    allAnalystIds.add(conv.analyst_id);

    if (!analystConversations.has(conv.analyst_id)) {
      analystConversations.set(conv.analyst_id, {
        id: conv.id, // Use the first conversation ID as the unified conversation ID
        analyst_id: conv.analyst_id,
        creator_id: conv.creator_id,
        created_at: conv.created_at,
        last_message_at: conv.last_message_at,
        projects: [],
        unread_count: 0,
        custom_title: conv.custom_title,
        tags: conv.tags
      });
      allConversationsByAnalyst.set(conv.analyst_id, []);
    } else {
      // Update last_message_at if this conversation is more recent
      const existing = analystConversations.get(conv.analyst_id);
      const existingDate = existing.last_message_at ? new Date(existing.last_message_at) : null;
      const currentDate = conv.last_message_at ? new Date(conv.last_message_at) : null;
      if (currentDate && (!existingDate || currentDate > existingDate)) {
        existing.id = conv.id;
        existing.last_message_at = conv.last_message_at;
        existing.custom_title = conv.custom_title;
        existing.tags = conv.tags;
      }
    }

    // Add conversation ID to the analyst's list
    allConversationsByAnalyst.get(conv.analyst_id).push(conv.id);
  }

  // Step 3: Batch Fetch Data

  // 3a. Fetch Analysts & Profiles
  const analystIdsArray = Array.from(allAnalystIds);
  const analystsMap = new Map<string, { name: string; email: string; avatar_url?: string | null }>();

  if (analystIdsArray.length > 0) {
    const { data: analysts } = await supabase
      .from('analysts')
      .select('id, name, email, avatar_url')
      .in('id', analystIdsArray)
      .returns<AnalystData[]>();

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', analystIdsArray)
        .returns<ProfileData[]>();

    analystIdsArray.forEach(id => {
       const analyst = analysts?.find((a) => a.id === id);
       if (analyst) {
         analystsMap.set(id, { name: analyst.name, email: analyst.email, avatar_url: analyst.avatar_url });
       } else {
         const profile = profiles?.find((p) => p.id === id);
         if (profile) {
            analystsMap.set(id, { name: profile.full_name, email: profile.email, avatar_url: profile.avatar_url });
         } else {
            analystsMap.set(id, { name: 'Analista', email: '', avatar_url: null });
         }
       }
    });
  }

  // 3b. Fetch Applications (Global for user)
  const { data: applications } = await supabase
    .from('opportunity_applications')
    .select('id, opportunity_id, status, applied_at')
    .eq('creator_id', userId)
    .eq('status', 'approved')
    .returns<ApplicationData[]>();

  // 3c. Fetch Opportunities (Batch)
  const opportunityIds = (applications || []).map((app) => app.opportunity_id);
  const opportunitiesMap = new Map<string, OpportunityData>();

  if (opportunityIds.length > 0) {
    const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id, title, company, analyst_id, created_by')
        .in('id', opportunityIds)
        .returns<OpportunityData[]>();

    opportunities?.forEach((op) => {
        opportunitiesMap.set(op.id, op);
    });
  }

  // 3d. Fetch Unread Messages (Batch)
  const allConvIds: string[] = [];
  allConversationsByAnalyst.forEach((ids) => allConvIds.push(...ids));

  const unreadCountsMap = new Map<string, number>();

  if (allConvIds.length > 0) {
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', allConvIds)
        .eq('read', false)
        .neq('sender_id', userId)
        .returns<UnreadMessageData[]>();

      unreadMessages?.forEach((msg) => {
          const count = unreadCountsMap.get(msg.conversation_id) || 0;
          unreadCountsMap.set(msg.conversation_id, count + 1);
      });
  }

  // 3e. Fetch Latest Messages (Batch via RPC)
  const allConversationIds: string[] = [];
  allConversationsByAnalyst.forEach((ids) => allConversationIds.push(...ids));

  const latestMessagesMap = new Map<string, MessageData>();

  if (allConversationIds.length > 0) {
    const { data: latestMessages, error: rpcError } = await supabase.rpc<MessageData[]>('get_latest_messages', {
      conversation_ids: allConversationIds
    });

    if (!rpcError && latestMessages) {
      if (Array.isArray(latestMessages)) {
        latestMessages.forEach((msg) => {
          latestMessagesMap.set(msg.conversation_id, msg);
        });
      }
    } else if (rpcError) {
      console.error('❌ [MESSAGES] Erro ao buscar últimas mensagens (RPC):', rpcError);
    }
  }

  // Step 4: Process per analyst (Memory processing only)
  const unifiedConversations = await Promise.all(
    Array.from(analystConversations.values()).map(async (conv) => {
      // Get analyst info from Map
      const analystInfo = analystsMap.get(conv.analyst_id) || { name: 'Analista', email: '', avatar_url: null };

      // Get opportunity details for each application (Memory lookup)
      const formattedProjects = (applications || []).map((app) => {
        const opportunity = opportunitiesMap.get(app.opportunity_id);

        // Match opportunity analyst with conversation analyst
        if (opportunity && opportunity.analyst_id === conv.analyst_id) {
          return {
            id: app.id,
            opportunity_id: app.opportunity_id,
            title: opportunity.title,
            company: opportunity.company,
            status: 'active' as const,
            analyst_id: opportunity.analyst_id,
            created_by: opportunity.analyst_id
          };
        }
        return null;
      }).filter(Boolean);

      // Get conversation IDs for this analyst
      const conversationIds = allConversationsByAnalyst.get(conv.analyst_id) || [];

      // Find the most recent message among all conversations for this analyst
      let lastMessage = null;
      let lastMessageDate: Date | null = null;

      conversationIds.forEach((convId: string) => {
        const msg = latestMessagesMap.get(convId);
        if (msg) {
          const msgDate = new Date(msg.created_at);
          if (!lastMessageDate || msgDate > lastMessageDate) {
            lastMessageDate = msgDate;
            lastMessage = {
              content: msg.content,
              sender_type: msg.sender_type,
              created_at: msg.created_at
            };
          }
        }
      });

      // Count unread messages (Memory lookup)
      let unreadCount = 0;
      conversationIds.forEach((id: string) => {
          unreadCount += (unreadCountsMap.get(id) || 0);
      });

      // Convert to the ProjectChat format
      return formattedProjects.map((project) => {
        if (!project) return null;

        return {
          project_id: project.id,
          opportunity_id: project.opportunity_id,
          opportunity: {
            id: project.opportunity_id,
            title: project.title,
            company: project.company,
            status: 'active',
            analyst_id: project.analyst_id,
            created_by: project.created_by
          },
          analyst: {
            name: analystInfo.name,
            company: project.company,
            avatar_url: analystInfo.avatar_url
          },
          conversation_id: conv.id,
          last_message_at: conv.last_message_at,
          lastMessage: lastMessage,
          unread_count: unreadCount,
          custom_title: conv.custom_title || null,
          tags: conv.tags || []
        } as ProjectChat;
      }).filter(Boolean);
    })
  );

  // Flatten the array of arrays and filter out nulls
  return unifiedConversations.flat().filter((chat): chat is ProjectChat => chat !== null);
};
