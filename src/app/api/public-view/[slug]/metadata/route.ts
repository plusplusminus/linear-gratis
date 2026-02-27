import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchSyncedMetadata } from '@/lib/sync-read';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get the public view
    const { data: viewData, error: viewError } = await supabaseAdmin
      .from('public_views')
      .select('*')
      .eq('slug', slug)
      .single();

    if (viewError || !viewData) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      );
    }

    // Check if issue creation is allowed
    if (!viewData.allow_issue_creation) {
      return NextResponse.json(
        { error: 'Issue creation is not allowed for this view' },
        { status: 403 }
      );
    }

    const metadata = await fetchSyncedMetadata({
      projectId: viewData.project_id || undefined,
      teamId: viewData.team_id || undefined,
    });

    if (!metadata) {
      return NextResponse.json(
        { error: 'No synced data available' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      states: metadata.states,
      labels: metadata.labels,
      members: metadata.members,
    });

  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
