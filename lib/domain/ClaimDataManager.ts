import { verifyDocument } from '@/lib/tools/verifyDocument';
import { lookupPolicy } from '@/lib/tools/lookupPolicy';
import { checkMedicalNecessity } from '@/lib/tools/checkMedicalNecessity';
import { calculateBenefit } from '@/lib/tools/calculateBenefit';
import type { ParsedClaim } from '@/lib/parser/claimParser';
import type { Policy, Exclusion, CoverageClause, Coverage } from '@/types/policy';
import type { ClaimType } from '@/types/claims';
import type { DocumentFinding } from '@/types/report';
import type { WorkflowToolCall } from '@/types/workflow';
import type { LookupPolicyResult } from '@/lib/tools/lookupPolicy';
import type { VerifyDocumentResult } from '@/lib/tools/verifyDocument';
import type { CheckMedicalNecessityResult } from '@/lib/tools/checkMedicalNecessity';
import type { CalculateBenefitResult } from '@/lib/tools/calculateBenefit';

// ── Domain types ──────────────────────────────────────────────────────────────

export type PrecheckStatus = 'OK' | 'MISSING_DOCS' | 'EXCLUDED' | 'INVALID' | 'NOT_COVERED';

export interface PrecheckResult {
  status: PrecheckStatus;
  blockedStep?: 'DOCUMENT' | 'POLICY' | 'MEDICAL' | 'BENEFIT';
  reasons: string[];
  confidence: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  riskFlags: string[];
}

export interface DocumentHealthSummary {
  total: number;
  valid: number;
  invalid: number;
  missing: number;
  /** Vacuously true for empty documentIds — preserves legacy gate behavior */
  allValid: boolean;
  hasDocuments: boolean;
  invalidIds: string[];
}

export interface ClaimContext {
  claim: ParsedClaim;
  policy: Policy | null;
  documents: DocumentFinding[];
  medical: CheckMedicalNecessityResult;
  benefit: CalculateBenefitResult | null;
  precheck: PrecheckResult;
  eligibility: EligibilityResult;
}

export interface DataAccessLog {
  type: 'DATA_ACCESS_LOG';
  layer: 'ClaimDataManager';
  action: string;
  input: unknown;
  outputSummary: string;
  timestamp: number;
}

// Re-export tool result types so callers need only import from this module
export type { VerifyDocumentResult, LookupPolicyResult, CheckMedicalNecessityResult, CalculateBenefitResult };

// ── ClaimDataManager ──────────────────────────────────────────────────────────

/**
 * Single source of truth for all data access in the claim assessment workflow.
 * The Workflow Layer must call ONLY this class — never lib/data/* or lib/tools/* directly.
 *
 * All tool calls are memoized: repeated calls return the cached result without
 * re-executing the tool or adding a duplicate entry to toolCalls[].
 */
export class ClaimDataManager {
  private readonly _claim: ParsedClaim;

  private _policyResult: LookupPolicyResult | null = null;
  private _docResults = new Map<string, VerifyDocumentResult>();
  private _necessityResult: CheckMedicalNecessityResult | null = null;
  private _benefitResult: CalculateBenefitResult | null = null;

  private _toolCalls: WorkflowToolCall[] = [];
  private _callIndex = 0;
  private _trace: DataAccessLog[] = [];

  constructor(claim: ParsedClaim) {
    this._claim = claim;
  }

  // ── Tool call management ──────────────────────────────────────────────────

  get toolCalls(): readonly WorkflowToolCall[] {
    return this._toolCalls;
  }

  get trace(): readonly DataAccessLog[] {
    return this._trace;
  }

  /** Returns the ID the next tool call will use, without consuming it. */
  peekNextCallId(): string {
    return `tool-${this._callIndex + 1}`;
  }

  getLastToolCall(): WorkflowToolCall {
    const last = this._toolCalls[this._toolCalls.length - 1];
    if (!last) throw new Error('[ClaimDataManager] No tool calls recorded yet');
    return last;
  }

  private _record<T>(toolName: string, input: Record<string, unknown>, output: T): T {
    this._toolCalls.push({ toolCallId: `tool-${++this._callIndex}`, toolName, input, output, status: 'done' });
    return output;
  }

  private _log(action: string, input: unknown, outputSummary: string): void {
    this._trace.push({ type: 'DATA_ACCESS_LOG', layer: 'ClaimDataManager', action, input, outputSummary, timestamp: Date.now() });
  }

  // ── Policy ────────────────────────────────────────────────────────────────

  /** Wraps lookupPolicy tool. Memoized after first call. */
  lookupPolicy(): LookupPolicyResult {
    if (this._policyResult !== null) return this._policyResult;
    const input = { policyId: this._claim.policyId };
    this._policyResult = this._record('lookupPolicy', input, lookupPolicy(input));
    this._log('lookupPolicy', input, this._policyResult.success ? 'found' : 'not found');
    return this._policyResult;
  }

  getPolicySnapshot(): Policy | null {
    const r = this.lookupPolicy();
    return r.success ? r.policy : null;
  }

  isPolicyActive(): boolean {
    const policy = this.getPolicySnapshot();
    return policy !== null && policy.status === 'active';
  }

  getCoverage(claimType: ClaimType): Coverage | null {
    return this.getPolicySnapshot()?.coverages.find((c) => c.claimType === claimType) ?? null;
  }

  getMatchedExclusion(): Exclusion | undefined {
    if (!this.isPolicyActive()) return undefined;
    return this.getPolicySnapshot()?.exclusions.find((e) => e.claimTypes.includes(this._claim.claimType));
  }

  getMatchedCoverageClause(): CoverageClause | undefined {
    if (!this.isPolicyActive()) return undefined;
    return this.getPolicySnapshot()?.coverageClauses.find((c) => c.claimType === this._claim.claimType);
  }

  isClaimTypeExcluded(): boolean {
    return this.isPolicyActive() && this.getMatchedExclusion() !== undefined;
  }

  getPolicyClauses(): { exclusions: Exclusion[]; coverageClauses: CoverageClause[] } {
    const policy = this.getPolicySnapshot();
    return { exclusions: policy?.exclusions ?? [], coverageClauses: policy?.coverageClauses ?? [] };
  }

  checkExclusions(): { excluded: boolean; exclusion: Exclusion | null; clauseId: string | null } {
    const excluded = this.isClaimTypeExcluded();
    const excl = this.getMatchedExclusion() ?? null;
    return { excluded, exclusion: excl, clauseId: excl?.clauseId ?? null };
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  /** Wraps verifyDocument tool. Memoized per documentId. */
  verifyDocument(documentId: string): VerifyDocumentResult {
    if (this._docResults.has(documentId)) return this._docResults.get(documentId)!;
    const input = { documentId };
    const result = this._record('verifyDocument', input, verifyDocument(input));
    this._docResults.set(documentId, result);
    this._log('verifyDocument', input, result.success ? (result.valid ? 'valid' : 'invalid') : 'not found');
    return result;
  }

  /** Verifies all documents in the claim. Safe to call multiple times — results are cached. */
  verifyDocuments(): Map<string, VerifyDocumentResult> {
    for (const id of this._claim.documentIds) {
      this.verifyDocument(id);
    }
    return this._docResults;
  }

  hasDocuments(): boolean {
    return this._claim.documentIds.length > 0;
  }

  getAllDocuments(): DocumentFinding[] {
    return this._claim.documentIds.map((documentId) => {
      const result = this.verifyDocument(documentId);
      return {
        documentId,
        documentType: result.success ? result.documentType : 'unknown',
        status: !result.success ? 'not found' : result.valid ? 'valid' : 'invalid',
        issues: result.success ? result.issues : [result.error],
      };
    });
  }

  /**
   * True when every submitted document passes verification.
   * Vacuously true for empty documentIds — preserves legacy gate behavior.
   */
  areAllDocsValid(): boolean {
    this.verifyDocuments();
    for (const id of this._claim.documentIds) {
      const r = this._docResults.get(id);
      if (!r || !r.success || !r.valid) return false;
    }
    return true;
  }

  getMissingDocuments(): string[] {
    return this._claim.documentIds.filter((id) => {
      const r = this._docResults.get(id);
      return r && (!r.success || !r.valid);
    });
  }

  getDocumentHealthSummary(): DocumentHealthSummary {
    const total = this._claim.documentIds.length;
    let valid = 0;
    let invalid = 0;
    let missing = 0;
    const invalidIds: string[] = [];

    for (const id of this._claim.documentIds) {
      const r = this._docResults.get(id);
      if (!r) continue;
      if (r.success && r.valid) {
        valid++;
      } else if (!r.success) {
        missing++;
        invalidIds.push(id);
      } else {
        invalid++;
        invalidIds.push(id);
      }
    }

    return { total, valid, invalid, missing, allValid: valid === total, hasDocuments: total > 0, invalidIds };
  }

  // ── Medical ───────────────────────────────────────────────────────────────

  /** Wraps checkMedicalNecessity tool. Memoized after first call. */
  getMedicalNecessity(): CheckMedicalNecessityResult {
    if (this._necessityResult !== null) return this._necessityResult;
    const input = { diagnosis: this._claim.diagnosis, procedures: this._claim.procedures };
    this._necessityResult = this._record('checkMedicalNecessity', input, checkMedicalNecessity(input));
    this._log('checkMedicalNecessity', input, `necessary=${this._necessityResult.necessary}`);
    return this._necessityResult;
  }

  isMedicallyNecessary(): boolean {
    return this.getMedicalNecessity().necessary;
  }

  hasUnapprovedProcedures(): boolean {
    const r = this.getMedicalNecessity();
    return r.necessary && r.unapprovedProcedures.length > 0;
  }

  getApprovedProcedures(): string[] {
    return this.getMedicalNecessity().approvedProcedures;
  }

  // ── Benefit ───────────────────────────────────────────────────────────────

  /** Wraps calculateBenefit tool. Memoized after first call. */
  calculateBenefit(): CalculateBenefitResult {
    if (this._benefitResult !== null) return this._benefitResult;
    const input = { policyId: this._claim.policyId, claimType: this._claim.claimType, amount: this._claim.requestedAmount };
    this._benefitResult = this._record('calculateBenefit', input, calculateBenefit(input));
    this._log('calculateBenefit', input, this._benefitResult.success ? `covered=$${this._benefitResult.coveredAmount}` : 'failed');
    return this._benefitResult;
  }

  // ── Orchestration ─────────────────────────────────────────────────────────

  /**
   * Evaluates all gates in priority order using cached results.
   * Triggers any data fetching not already cached.
   *
   * Priority: MISSING_DOCS → INVALID (policy) → EXCLUDED → NOT_COVERED → INVALID (medical) → OK
   */
  runPrecheck(): PrecheckResult {
    this.verifyDocuments();
    this.lookupPolicy();
    this.getMedicalNecessity();

    if (!this.areAllDocsValid()) {
      const health = this.getDocumentHealthSummary();
      const reason = health.invalidIds.length > 0
        ? `Document(s) ${health.invalidIds.join(', ')} are missing or invalid.`
        : 'No documents submitted.';
      return { status: 'MISSING_DOCS', blockedStep: 'DOCUMENT', reasons: [reason], confidence: 1.0 };
    }

    if (!this.isPolicyActive()) {
      const policy = this.getPolicySnapshot();
      const reason = policy
        ? `Policy ${this._claim.policyId} is not active (status: ${policy.status}).`
        : `Policy ${this._claim.policyId} not found.`;
      return { status: 'INVALID', blockedStep: 'POLICY', reasons: [reason], confidence: 1.0 };
    }

    if (this.isClaimTypeExcluded()) {
      const excl = this.getMatchedExclusion()!;
      return {
        status: 'EXCLUDED',
        blockedStep: 'POLICY',
        reasons: [`Claim type "${this._claim.claimType}" is excluded under clause ${excl.clauseId}: ${excl.description}`],
        confidence: 1.0,
      };
    }

    if (!this.getCoverage(this._claim.claimType)) {
      return {
        status: 'NOT_COVERED',
        blockedStep: 'POLICY',
        reasons: [`No coverage found for claim type "${this._claim.claimType}" under policy ${this._claim.policyId}.`],
        confidence: 1.0,
      };
    }

    if (!this.isMedicallyNecessary()) {
      const necessity = this.getMedicalNecessity();
      return {
        status: 'INVALID',
        blockedStep: 'MEDICAL',
        reasons: [`Medical necessity not established. ${necessity.rationale}`],
        confidence: 1.0,
      };
    }

    return { status: 'OK', reasons: [], confidence: 1.0 };
  }

  /** High-level eligibility determination with risk flags. Uses cached runPrecheck() result. */
  runEligibilityGate(): EligibilityResult {
    const precheck = this.runPrecheck();
    const eligible = precheck.status === 'OK';
    const riskFlags: string[] = [];

    const policy = this.getPolicySnapshot();
    if (eligible && policy && !policy.annualDeductibleMet) {
      const cov = this.getCoverage(this._claim.claimType);
      if (cov && cov.deductible > 0) {
        riskFlags.push(`Annual deductible not yet met — $${cov.deductible} will be applied.`);
      }
    }

    if (eligible && this.hasUnapprovedProcedures()) {
      const r = this.getMedicalNecessity();
      riskFlags.push(`Unapproved procedures detected: ${r.unapprovedProcedures.join(', ')}.`);
    }

    return { eligible, reasons: precheck.reasons, riskFlags };
  }

  /** Builds the complete enriched claim context snapshot. Triggers all data fetching if not cached. */
  buildClaimContext(): ClaimContext {
    return {
      claim: this._claim,
      policy: this.getPolicySnapshot(),
      documents: this.getAllDocuments(),
      medical: this.getMedicalNecessity(),
      benefit: this._benefitResult,
      precheck: this.runPrecheck(),
      eligibility: this.runEligibilityGate(),
    };
  }
}
