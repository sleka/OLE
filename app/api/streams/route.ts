import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch all streams with their latest probe result
export async function GET() {
  try {
    const supabase = await createClient();

    // Get all active streams
    const { data: streams, error: streamsError } = await supabase
      .from('stream_configs')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (streamsError) {
      return NextResponse.json({ error: streamsError.message }, { status: 500 });
    }

    // Get latest probe for each stream
    const streamsWithProbes = await Promise.all(
      (streams || []).map(async (stream) => {
        const { data: latestProbe } = await supabase
          .from('probe_results')
          .select('*')
          .eq('stream_id', stream.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...stream,
          latest_probe: latestProbe || null,
        };
      })
    );

    return NextResponse.json({ data: streamsWithProbes });
  } catch (error) {
    console.error('Streams API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new stream config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const { name, mediamtx_url, rtsp_url, probe_interval_seconds } = body;

    if (!name || !mediamtx_url || !rtsp_url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, mediamtx_url, rtsp_url' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('stream_configs')
      .insert({
        name,
        mediamtx_url,
        rtsp_url,
        probe_interval_seconds: probe_interval_seconds || 60,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Streams API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
