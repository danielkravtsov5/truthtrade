import { NextRequest, NextResponse } from 'next/server'
import { syncAllUsers } from '@/lib/trade-sync'

export const preferredRegion = 'lhr1'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllUsers()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('Cron sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
