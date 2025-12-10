import { useState } from 'react';
import { ArrowLeft, CheckCircle, Circle, Play } from 'lucide-react';
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
}

export function TicketWorkflow({ ticket, onBack, user, onLogout }: TicketWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: 1, title: 'Category Check', description: 'Verify ticket category is IAM', completed: false },
    { id: 2, title: 'SLA Verification', description: 'Check and prioritize based on SLA deadline', completed: false },
    { id: 3, title: 'AppHQ Lookup', description: 'Get app owner details using App ID', completed: false },
    { id: 4, title: 'Review & Assessment', description: 'Review ticket details and ARM tickets', completed: false },
    { id: 5, title: 'Send Email', description: 'Email app owners with deliverable details', completed: false },
    { id: 6, title: 'Collect Evidence', description: 'Gather completion evidence and documentation', completed: false },
    { id: 7, title: 'Close Ticket', description: 'Close ticket in RISE and JIRA with evidence', completed: false }
  ]);

  const handleStartWorkflow = () => {
    setWorkflowStarted(true);
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

    switch (currentStep) {
      case 0:
        return <CategoryCheck ticket={ticket} onComplete={handleStepComplete} />;
      case 1:
        return <SLAVerification ticket={ticket} onComplete={handleStepComplete} />;
      case 2:
        return <AppHQStep ticket={ticket} onComplete={handleStepComplete} />;
      case 3:
        return <ReviewAssessment ticket={ticket} onComplete={handleStepComplete} />;
      case 4:
        return <SendEmail ticket={ticket} onComplete={handleStepComplete} />;
      case 5:
        return <CollectEvidence ticket={ticket} onComplete={handleStepComplete} />;
      case 6:
        return <CloseTicket ticket={ticket} onComplete={handleStepComplete} onBack={onBack} />;
      default:
        return null;
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
                <button
                  onClick={handleStartWorkflow}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Play className="w-5 h-5" />
                  Start Ticket
                </button>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        index === currentStep
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
                          <Circle className={`w-5 h-5 ${index === currentStep ? 'text-blue-600' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${index === currentStep ? 'text-blue-900' : step.completed ? 'text-green-900' : 'text-gray-900'}`}>
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <h3 className="text-gray-900 mb-2">Ready to Process Ticket</h3>
                <p className="text-gray-600 mb-6">
                  Click "Start Ticket" to begin the IAM deliverable process flow. You will be guided through each step with verification checks.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <p className="text-sm text-blue-900 mb-2">This workflow will guide you through:</p>
                  <ul className="text-sm text-blue-800 space-y-1 ml-4">
                    <li>• Category verification (IAM check)</li>
                    <li>• SLA deadline assessment</li>
                    <li>• Application owner lookup via AppHQ</li>
                    <li>• Ticket review and ARM verification</li>
                    <li>• Email communication to stakeholders</li>
                    <li>• Evidence collection and documentation</li>
                    <li>• Ticket closure in RISE and JIRA</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}