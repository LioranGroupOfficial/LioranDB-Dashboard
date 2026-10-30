import type { IHostingNode } from '@/lib/db/models/HostingNode';
import { LioranDBAdminClient } from './client';

/**
 * Builds a control-plane client from the configured shared hosting node.
 * The node token is decrypted only inside this server-side module.
 */
export function createSharedHostingClient(node: Partial<IHostingNode> & { _id: unknown }): LioranDBAdminClient {
  return LioranDBAdminClient.forNode(node);
}
