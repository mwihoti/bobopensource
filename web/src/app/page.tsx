'use client';

import { useState } from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { Terminal, Search, BookOpen, GitFork, ClipboardList, Loader2, CheckCircle2, AlertCircle, MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const [issueUrl, setIssueUrl] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('insights');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; evidence?: string[]; followUps?: string[] }>>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [analysisId, setAnalysisId] = useState<number | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) {
      setError('Authentication is still loading. Try again in a moment.');
      return;
    }

    if (!isSignedIn) {
      setError('Please sign in with GitHub before starting an analysis.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setChatMessages([]);
    setQuestion('');
    setAnalysisId(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl, repoPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze');
      }

      setResult(data);
      setAnalysisId(data.analysisId ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const askBob = async (text: string) => {
    if (!result || !text.trim()) return;
    if (!isLoaded) {
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Authentication is still loading. Try again in a moment.',
        },
      ]);
      return;
    }

    if (!isSignedIn) {
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Please sign in with GitHub before using Ask Bob.',
        },
      ]);
      return;
    }

    const nextUserMessage = { role: 'user' as const, content: text.trim() };
    const history = [...chatMessages, nextUserMessage];

    setChatMessages(history);
    setQuestion('');
    setIsAsking(true);

    try {
      const response = await fetch('/api/ask-bob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text.trim(),
          context: {
            issueInfo: result.issueInfo,
            repoInfo: result.repoInfo,
            plan: result.plan,
          },
          history,
          analysisId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to ask Bob');
      }

      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.answer,
          evidence: data.evidence || [],
          followUps: data.followUps || [],
        },
      ]);
    } catch (err: any) {
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: err.message || 'Bob could not answer that question.',
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/20">
              B
            </div>
            <h1 className="text-xl font-bold tracking-tight">Bob<span className="text-blue-500">OpenSource</span></h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> System Ready</span>
            {isSignedIn ? <UserButton /> : null}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Input Section */}
        <section className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Accelerate Your Contributions
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Enter a GitHub issue URL to get a comprehensive implementation plan and dependency analysis.
          </p>
          <div className="mb-8 flex items-center justify-center gap-3 text-sm text-gray-400">
            {isSignedIn ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-green-300">
                <CheckCircle2 size={16} />
                Signed in. New analyses and Ask Bob replies will be saved to Neon.
              </span>
            ) : (
              <>
                <span>Login with GitHub through Clerk so analyses and Ask Bob replies are saved to Neon.</span>
                <SignInButton mode="redirect" forceRedirectUrl="/">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 transition-colors"
                  >
                    Login
                  </button>
                </SignInButton>
              </>
            )}
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="https://github.com/owner/repo/issues/123"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-lg"
                required
              />
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Local Repository Path (Optional)"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                className="flex-1 bg-[#141414] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-blue-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={isAnalyzing || !isLoaded}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Terminal size={20} />}
                {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
              </button>
            </div>
          </form>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {analysisId && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-300">
                  Analysis saved to Neon with record ID <span className="font-mono">{analysisId}</span>.
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Issue Complexity" value={result.issueInfo.complexity} icon={<AlertCircle size={20} className="text-orange-500" />} />
                <StatCard label="Suggested Files" value={`${result.plan.recommendedStartingPoints.length} ${result.plan.recommendedStartingPoints.length === 1 ? 'file' : 'files'}`} icon={<GitFork size={20} className="text-blue-500" />} />
                <StatCard label="Estimated Effort" value={`${result.plan.estimatedHours}h`} icon={<Loader2 size={20} className="text-green-500" />} />
                <StatCard label="Total Steps" value={result.plan.steps.length} icon={<ClipboardList size={20} className="text-purple-500" />} />
              </div>

              {/* Main Content Tabs */}
              <div className="bg-[#0d0d0d] border border-white/5 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="flex border-b border-white/5 bg-[#141414]/50">
                  <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<BookOpen size={18} />} label="Insights" />
                  <TabButton active={activeTab === 'dependencies'} onClick={() => setActiveTab('dependencies')} icon={<GitFork size={18} />} label="Dependencies" />
                  <TabButton active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} icon={<ClipboardList size={18} />} label="Implementation Plan" />
                  <TabButton active={activeTab === 'ask-bob'} onClick={() => setActiveTab('ask-bob')} icon={<MessageSquare size={18} />} label="Ask Bob" />
                </div>

                <div className="p-8 flex-1">
                  {activeTab === 'insights' && <InsightsView issue={result.issueInfo} repo={result.repoInfo} plan={result.plan} />}
                  {activeTab === 'dependencies' && <DependenciesView map={result.dependencyMap} />}
                  {activeTab === 'plan' && <PlanView plan={result.plan} />}
                  {activeTab === 'ask-bob' && (
                    <AskBobView
                      issue={result.issueInfo}
                      plan={result.plan}
                      messages={chatMessages}
                      question={question}
                      isAsking={isAsking}
                      onQuestionChange={setQuestion}
                      onAsk={askBob}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12 text-center text-gray-500 text-sm">
        Built for Developers • BobOpenSource v1.0.0
      </footer>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d0d] border border-white/5 p-6 rounded-2xl hover:border-white/10 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold capitalize">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${
        active ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
      {active && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
    </button>
  );
}

function InsightsView({ issue, repo, plan }: { issue: any, repo: any, plan: any }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="text-blue-500" />
          Project Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/5 p-6 rounded-xl border border-white/5">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Repository Context</h4>
            <ul className="space-y-3">
              {plan.projectOverview.map((item: string, i: number) => (
                <li key={i} className="flex gap-3 text-gray-300">
                  <span className="text-blue-500 font-bold">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/5 p-6 rounded-xl border border-white/5">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Where To Start</h4>
            <ul className="space-y-3">
              {plan.recommendedStartingPoints.map((item: any, i: number) => (
                <li key={i} className="text-gray-300">
                  <div className="font-mono text-blue-400 text-sm">{item.path}</div>
                  <div className="text-sm text-gray-400">{item.reason}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {plan.projectActionGuide?.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Terminal className="text-blue-500" />
            Project Action Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plan.projectActionGuide.map((section: any, i: number) => (
              <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">{section.title}</h4>
                <ul className="space-y-3">
                  {section.actions.map((action: string, j: number) => (
                    <li key={j} className="flex gap-3 text-gray-300">
                      <span className="text-blue-500 font-bold">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.evidence?.length > 0 && (
        <div className="bg-white/5 p-6 rounded-xl border border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Bob Evidence</h4>
          <ul className="space-y-3">
            {plan.evidence.map((item: any, i: number) => (
              <li key={i} className="flex gap-3 text-gray-300">
                <span className="text-blue-500 font-bold">•</span>
                <div>
                  <div className="font-medium text-gray-200">{item.label}</div>
                  <div className="text-sm text-gray-500">{item.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <CheckCircle2 className="text-blue-500" />
          Requirements Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/5 p-6 rounded-xl border border-white/5">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Core Requirements</h4>
            <ul className="space-y-3">
              {issue.requirements.map((req: string, i: number) => (
                <li key={i} className="flex gap-3 text-gray-300">
                  <span className="text-blue-500 font-bold">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/5 p-6 rounded-xl border border-white/5">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Acceptance Criteria</h4>
            <ul className="space-y-3">
              {issue.acceptanceCriteria.map((ac: string, i: number) => (
                <li key={i} className="flex gap-3 text-gray-300">
                  <CheckCircle2 size={16} className="text-green-500 mt-1 flex-shrink-0" />
                  {ac}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {issue.discussionHighlights?.length > 0 && (
        <div className="bg-white/5 p-6 rounded-xl border border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Discussion Highlights</h4>
          <ul className="space-y-3">
            {issue.discussionHighlights.map((item: string, i: number) => (
              <li key={i} className="flex gap-3 text-gray-300">
                <span className="text-blue-500 font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DependenciesView({ map }: { map: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <GitFork className="text-blue-500" />
        Impacted Components
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {map.nodes.map((node: any, i: number) => (
          <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-all">
            <div>
              <div className="font-mono text-blue-400 text-sm mb-1">{node.path}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500 uppercase font-bold tracking-widest">
                <span>{node.type}</span>
                <span>•</span>
                <span>Complexity: {node.complexity}</span>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${
              node.changeImpact === 'critical' ? 'bg-red-500/20 text-red-400' :
              node.changeImpact === 'high' ? 'bg-orange-500/20 text-orange-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {node.changeImpact} Impact
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanView({ plan }: { plan: any }) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const totalSteps = plan.steps.length || 1;
  const completedCount = completedSteps.length;
  const progress = Math.round((completedCount / totalSteps) * 100);
  const currentStep = plan.steps.find((step: any) => !completedSteps.includes(step.number));

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((current: number[]) =>
      current.includes(stepNumber)
        ? current.filter((value) => value !== stepNumber)
        : [...current, stepNumber].sort((a, b) => a - b)
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <ClipboardList className="text-blue-500" />
        Implementation Roadmap
      </h3>

      <div className="mb-10 bg-white/5 p-6 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Progress Tracker</h4>
            <p className="text-sm text-gray-500 mt-1">
              {completedCount} of {totalSteps} steps complete
              {currentStep ? ` • Step ${currentStep.number} in progress` : ' • All steps complete'}
            </p>
          </div>
          <div className="text-2xl font-bold text-blue-400">{progress}%</div>
        </div>
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {plan.steps.map((step: any) => {
            const status = completedSteps.includes(step.number)
              ? 'done'
              : currentStep?.number === step.number
                ? 'in progress'
                : 'pending';
            return (
              <div key={step.number} className="bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-200">Step {step.number}</span>
                  <span className={`text-xs uppercase tracking-wider ${
                    status === 'done' ? 'text-green-400' : status === 'in progress' ? 'text-blue-400' : 'text-gray-500'
                  }`}>
                    {status}
                  </span>
                </div>
                <div className="text-sm text-gray-400">{step.title}</div>
                <div className="text-xs text-gray-500 mt-1">{step.estimatedMinutes} min</div>
              </div>
            );
          })}
        </div>
      </div>

      {plan.suggestedCodeChanges?.length > 0 && (
        <div className="mb-10 bg-white/5 p-6 rounded-2xl border border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Suggested Code Changes</h4>
          <ul className="space-y-3">
            {plan.suggestedCodeChanges.map((item: string, i: number) => (
              <li key={i} className="flex gap-3 text-gray-300">
                <span className="text-blue-500 font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.riskSummary && (
        <div className="mb-10 bg-white/5 p-6 rounded-2xl border border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Risk Level</h4>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${riskBadgeClass(plan.riskSummary.level)}`}>
                Risk: {plan.riskSummary.level}
              </div>
              <p className="text-sm text-gray-400 mt-3">Reason: {plan.riskSummary.reason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-12 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
        {plan.steps.map((step: any, i: number) => (
          <div key={i} className="relative pl-12">
            <div className="absolute left-0 top-0 w-10 h-10 bg-[#0a0a0a] border border-blue-500/50 rounded-full flex items-center justify-center font-bold text-blue-500 shadow-lg shadow-blue-500/20 z-10">
              {step.number}
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold">{step.title}</h4>
                <div className="text-xs text-gray-500 font-mono uppercase bg-white/5 px-3 py-1 rounded-lg">
                  {step.estimatedMinutes} min
                </div>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">{step.description}</p>
              
              <div className="space-y-4">
                <h5 className="text-xs font-bold uppercase tracking-widest text-blue-500">Required Actions</h5>
                <ul className="space-y-2">
                  {step.actions.map((action: string, j: number) => (
                    <li key={j} className="flex gap-3 text-sm text-gray-300">
                      <div className="w-5 h-5 border border-white/20 rounded mt-0.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              {step.resources?.length > 0 && (
                <div className="mt-8 space-y-5">
                  {step.resources.map((resource: any, j: number) => (
                    <div key={j} className="bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-200">{resource.title}</div>
                          {resource.description && <div className="text-xs text-gray-500 mt-1">{resource.description}</div>}
                        </div>
                        {resource.path && <div className="text-xs font-mono text-blue-400">{resource.path}</div>}
                      </div>
                      {resource.confidence !== undefined && (
                        <div className="px-4 py-3 border-b border-white/5 bg-blue-500/5">
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="inline-flex px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 font-semibold">
                              Insertion Point Confidence: {Math.round(resource.confidence * 100)}%
                            </span>
                            {resource.reason && <span className="text-gray-400">Reason: {resource.reason}</span>}
                          </div>
                        </div>
                      )}
                      <pre className="p-4 text-sm overflow-x-auto text-gray-300 whitespace-pre-wrap">
                        <code>{resource.content}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {step.files.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Affected Files</h5>
                  <div className="flex flex-wrap gap-2">
                    {step.files.map((file: string, j: number) => (
                      <span key={j} className="text-xs font-mono bg-white/5 px-3 py-1.5 rounded-md text-blue-300 border border-white/5">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-white/5">
                <h5 className="text-xs font-bold uppercase tracking-widest text-green-500 mb-3">Step Validation — Bob Checks Your Work</h5>
                <ul className="space-y-2">
                  {step.validationCriteria.map((criteria: string, j: number) => (
                    <li key={j} className="flex gap-3 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {criteria}
                    </li>
                  ))}
                </ul>
              </div>

              {step.pitfalls?.length > 0 && (
                <div className="mt-6">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-3">Common Pitfalls</h5>
                  <ul className="space-y-2">
                    {step.pitfalls.map((pitfall: string, j: number) => (
                      <li key={j} className="flex gap-3 text-sm text-gray-300">
                        <AlertCircle size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                        {pitfall}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-4">
                <div className="text-xs text-gray-500">
                  Status:
                  <span className={`ml-2 uppercase tracking-wider ${
                    completedSteps.includes(step.number)
                      ? 'text-green-400'
                      : currentStep?.number === step.number
                        ? 'text-blue-400'
                        : 'text-gray-500'
                  }`}>
                    {completedSteps.includes(step.number) ? 'done' : currentStep?.number === step.number ? 'in progress' : 'pending'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleStep(step.number)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    completedSteps.includes(step.number)
                      ? 'bg-green-500/15 text-green-300 border border-green-500/20'
                      : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                  }`}
                >
                  {completedSteps.includes(step.number) ? 'Mark Pending' : 'Mark Complete'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plan.prDraft && (
        <div className="mt-10 bg-white/5 p-6 rounded-2xl border border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">PR Draft</h4>
          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Title</div>
              <div className="text-lg font-semibold text-gray-100">{plan.prDraft.title}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Summary</div>
              <ul className="space-y-2">
                {plan.prDraft.summary.map((item: string, i: number) => (
                  <li key={i} className="flex gap-3 text-gray-300">
                    <span className="text-blue-500 font-bold">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Tests</div>
              <ul className="space-y-2">
                {plan.prDraft.tests.map((item: string, i: number) => (
                  <li key={i} className="flex gap-3 text-gray-300">
                    <span className="text-blue-500 font-bold">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function riskBadgeClass(level: string) {
  switch (level) {
    case 'critical':
      return 'bg-red-500/20 text-red-400';
    case 'high':
      return 'bg-orange-500/20 text-orange-400';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-300';
    default:
      return 'bg-green-500/20 text-green-400';
  }
}

function AskBobView({
  issue,
  plan,
  messages,
  question,
  isAsking,
  onQuestionChange,
  onAsk,
}: {
  issue: any;
  plan: any;
  messages: Array<{ role: 'user' | 'assistant'; content: string; evidence?: string[]; followUps?: string[] }>;
  question: string;
  isAsking: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: (value: string) => Promise<void>;
}) {
  const quickPrompts = [
    'Which file should I change first?',
    'How should I test this issue?',
    'What should go in the PR?',
    'Do I need README changes for this?',
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
        <h3 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <MessageSquare className="text-blue-500" />
          Ask Bob
        </h3>
        <p className="text-gray-400 leading-relaxed">
          Ask follow-up questions about issue #{issue.number}, the suggested files, tests, commands, risk, or the PR draft. Bob answers using the analysis already generated for this project.
        </p>
      </div>

      <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Quick Prompts</h4>
        <div className="flex flex-wrap gap-3">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void onAsk(prompt)}
              className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 text-sm hover:bg-blue-500/15 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Conversation</h4>
        </div>
        <div className="p-6 space-y-5 max-h-[520px] overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-sm text-gray-500">
              Start with a question like “Which file should I change first?” or “How should I test this issue?”
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`rounded-2xl p-5 border ${message.role === 'user' ? 'bg-blue-500/10 border-blue-500/20 ml-10' : 'bg-white/5 border-white/5 mr-10'}`}>
              <div className="text-xs uppercase tracking-wider mb-3 text-gray-500">
                {message.role === 'user' ? 'You' : 'Bob'}
              </div>
              <div className="text-sm text-gray-200 whitespace-pre-wrap">{message.content}</div>
              {message.evidence && message.evidence.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Evidence</div>
                  <ul className="space-y-2">
                    {message.evidence.map((item, evidenceIndex) => (
                      <li key={evidenceIndex} className="flex gap-3 text-sm text-gray-400">
                        <span className="text-blue-500 font-bold">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {message.followUps && message.followUps.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Follow-up Ideas</div>
                  <div className="flex flex-wrap gap-2">
                    {message.followUps.map((item, followUpIndex) => (
                      <button
                        key={followUpIndex}
                        type="button"
                        onClick={() => void onAsk(item)}
                        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAsking && (
            <div className="rounded-2xl p-5 border bg-white/5 border-white/5 mr-10">
              <div className="text-xs uppercase tracking-wider mb-3 text-gray-500">Bob</div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                Thinking through your project context...
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onAsk(question);
          }}
          className="p-6 border-t border-white/5 bg-[#0d0d0d]"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="Ask Bob about files, tests, commands, docs, risk, or the PR..."
              className="flex-1 bg-[#141414] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-blue-500/50 transition-all"
            />
            <button
              type="submit"
              disabled={isAsking || !question.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl font-semibold flex items-center gap-2 transition-all"
            >
              {isAsking ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Ask
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Current issue objective: {issue.requirements?.[0] || issue.title}
          </div>
        </form>
      </div>

      <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">What Bob Can Help With</h4>
        <ul className="space-y-3 text-gray-300">
          <li className="flex gap-3"><span className="text-blue-500 font-bold">•</span>Which file to read or change first</li>
          <li className="flex gap-3"><span className="text-blue-500 font-bold">•</span>What code path to trace before editing</li>
          <li className="flex gap-3"><span className="text-blue-500 font-bold">•</span>How to test and validate the change</li>
          <li className="flex gap-3"><span className="text-blue-500 font-bold">•</span>Whether docs or README changes are likely needed</li>
          <li className="flex gap-3"><span className="text-blue-500 font-bold">•</span>What to put in the PR draft and validation steps</li>
          <li className="flex gap-3"><span className="text-blue-500 font-bold">•</span>Risk and likely side effects of the planned change</li>
        </ul>
      </div>
    </div>
  );
}
