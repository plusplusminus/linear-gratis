import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';
import { userHasSync, fetchSyncedMetadata } from '@/lib/sync-read';

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

    // Try synced metadata first
    const hasSyncData = await userHasSync(viewData.user_id);

    if (hasSyncData) {
      const metadata = await fetchSyncedMetadata(viewData.user_id, {
        projectId: viewData.project_id || undefined,
        teamId: viewData.team_id || undefined,
      });

      if (metadata) {
        return NextResponse.json({
          success: true,
          states: metadata.states,
          labels: metadata.labels,
          members: metadata.members,
        });
      }
    }

    // Fallback to Linear API
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('linear_api_token')
      .eq('id', viewData.user_id)
      .single();

    if (!profileData?.linear_api_token) {
      return NextResponse.json(
        { error: 'Unable to load metadata - Linear API token not found' },
        { status: 500 }
      );
    }

    const decryptedToken = decryptToken(profileData.linear_api_token);

    const metadataResponse = await fetch(`${request.nextUrl.origin}/api/linear/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiToken: decryptedToken,
        teamId: viewData.team_id,
        projectId: viewData.project_id,
      })
    });

    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch metadata from Linear');
    }

    const result = await metadataResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}