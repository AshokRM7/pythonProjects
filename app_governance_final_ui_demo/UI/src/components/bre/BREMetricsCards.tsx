/**
 * BRE Metrics Cards - Display stage-specific information dynamically (additive per stage)
 * - Stage 2 (BRE Portal Check):       Pending rules + certification history
 * - Stage 3 (Soft Review):            + Soft review comments, summary & recommendations
 * - Stage 4 (Certification Request):  + Certification request submitted info
 * - Stage 5 (Verify & Close):         + App owner response, close comments & evidence
 */

import React from 'react';
import { AlertCircle, CheckCircle, Clock, FileText, History, Shield, TrendingUp, AlertTriangle, Info, Send, MessageSquare, Lock, Mail, Calendar, User } from 'lucide-react';
import { BREWorkflowState, PendingRule, CertificationHistory, CertificationSubmission } from './types';

interface BREMetricsCardsProps {
  workflowState: BREWorkflowState | null;
  currentStage: number;
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'critical':
      return 'text-red-600 bg-red-100';
    case 'high':
      return 'text-orange-600 bg-orange-100';
    case 'medium':
      return 'text-yellow-600 bg-yellow-100';
    case 'low':
      return 'text-green-600 bg-green-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-100';
    case 'approved_with_conditions':
      return 'text-yellow-600 bg-yellow-100';
    case 'rejected':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const BREMetricsCards: React.FC<BREMetricsCardsProps> = ({ workflowState, currentStage }) => {
  if (!workflowState) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No workflow data available yet. Start the BRE process to see detailed information.</p>
      </div>
    );
  }

  // Default fallback: basic progress card (before stage 2)
  if (currentStage < 2 || !workflowState.ait_rules) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Workflow Progress</h3>
        </div>
        <p className="text-sm text-gray-600">Current Step: <span className="font-semibold">{workflowState.current_step}</span></p>
        <p className="text-sm text-gray-600 mt-2">
          Started: <span className="font-semibold">{new Date(workflowState.started_at).toLocaleString()}</span>
        </p>
      </div>
    );
  }

  // ── Data references ──────────────────────────────────────────────────────────
  const { ait_rules } = workflowState;
  const pendingRules = ait_rules.pending_rules || [];
  const history = ait_rules.certification_history || [];
  const review = workflowState.soft_review;
  const certSubmission: CertificationSubmission | undefined = workflowState.certification_submission;
  // Use structured certification_response (preferred) or backwards-compat app_owner_response
  const appOwnerResponse = workflowState.certification_response || workflowState.app_owner_response;
  const isCompleted = currentStage >= 6 || workflowState.completed_at;

  return (
    <div className="flex flex-col-reverse gap-8">

      {/* ══════════════════════════════════════════════════════════
          STAGE 2  —  BRE Portal Check: Pending Rules + History
         ══════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">AIT Number</p>
                <p className="text-xl font-bold text-gray-900">{ait_rules.ait_number}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-orange-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Rules</p>
                <p className="text-xl font-bold text-gray-900">{pendingRules.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-red-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">High / Critical</p>
                <p className="text-xl font-bold text-gray-900">
                  {pendingRules.filter(r => r.risk_level === 'high' || r.risk_level === 'critical').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-green-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <History className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Past Certifications</p>
                <p className="text-xl font-bold text-gray-900">{history.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Rules Table */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Pending Rules Requiring Certification
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rule ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rule Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Risk Level</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingRules.map((rule: PendingRule) => (
                  <tr key={rule.rule_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{rule.rule_id}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{rule.rule_name}</div>
                      <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                        {rule.rule_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${getRiskColor(rule.risk_level)}`}>
                        {rule.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="text-xs text-gray-600 space-y-1">
                        {rule.changes_from_last_et.map((change, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Certification History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-green-600" />
                Certification History
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {history.map((cert: CertificationHistory, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cert.certified_by}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(cert.certification_date).toLocaleDateString()} — {cert.rules_certified} rules certified
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${getStatusColor(cert.status)}`}>
                      {cert.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{cert.comments}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          STAGE 3  —  Soft Review Comments & Recommendations
         ══════════════════════════════════════════════════════════ */}
      {currentStage >= 3 && review && (
        <div className="space-y-6">
          {/* Section divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-indigo-200" />
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Soft Review</span>
            </div>
            <div className="flex-1 h-px bg-indigo-200" />
          </div>

          {/* Soft-review stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Rules Reviewed</p>
                  <p className="text-xl font-bold text-gray-900">{review.total_pending_rules}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border-2 border-red-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">High Risk Rules</p>
                  <p className="text-xl font-bold text-gray-900">{review.high_risk_rules}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border-2 border-green-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Recommendations</p>
                  <p className="text-xl font-bold text-gray-900">{review.recommendations.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Review Summary / Comments */}
          <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b-2 border-indigo-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Soft Review Comments
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 leading-relaxed">{review.review_summary}</p>
            </div>
          </div>

          {/* Changes Analysis */}
          <div className="bg-white rounded-xl border-2 border-yellow-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-b-2 border-yellow-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
                Changes Analysis
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 leading-relaxed">{review.changes_analysis}</p>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl border-2 border-green-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Recommendations
              </h3>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {review.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE 4  —  Certification Request Submitted
         ══════════════════════════════════════════════════════════ */}
      {currentStage >= 4 && (
        <div className="space-y-6">
          {/* Section divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-purple-200" />
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full">
              <Send className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Certification Request</span>
            </div>
            <div className="flex-1 h-px bg-purple-200" />
          </div>

          <div className="bg-white rounded-xl border-2 border-purple-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-purple-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600" />
                Certification Request Submitted to App Owner
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <p className="text-sm text-purple-900 font-medium">
                  Certification request has been dispatched to the app owner for AIT <span className="font-mono font-bold">{ait_rules.ait_number}</span>.
                </p>
              </div>

              {/* Rules sent for certification */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Rules Submitted for Certification:</p>
                <div className="flex flex-wrap gap-2">
                  {pendingRules.map(rule => (
                    <span key={rule.rule_id} className={`px-3 py-1 text-xs font-mono rounded-full border ${getRiskColor(rule.risk_level)} border-current`}>
                      {rule.rule_id}
                    </span>
                  ))}
                </div>
              </div>

              {/* Review outcome carried forward */}
              {review && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Soft Review Outcome Included:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span>{review.high_risk_rules} high-risk rule(s) flagged</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{review.recommendations.length} recommendation(s) attached</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 italic">
                  Awaiting app owner certification response. The workflow will proceed once the response is verified.
                </p>
              </div>
            </div>
          </div>

          {/* ── Submission Dispatch Details ── */}
          {certSubmission && (
            <div className="bg-white rounded-xl border-2 border-purple-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-b-2 border-purple-100">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-600" />
                  Submission Dispatch Details
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recipient */}
                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <User className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sent To</p>
                      <p className="text-sm font-semibold text-gray-900 break-all">{certSubmission.app_owner_email}</p>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <Calendar className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Submitted On</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(certSubmission.submission_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {/* Method */}
                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <Mail className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Dispatch Method</p>
                      <span className="text-sm font-bold text-purple-700 uppercase bg-purple-100 px-2 py-0.5 rounded-full">
                        {certSubmission.submission_method}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rules & AIT summary */}
                <div className="pt-3 border-t border-purple-100 flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>
                    <span className="font-semibold">{certSubmission.pending_rules?.length ?? pendingRules.length}</span> rule(s) included in the certification package for AIT{' '}
                    <span className="font-mono font-bold">{certSubmission.ait_number}</span>
                  </span>
                </div>

                {/* Soft review carry-forward summary inside submission */}
                {certSubmission.soft_review_results && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span>{certSubmission.soft_review_results.high_risk_rules} high-risk rule(s) flagged in review</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{certSubmission.soft_review_results.recommendations.length} recommendation(s) attached</span>
                    </div>
                  </div>
                )}

                {/* Awaiting status (only before response received) */}
                {!appOwnerResponse && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <Clock className="w-4 h-4 text-yellow-600 animate-pulse flex-shrink-0" />
                    <p className="text-sm text-yellow-800 font-medium">
                      Awaiting app owner response — click{' '}
                      <span className="font-bold">Verify &amp; Close</span> once the owner has certified.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE 5 / CLOSED  —  App Owner Response + Close Comments + Evidence
         ══════════════════════════════════════════════════════════ */}
      {currentStage >= 5 && appOwnerResponse && (
        <div className="space-y-6">
          {/* Section divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-green-300" />
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-300 rounded-full">
              <Lock className="w-4 h-4 text-green-700" />
              <span className="text-xs font-bold text-green-800 uppercase tracking-wide">
                {isCompleted ? 'Closed' : 'Verify & Close'}
              </span>
            </div>
            <div className="flex-1 h-px bg-green-300" />
          </div>

          {/* Certification Response Received Banner */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900">Certification Response Received</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Response from <span className="font-semibold">{appOwnerResponse.certified_by}</span> on{' '}
                {new Date(appOwnerResponse.certification_date).toLocaleString()} — Deliverable{' '}
                <span className="font-mono font-bold">{appOwnerResponse.deliverable_id}</span>
              </p>
            </div>
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase flex-shrink-0 ${
              appOwnerResponse.status === 'approved' ? 'bg-green-100 text-green-700' :
              appOwnerResponse.status === 'approved_with_conditions' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {appOwnerResponse.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* App Owner Response Card */}
          <div className={`bg-white rounded-xl border-2 shadow-lg overflow-hidden ${
            appOwnerResponse.status === 'approved' ? 'border-green-300' :
            appOwnerResponse.status === 'approved_with_conditions' ? 'border-yellow-300' :
            'border-red-300'
          }`}>
            <div className={`p-4 border-b-2 ${
              appOwnerResponse.status === 'approved' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
              appOwnerResponse.status === 'approved_with_conditions' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' :
              'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
            }`}>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {appOwnerResponse.status === 'approved' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                 appOwnerResponse.status === 'approved_with_conditions' ? <AlertCircle className="w-5 h-5 text-yellow-600" /> :
                 <AlertTriangle className="w-5 h-5 text-red-600" />}
                App Owner Certification Response
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Certification Status:</span>
                <span className={`px-4 py-2 text-sm font-bold rounded-full uppercase ${getStatusColor(appOwnerResponse.status)}`}>
                  {appOwnerResponse.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Certified By</p>
                  <p className="text-sm font-semibold text-gray-900">{appOwnerResponse.certified_by}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Certification Date</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(appOwnerResponse.certification_date).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">AIT Number</p>
                  <p className="text-sm font-semibold text-gray-900">{appOwnerResponse.ait_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Rules Certified</p>
                  <p className="text-sm font-semibold text-gray-900">{appOwnerResponse.rules_certified.length} rules</p>
                </div>
              </div>

              {/* Certified Rule IDs */}
              {appOwnerResponse.rules_certified.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Certified Rule IDs:</p>
                  <div className="flex flex-wrap gap-2">
                    {appOwnerResponse.rules_certified.map(ruleId => (
                      <span key={ruleId} className="px-3 py-1 text-xs font-mono bg-blue-100 text-blue-700 rounded-full">
                        {ruleId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* App Owner Comments */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  App Owner Comments:
                </p>
                <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 leading-relaxed">
                  {appOwnerResponse.comments}
                </p>
              </div>
            </div>
          </div>

          {/* Close Comments (shown when completed/closed) */}
          {isCompleted && (
            <div className="bg-white rounded-xl border-2 border-emerald-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b-2 border-emerald-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-700" />
                  Closure Summary
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Ticket Closed Successfully</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      All {appOwnerResponse.rules_certified.length} rule(s) for AIT <span className="font-mono font-bold">{appOwnerResponse.ait_number}</span> have been certified and the ticket has been closed.
                    </p>
                  </div>
                </div>
                {workflowState.completed_at && (
                  <p className="text-xs text-gray-500">
                    Completed at: <span className="font-semibold">{new Date(workflowState.completed_at).toLocaleString()}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Evidence */}
          {appOwnerResponse.screenshot_path && (
            <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  Evidence
                </h3>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Screenshot Evidence Attached</p>
                    <p className="text-xs text-blue-700 font-mono mt-1">{appOwnerResponse.screenshot_path}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
