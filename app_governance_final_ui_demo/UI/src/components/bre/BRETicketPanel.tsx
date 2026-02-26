/**
 * BRE Ticket Panel - Main component for BRE Rule Certification workflow
 * 
 * Features:
 * - Receives live updates via parent component's global WebSocket
 * - Stage-specific information cards (rules, history, reviews, app owner response)
 * - Action buttons: Run Process (stages 1-4), Verify & Close (stage 5), Reset
 * - Dynamic display based on current workflow stage
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Loader2, Bot, CheckCircle, AlertCircle, Clock, Shield } from 'lucide-react';
import { breApi } from './breApi';
import { BREMetricsCards } from './BREMetricsCards';
import { BREWorkflowState } from './types';

interface BRETicketPanelProps {
  ticket: any;
  onRefresh: () => void;
  workflowStateFromWS?: any; // Workflow state received from global WebSocket
}

export const BRETicketPanel: React.FC<BRETicketPanelProps> = ({ ticket, onRefresh, workflowStateFromWS }) => {
  const [workflowState, setWorkflowState] = useState<BREWorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);

  const actionHeaderRef = useRef<HTMLDivElement>(null);
  const lastAwaitingTicketId = useRef<string | null>(null);

  // Update workflowState when received from WebSocket (priority source)
  useEffect(() => {
    if (workflowStateFromWS) {
      setWorkflowState(workflowStateFromWS);
    }
  }, [workflowStateFromWS]);

  // Fetch workflow state ONLY on initial mount if we don't have WebSocket data
  useEffect(() => {
    if (ticket?.id && !workflowStateFromWS) {
      fetchWorkflowState();
    }
  }, [ticket?.id]);

  // Auto-scroll to action buttons when awaiting verification
  useEffect(() => {
    const isAwaiting = ticket.stages?.[4]?.status === 'completed' && ticket.stages?.[5]?.status === 'pending';
    if (isAwaiting && lastAwaitingTicketId.current !== ticket.id) {
      lastAwaitingTicketId.current = ticket.id;
      setTimeout(() => {
        actionHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [ticket.id, ticket.stages]);

  const fetchWorkflowState = async () => {
    try {
      const state = await breApi.getWorkflowStatus(ticket.id);
      // Only update if we don't have fresher WebSocket data
      if (state && !workflowStateFromWS) {
        setWorkflowState(state);
      }
    } catch (err) {
      console.error('Failed to fetch workflow state:', err);
    }
  };

  // Monitor workflow completion states to clear processing flags
  useEffect(() => {
    const currentStage = ticket?.currentStage || 0;
    const isComplete = ticket?.status === 'Closed' || ticket?.status === 'completed';
    
    // Clear processing flag when stages progress beyond initial
    if (currentStage >= 4 && isProcessing) {
      setIsProcessing(false);
    }
    
    // Clear verifying flag when complete
    if (isComplete && isVerifying) {
      setIsVerifying(false);
    }
  }, [ticket?.currentStage, ticket?.status]);

  const handleRunProcess = async () => {
    setLoading(true);
    setError(null);
    setIsProcessing(true);
    try {
      await breApi.processDeliverable(ticket.id);
      // Processing status updates will come via WebSocket
    } catch (err: any) {
      setError(err.message || 'Failed to start BRE process');
      setIsProcessing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClick = () => {
    setShowVerifyConfirm(true);
  };

  const handleVerifyConfirmed = async () => {
    setShowVerifyConfirm(false);
    setLoading(true);
    setError(null);
    setIsVerifying(true);
    try {
      await breApi.verifyAndClose(ticket.id, false);
      // Verification status updates will come via WebSocket
    } catch (err: any) {
      setError(err.message || 'Failed to verify and close');
      setIsVerifying(false);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCancelled = () => {
    setShowVerifyConfirm(false);
  };

  const handleReset = async () => {
    setLoading(true);
    setError(null);
    try {
      await breApi.resetTicket(ticket.id);
      setWorkflowState(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to reset ticket');
    } finally {
      setLoading(false);
    }
  };

  const currentStage = ticket.currentStage || 0;
  const isAwaitingVerification = currentStage >= 4 && ticket.stages?.[4]?.status === 'completed' && ticket.stages?.[5]?.status === 'pending';
  const isCompleted = ticket.status === 'Closed' || currentStage === 6;
  const canRunProcess = currentStage === 0 && !isProcessing;
  const canVerify = isAwaitingVerification && !isVerifying;

  return (
    <>
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
      {/* Action Header */}
      <div
        ref={actionHeaderRef}
        className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl transition-all duration-1000 ${
          isAwaitingVerification
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-lg scale-[1.02]'
            : isCompleted
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300'
            : 'bg-white border-2 border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunProcess}
            disabled={loading || !canRunProcess || isProcessing}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
              isCompleted
                ? 'bg-green-100 text-green-700 cursor-default'
                : canRunProcess
                ? 'bg-[#012169] text-white hover:bg-[#00174F] active:scale-95 disabled:opacity-50'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Completed
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run BRE Process
              </>
            )}
          </button>

          {/* Verify & Close Button */}
          {(canVerify || isVerifying) && (
            <button
              onClick={handleVerifyClick}
              disabled={loading || !canVerify || isVerifying}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
                isVerifying
                  ? 'bg-blue-400 text-white'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 animate-pulse'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Verify & Close Ticket
                </>
              )}
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Status Info */}
        <div className="flex items-center gap-3">
          {isAwaitingVerification && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 animate-pulse" />
              <span className="text-sm font-semibold text-blue-800">
                Awaiting App Owner Response Verification
              </span>
            </div>
          )}
          {isProcessing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-sm font-semibold text-blue-800">Processing...</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-green-800">Workflow Complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 font-semibold">{error}</p>
          </div>
        </div>
      )}

      {/* Workflow Stage Visual Tracker */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          BRE Certification Workflow Stages (6 Steps)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {ticket.stages?.map((stage: any, idx: number) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border-2 transition-all ${
                stage.status === 'completed'
                  ? 'bg-green-50 border-green-300'
                  : stage.status === 'in-progress' || stage.status === 'running'
                  ? 'bg-blue-50 border-blue-300 animate-pulse'
                  : stage.status === 'awaiting_confirmation'
                  ? 'bg-yellow-50 border-yellow-300'
                  : stage.status === 'error'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {stage.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : stage.status === 'in-progress' || stage.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : stage.status === 'awaiting_confirmation' ? (
                  <Clock className="w-4 h-4 text-yellow-600" />
                ) : stage.status === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs font-bold text-gray-700">{stage.id + 1}</span>
              </div>
              <p className="text-xs font-semibold text-gray-800 leading-tight">{stage.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stage-Specific Information Cards */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Detailed Information
        </h3>
        <BREMetricsCards workflowState={workflowState} currentStage={currentStage} />
      </div>

      {/* Workflow Log (Optional - for debugging/detailed tracking) */}
      {workflowState && workflowState.workflow_log && workflowState.workflow_log.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Workflow Activity Log</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workflowState.workflow_log.slice().reverse().map((log, idx) => (
              <div key={idx} className="text-xs p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-600">{log.step}</span>
                  <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-gray-700">{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

      {/* Verify & Close Confirmation Dialog */}
      {showVerifyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-200 p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Confirm Verification</h2>
            </div>
            <p className="text-gray-600 mb-2">
              You are about to verify the app owner response and close ticket <span className="font-semibold text-gray-900">{ticket.id}</span>.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This will trigger the final certification closure process. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleVerifyCancelled}
                className="px-5 py-2.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyConfirmed}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
              >
                <CheckCircle className="w-4 h-4" />
                Yes, Verify & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
