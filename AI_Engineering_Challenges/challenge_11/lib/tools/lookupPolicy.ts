import { getPolicyById } from '@/lib/data/policies';
import type { Policy } from '@/types/policy';

export interface LookupPolicyInput {
  policyId: string;
}

export type LookupPolicyResult =
  | { success: true; policy: Policy }
  | { success: false; error: string };

export function lookupPolicy(input: LookupPolicyInput): LookupPolicyResult {
  const policy = getPolicyById(input.policyId);
  if (!policy) {
    return { success: false, error: `Policy "${input.policyId}" not found.` };
  }
  return { success: true, policy };
}
