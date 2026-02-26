import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';
import { userHasSync, fetchSyncedComments } from '@/lib/sync-read';

export type IssueComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
};

export type IssueHistory = {
  id: string;
  createdAt: string;
  fromState?: {
    name: string;
    color: string;
  };
  toState?: {
    name: string;
    color: string;
  };
  fromAssignee?: {
    name: string;
  };
  toAssignee?: {
    name: string;
  };
  fromPriority?: number;
  toPriority?: number;
  user: {
    name: string;
  };
};

export type IssueDetail = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  url: string;
  state: {
    id: string;
    name: string;
    color: string;
    type: string;
  };
  assignee?: {
    id: string;
    name: string;
  };
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  createdAt: string;
  updatedAt: string;
  comments: IssueComment[];
  history: IssueHistory[];
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  try {
    const { slug, issueId } = await params;

    if (!slug || !issueId) {
      return NextResponse.json(
        { error: 'Slug and issueId parameters are required' },
        { status: 400 }
      );
    }

    // Check if view exists and is active
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'Public view not found or inactive' },
        { status: 404 }
      );
    }

    // Check if view has expired
    if (viewData.expires_at && new Date(viewData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This public view has expired' },
        { status: 410 }
      );
    }

    // Try synced data first
    const hasSyncData = await userHasSync(viewData.user_id);

    if (hasSyncData) {
      const { data: syncedIssue } = await supabaseAdmin
        .from('synced_issues')
        .select('*')
        .eq('user_id', viewData.user_id)
        .eq('linear_id', issueId)
        .single();

      if (syncedIssue) {
        const comments = await fetchSyncedComments(viewData.user_id, issueId);

        const issueDetail: IssueDetail = {
          id: syncedIssue.linear_id,
          identifier: syncedIssue.identifier,
          title: syncedIssue.title,
          description: syncedIssue.description ?? undefined,
          priority: syncedIssue.priority ?? 0,
          priorityLabel: ['No priority', 'Urgent', 'High', 'Medium', 'Low'][syncedIssue.priority ?? 0] || 'No priority',
          url: syncedIssue.url ?? '',
          state: { id: '', name: syncedIssue.state ?? 'Unknown', color: '', type: '' },
          assignee: syncedIssue.assignee ? { id: '', name: syncedIssue.assignee } : undefined,
          labels: Array.isArray(syncedIssue.labels) ? syncedIssue.labels as Array<{ id: string; name: string; color: string }> : [],
          createdAt: syncedIssue.created_at,
          updatedAt: syncedIssue.updated_at,
          comments,
          history: [], // History not synced — only available via Linear API
        };

        return NextResponse.json({ success: true, issue: issueDetail });
      }
    }

    // Fallback to Linear API
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('linear_api_token')
      .eq('id', viewData.user_id)
      .single();

    if (profileError || !profileData?.linear_api_token) {
      return NextResponse.json(
        { error: 'Unable to load data - Linear API token not found' },
        { status: 500 }
      );
    }

    const decryptedToken = decryptToken(profileData.linear_api_token);

    const query = `
      query IssueDetail($issueId: String!) {
        issue(id: $issueId) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          url
          state {
            id
            name
            color
            type
          }
          assignee {
            id
            name
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          createdAt
          updatedAt
          comments {
            nodes {
              id
              body
              createdAt
              updatedAt
              user {
                id
                name
                avatarUrl
              }
            }
          }
          history {
            nodes {
              id
              createdAt
              fromState {
                name
                color
              }
              toState {
                name
                color
              }
              fromAssignee {
                name
              }
              toAssignee {
                name
              }
              fromPriority
              toPriority
              actor {
                name
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${decryptedToken.replace(/[^\x00-\xFF]/g, '')}`,
      },
      body: JSON.stringify({
        query,
        variables: { issueId }
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Linear API error: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as {
      data?: {
        issue: {
          id: string;
          identifier: string;
          title: string;
          description?: string;
          priority: number;
          priorityLabel: string;
          url: string;
          state: {
            id: string;
            name: string;
            color: string;
            type: string;
          };
          assignee?: {
            id: string;
            name: string;
          };
          labels: {
            nodes: Array<{
              id: string;
              name: string;
              color: string;
            }>;
          };
          createdAt: string;
          updatedAt: string;
          comments: {
            nodes: Array<{
              id: string;
              body: string;
              createdAt: string;
              updatedAt: string;
              user: {
                id: string;
                name: string;
                avatarUrl?: string;
              };
            }>;
          };
          history: {
            nodes: Array<{
              id: string;
              createdAt: string;
              fromState?: {
                name: string;
                color: string;
              };
              toState?: {
                name: string;
                color: string;
              };
              fromAssignee?: {
                name: string;
              };
              toAssignee?: {
                name: string;
              };
              fromPriority?: number;
              toPriority?: number;
              actor: {
                name: string;
              };
            }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`
      );
    }

    if (!result.data?.issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    const issue = result.data.issue;

    // Transform the data to match our IssueDetail type
    const issueDetail: IssueDetail = {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      url: issue.url,
      state: issue.state,
      assignee: issue.assignee,
      labels: issue.labels.nodes,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      comments: issue.comments.nodes,
      history: issue.history.nodes.map(h => ({
        id: h.id,
        createdAt: h.createdAt,
        fromState: h.fromState,
        toState: h.toState,
        fromAssignee: h.fromAssignee,
        toAssignee: h.toAssignee,
        fromPriority: h.fromPriority,
        toPriority: h.toPriority,
        user: h.actor,
      })),
    };

    return NextResponse.json({
      success: true,
      issue: issueDetail,
    });
  } catch (error) {
    console.error('Issue detail API error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
