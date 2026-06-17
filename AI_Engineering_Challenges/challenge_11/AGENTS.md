# AI Claim Assessment Agent

Goal:
Build a conversational AI agent that performs insurance claim assessment.

Required Tools:

1. lookupPolicy(policyId)
2. calculateBenefit(policyId, claimType, amount)
3. verifyDocument(documentId)
4. checkMedicalNecessity(diagnosis, procedures)

Workflow:

1. Verify documents
2. Lookup policy
3. Check medical necessity
4. Calculate benefits
5. Generate report

Required Report Sections:

- Document Review
- Policy Verification
- Medical Necessity
- Benefit Calculation
- Recommendation
- Policy Citations

Test Cases:

1. Approval
2. Rejection
3. Request More Info

Success Criteria:

- Correct assessment
- Tool call logging
- Policy citations
- No hallucination
