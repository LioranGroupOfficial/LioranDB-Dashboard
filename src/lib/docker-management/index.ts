/**
 * LioranDB Docker Management Module
 *
 * Dedicated client, typed errors, contracts, and lifecycle helpers
 * for managing physical container states behind https://pan.liorandb.com.
 */

export * from './types';
export * from './errors';
export * from './client';

import { LioranDBDockerManagementClient } from './client';

let globalDockerClient: LioranDBDockerManagementClient | null = null;

/**
 * Retrieves the singleton Docker management client instance.
 */
export function getDockerManagementClient(): LioranDBDockerManagementClient {
  if (!globalDockerClient) {
    globalDockerClient = new LioranDBDockerManagementClient();
  }
  return globalDockerClient;
}

export const dockerManagementClient = new Proxy({} as LioranDBDockerManagementClient, {
  get(_target, prop: keyof LioranDBDockerManagementClient) {
    const client = getDockerManagementClient();
    const val = client[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
