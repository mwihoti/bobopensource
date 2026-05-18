import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserAnalyses, getAnalysisWithConversations } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id');

    if (analysisId) {
      const analysis = await getAnalysisWithConversations(parseInt(analysisId), userId);
      if (!analysis) {
        return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
      }
      return NextResponse.json(analysis);
    }

    const analyses = await getUserAnalyses(userId);
    return NextResponse.json(analyses);
  } catch (error: any) {
    console.error('History fetch failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history' }, { status: 500 });
  }
}
