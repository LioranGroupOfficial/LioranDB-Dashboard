import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, StudioHandoff } from '@/lib/db';
import { decrypt, generateSecureToken, sha256 } from '@/lib/crypto';
import { createApiError } from '@/lib/errors';
import { parseLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';

const STUDIO_URL = 'https://studio.liorandb.com/';
const HANDOFF_TTL_MS = 60_000;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAccountVerifiedUserAPI();
    const { id } = await params;
    await connectToDatabase();

    const instance = await ManagedDatabase.findOne({
      _id: id,
      $or: [{ customerId: user.userId }, { userId: user.userId }],
    }).lean();

    if (!instance) return NextResponse.json({ error: 'Database instance not found.' }, { status: 404 });
    if (!['ACTIVE', 'RUNNING'].includes(instance.status)) {
      return NextResponse.json({ error: 'Studio is available only for an active database.' }, { status: 409 });
    }
    if (!instance.databaseName || !instance.encryptedConnectionUri) {
      return NextResponse.json({ error: 'The database connection is not ready.' }, { status: 409 });
    }

    // Validate the encrypted record server-side without returning the credential.
    const parsedUri = parseLioranDBConnectionUri(decrypt(instance.encryptedConnectionUri));
    if (!parsedUri.username || parsedUri.password === undefined) {
      return NextResponse.json({ error: 'The database connection is not ready.' }, { status: 409 });
    }

    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);
    await StudioHandoff.create({
      customerId: instance.customerId,
      instanceId: instance._id,
      tokenHash: sha256(token),
      expiresAt,
      createdAt: new Date(),
    });

    const studioUrl = new URL(STUDIO_URL);
    studioUrl.searchParams.set('handoff', token);

    return NextResponse.json(
      { url: studioUrl.toString(), expiresAt: expiresAt.toISOString() },
      { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    );
  } catch (error: unknown) {
    return createApiError(error);
  }
}
