"use client";

import type { PartialAssessmentReport } from "@/types/report";
import RecommendationBadge from "./RecommendationBadge";
import ReportSection from "./ReportSection";

function Pending({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs italic text-gray-400 animate-pulse">
        {label} — Pending…
      </p>
    </div>
  );
}

export default function AssessmentReportView({
  report,
}: {
  report: PartialAssessmentReport;
}) {
  const { sections } = report;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900">
            Assessment Report
          </h2>
          <span className="text-xs text-gray-400">
            {report.assessmentDate ?? "—"}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {report.patientName ?? "—"} ·{" "}
          {sections.policyVerification?.policyId ?? "—"}
        </p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">
          {report.claimId}
        </p>
      </div>

      {/* Recommendation */}
      {report.recommendation ? (
        <RecommendationBadge recommendation={report.recommendation} />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
          <span className="text-xs italic text-gray-400 animate-pulse">
            Assessing…
          </span>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {/* Document Review */}
        {sections.documentReview ? (
          <ReportSection title="Document Review" icon="📄">
            <p>{sections.documentReview.summary}</p>
            {sections.documentReview.findings.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {sections.documentReview.findings.map((f) => (
                  <div key={f.documentId} className="flex items-start gap-2">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        f.status === "valid" ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <span className="font-medium text-gray-700">
                        {f.documentId}
                      </span>
                      <span className="text-gray-400 ml-1 text-xs">
                        ({f.documentType.replace(/_/g, " ")})
                      </span>
                      <span
                        className={`ml-1.5 text-xs font-semibold ${
                          f.status === "valid"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {f.status}
                      </span>
                      {f.issues?.map((issue, i) => (
                        <p key={i} className="text-xs text-red-500 mt-0.5">
                          {issue}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportSection>
        ) : (
          <Pending label="Document Review" />
        )}

        {/* Policy Verification */}
        {sections.policyVerification ? (
          <ReportSection title="Policy Verification" icon="📋">
            <p>{sections.policyVerification.summary}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-400">Policy ID</span>
              <span className="font-mono font-medium">
                {sections.policyVerification.policyId}
              </span>
              <span className="text-gray-400">Holder</span>
              <span>{sections.policyVerification.holderName}</span>
              <span className="text-gray-400">Status</span>
              <span
                className={`font-semibold ${
                  sections.policyVerification.status === "active"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {sections.policyVerification.status}
              </span>
            </div>
          </ReportSection>
        ) : (
          <Pending label="Policy Verification" />
        )}

        {/* Medical Necessity */}
        {sections.medicalNecessity ? (
          <ReportSection title="Medical Necessity" icon="🏥">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  sections.medicalNecessity.necessary
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {sections.medicalNecessity.necessary
                  ? "Medically Necessary"
                  : "Not Medically Necessary"}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {sections.medicalNecessity.rationale}
            </p>
            {(sections.medicalNecessity.codes ?? []).length > 0 && (
              <div className="mt-1.5 flex gap-1 flex-wrap">
                {sections.medicalNecessity.codes!.map((code, i) => {
                  const label =
                    typeof code === "string"
                      ? code
                      : typeof code === "object" && code !== null
                        ? String(
                            (code as Record<string, unknown>).code ??
                              (code as Record<string, unknown>).name ??
                              JSON.stringify(code),
                          )
                        : String(code);
                  return (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
          </ReportSection>
        ) : (
          <Pending label="Medical Necessity" />
        )}

        {/* Benefit Calculation */}
        {sections.benefitCalculation ? (
          <ReportSection title="Benefit Calculation" icon="💰">
            <p className="mb-2">{sections.benefitCalculation.summary}</p>
            <div className="space-y-1">
              {(
                [
                  {
                    label: "Requested Amount",
                    value: sections.benefitCalculation.requestedAmount,
                    cls: "text-gray-700",
                  },
                  {
                    label: "Deductible Applied",
                    value: sections.benefitCalculation.deductibleApplied,
                    cls: "text-orange-600",
                  },
                  {
                    label: "Covered Amount",
                    value: sections.benefitCalculation.coveredAmount,
                    cls: "text-green-600 font-bold",
                  },
                  {
                    label: "Patient Responsibility",
                    value: sections.benefitCalculation.patientResponsibility,
                    cls: "text-red-600",
                  },
                ] as { label: string; value: number; cls: string }[]
              ).map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <span className={`font-semibold font-mono ${cls}`}>
                    ${value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ReportSection>
        ) : (
          <Pending label="Benefit Calculation" />
        )}

        {/* Recommendation Reasoning */}
        {sections.recommendation ? (
          <ReportSection title="Recommendation" icon="✅">
            <p>{sections.recommendation.reasoning}</p>
          </ReportSection>
        ) : (
          <Pending label="Recommendation" />
        )}

        {/* Policy Citations */}
        {sections.policyCitations && sections.policyCitations.length > 0 && (
          <ReportSection title="Policy Citations" icon="📎" defaultOpen={true}>
            <div className="space-y-2">
              {sections.policyCitations.map((citation, i) => (
                <div key={i} className="border-l-2 border-blue-200 pl-3">
                  <p className="text-xs font-semibold text-blue-600">
                    {citation.section}
                  </p>
                  <p className="text-xs text-gray-500 italic">
                    &ldquo;{citation.text}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </ReportSection>
        )}
      </div>
    </div>
  );
}
