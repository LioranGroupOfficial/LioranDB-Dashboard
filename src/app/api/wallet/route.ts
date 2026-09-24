import { NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { getOrCreateWallet } from '@/lib/wallet';

export async function GET() {
  try {
    const sessionUser = await requireUserAPI();
    const wallet = await getOrCreateWallet(sessionUser.userId);

    return NextResponse.json({
      balancePaise: wallet.balancePaise,
      balanceRupees: wallet.balancePaise / 100,
      lifetimeCreditsAddedPaise: wallet.lifetimeCreditsAddedPaise,
      lifetimeCreditsUsedPaise: wallet.lifetimeCreditsUsedPaise,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch wallet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

