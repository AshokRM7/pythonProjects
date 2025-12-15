import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, Circle, Play, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { Ticket } from '../App';
import { User as UserType } from '../App';
import { Header } from './Header';
import { Footer } from './Footer';
import { CategoryCheck } from './workflow-steps/CategoryCheck';
import { SLAVerification } from './workflow-steps/SLAVerification';
import { AppHQStep } from './workflow-steps/AppHQStep';
import { ReviewAssessment } from './workflow-steps/ReviewAssessment';
import { SendEmail } from './workflow-steps/SendEmail';
import { CollectEvidence } from './workflow-steps/CollectEvidence';
import { CloseTicket } from './workflow-steps/CloseTicket';
import { runAgent, getAgentStatus, AgentJob } from '../api/iam';

interface TicketWorkflowProps {
  ticket: Ticket;
  onBack: () => void;
  user: UserType;
  onLogout: () => void;
}

export interface WorkflowStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  active?: boolean;
}

export function TicketWorkflow({ ticket, onBack, user, onLogout }: TicketWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentJob, setAgentJob] = useState<AgentJob | null>(null);
  const [polling, setPolling] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 1, title: 'Category Check', description: 'Verify ticket category is IAM', completed: false },
    { id: 2, title: 'SLA Verification', description: 'Check and prioritize based on SLA deadline', completed: false },
    { id: 3, title: 'AppHQ Lookup', description: 'Get app owner details using App ID', completed: false },
    { id: 4, title: 'Review & Assessment', description: 'Review ticket details and ARM tickets', completed: false },
    { id: 5, title: 'Send Email', description: 'Email app owners with deliverable details', completed: false },
    { id: 6, title: 'Collect Evidence', description: 'Gather completion evidence and documentation', completed: false },
    { id: 7, title: 'Close Ticket', description: 'Close ticket in RISE and JIRA with evidence', completed: false }
  ]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  const handleStartManual = () => {
    setWorkflowStarted(true);
    setIsAgentMode(false);
  };

  const handleStartAgent = async () => {
    setWorkflowStarted(true);
    setIsAgentMode(true);
    try {
      const job = await runAgent(ticket.id);
      setAgentJob({ ...job, steps: [], status: 'pending' });
      startPolling(job.job_id);
    } catch (e) {
      console.error("Failed to start agent", e);
      alert("Failed to start agent. Check backend connection.");
      setWorkflowStarted(false);
    }
  };

  const startPolling = (jobId: string) => {
    setPolling(true);
    pollInterval.current = setInterval(async () => {
      try {
        const status = await getAgentStatus(jobId);
        setAgentJob(status);

        // Map agent steps to UI steps for visualization
        updateStepsFromAgent(status);

        if (status.status === 'completed' || status.status === 'failed') {
          setPolling(false);
          if (pollInterval.current) clearInterval(pollInterval.current);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 1500);
  };

  const updateStepsFromAgent = (job: AgentJob) => {
    // Simple heuristic mapping based on step counts or labels
    // 8 defined steps in Agent vs 7 UI steps. We can map loosely.
    // Agent steps: Fetch(0), Validate(1), Owners(2), RAG(3), Draft(4), Send(5), JIRA(6), RISE(7)

    // We'll mark UI steps completed based on how many agent steps are done.
    const stepsCount = job.steps.length;
    const newSteps = [...steps];

    // Mapping logic
    if (stepsCount >= 2) newSteps[0].completed = true; // Category
    if (stepsCount >= 2) newSteps[1].completed = true; // SLA (implicit in auto run)
    if (stepsCount >= 3) newSteps[2].completed = true; // AppHQ
    if (stepsCount >= 4) newSteps[3].completed = true; // Review (RAG)
    if (stepsCount >= 6) newSteps[4].completed = true; // Email (Draft+Send)
    if (stepsCount >= 7) newSteps[5].completed = true; // Evidence (JIRA update has evidence)
    if (stepsCount >= 8) newSteps[6].completed = true; // Close

    // Current active step logic
    let activeIdx = 0;
    while (activeIdx < newSteps.length && newSteps[activeIdx].completed) {
      activeIdx++;
    }
    setCurrentStep(Math.min(activeIdx, newSteps.length - 1));
    setSteps(newSteps);
  };

  const handleStepComplete = () => {
    const updatedSteps = [...steps];
    updatedSteps[currentStep].completed = true;
    setSteps(updatedSteps);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const renderStepContent = () => {
    if (!workflowStarted) return null;

    if (isAgentMode) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-gray-900 font-medium flex items-center gap-2">
              {polling ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
              AI Agent Orchestrator
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${agentJob?.status === 'running' ? 'bg-blue-100 text-blue-800' :
              agentJob?.status === 'completed' ? 'bg-green-100 text-green-800' :
                agentJob?.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
              }`}>
              {agentJob?.status || 'Ready'}
            </span>
          </div>

          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
            {agentJob?.steps.map((step, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="w-20 text-gray-400 text-xs text-right pt-0.5">
                  {new Date(step.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{step.label}</p>
                  <p className="text-gray-500">{step.detail}</p>
                </div>
              </div>
            ))}
            {agentJob?.steps.length === 0 && (
              <p className="text-gray-400 italic text-center py-4">Initializing agent...</p>
            )}
          </div>

          {agentJob?.email_body && (
            <div className="border rounded-lg p-4 bg-gray-50 mb-6">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Generated Email Draft</h4>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{agentJob.email_body}</pre>
            </div>
          )}

          {agentJob?.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-900 mb-1">Execution Complete</h4>
              <p className="text-sm text-green-800">{agentJob.final_summary}</p>
            </div>
          )}

          {agentJob?.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h4 className="text-sm font-semibold text-red-900">Execution Failed</h4>
              </div>
              <p className="text-sm text-red-800">{agentJob.error}</p>
            </div>
          )}
        </div>
      );
    }

    // Manual Mode
    switch (currentStep) {
      case 0: return <CategoryCheck ticket={ticket} onComplete={handleStepComplete} />;
      case 1: return <SLAVerification ticket={ticket} onComplete={handleStepComplete} />;
      case 2: return <AppHQStep ticket={ticket} onComplete={handleStepComplete} />;
      case 3: return <ReviewAssessment ticket={ticket} onComplete={handleStepComplete} />;
      case 4: return <SendEmail ticket={ticket} onComplete={handleStepComplete} />;
      case 5: return <CollectEvidence ticket={ticket} onComplete={handleStepComplete} />;
      case 6: return <CloseTicket ticket={ticket} onComplete={handleStepComplete} onBack={onBack} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} onLogout={onLogout} />

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-900 hover:text-blue-800 mb-6"
          style={{ color: '#012169' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="mb-2">{ticket.id}</h1>
              <h2 className="text-gray-900 mb-2">{ticket.title}</h2>
              <p className="text-gray-600">{ticket.description}</p>
            </div>
            <div className="text-right">
              <span className="text-gray-500 text-sm">App ID</span>
              <p className="text-gray-900">{ticket.appId}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <span className="text-gray-500 text-sm">Priority</span>
              <p className="text-gray-900">{ticket.priority}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Status</span>
              <p className="text-gray-900">{ticket.status}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">SLA Deadline</span>
              <p className="text-gray-900">{new Date(ticket.slaDeadline).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">JIRA Story</span>
              <p className="text-gray-900">{ticket.jiraStory}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-gray-900 mb-4">IAM Process Flow</h3>

              {!workflowStarted ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      console.log("Starting Manual Mode");
                      handleStartManual();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Play className="w-5 h-5 text-gray-500" />
                    Start Manual Process
                  </button>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase">OR</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>
                  <button
                    onClick={() => {
                      console.log("Starting Agent Mode");
                      handleStartAgent();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-all transform hover:scale-[1.02]"
                  >
                    <div className="relative">
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse border border-white"></div>
                      <Play className="w-5 h-5" />
                    </div>
                    Run AI Agent
                  </button>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Auto-completes workflow using GenAI & Enterprise integrations
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${index === currentStep && !isAgentMode
                        ? 'bg-blue-50 border border-blue-200'
                        : step.completed
                          ? 'bg-green-50'
                          : 'bg-gray-50'
                        }`}
                    >
                      <div className="mt-0.5">
                        {step.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className={`w-5 h-5 ${index === currentStep && !isAgentMode ? 'text-blue-600' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${index === currentStep && !isAgentMode ? 'text-blue-900' : step.completed ? 'text-green-900' : 'text-gray-900'}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {workflowStarted ? (
              renderStepContent()
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center h-full flex flex-col justify-center items-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                  <Play className="w-8 h-8 text-blue-600 ml-1" />
                </div>
                <h3 className="text-gray-900 mb-2 font-medium">Ready to Process Ticket</h3>
                <p className="text-gray-600 mb-6 max-w-md">
                  Choose "Run AI Agent" to automatically process this deliverable, or "Manual Process" to go through the steps yourself.
                </p>
              </div>
            )}
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}