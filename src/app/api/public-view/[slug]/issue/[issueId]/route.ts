import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchSyncedComments } from '@/lib/sync-read';

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

    // Fetch from synced data
    const { data: syncedIssue } = await supabaseAdmin
      .from('synced_issues')
      .select('*')
      .eq('user_id', 'workspace')
      .eq('linear_id', issueId)
      .single();

    if (!syncedIssue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    const comments = await fetchSyncedComments(issueId);

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
      history: [], // History not synced
    };

    return NextResponse.json({ success: true, issue: issueDetail });
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
