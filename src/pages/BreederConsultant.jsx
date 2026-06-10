import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Bot, User as UserIcon, Loader2, Sparkles, Crown, LogIn, Check, X, Undo2, CheckCircle2 } from 'lucide-react';
import { InvokeLLM } from '@/integrations/Core';
import ReactMarkdown from 'react-markdown';
import { User } from '@/entities/all';
import { getVisibleGeckos } from '@/lib/geckoAccess';
import { consumeFeatureCredit, getFeatureUsage } from '@/lib/usageMeter';
import { getTierLimits } from '@/lib/tierLimits';
import { createPageUrl } from '@/utils';
import { ACTIONS, buildActionProtocolPrompt, parseAssistantAction } from '@/lib/assistantActions';

/**
 * GeckoGenius AI, the breeder consultant chat. Originally read-only
 * advice; now it can also ACT on the user's collection through the
 * five-action registry in src/lib/assistantActions.js (log weights,
 * sheds, feedings, list what's due, search the collection).
 *
 * Flow: every user message consumes one 'assistant_message' credit
 * BEFORE the LLM call. The model replies either with prose (rendered
 * as-is) or with a single JSON action block. Write actions render a
 * confirmation card and only execute on Confirm, with a one-tap Undo
 * after. Read actions run immediately since they change nothing.
 */

const BASE_SYSTEM_PROMPT = `You are a world-class expert on crested gecko (Correlophus ciliatus) genetics, breeding, and market trends. Your name is "GeckoGenius AI". Provide detailed, accurate, and helpful advice. When discussing genetics, use clear terms. When asked about potential pairings, list the likely visual outcomes and their approximate probabilities. If asked about value, provide a realistic price range in USD and explain the factors that influence it (e.g., structure, lineage, specific trait expression). Always be encouraging and supportive. Format your answers clearly using markdown.`;

const SUGGESTION_CHIPS = [
    { label: 'What eggs are due this week?', send: 'What eggs are due this week?' },
    { label: 'Who is overdue for feeding?', send: 'Which feeding groups are overdue for feeding?' },
    { label: 'Log a shed for...', fill: 'Log a clean shed for ' },
    { label: 'Log a weight for...', fill: 'Log a weight for ' },
];

export default function BreederConsultantPage() {
    const [messages, setMessages] = useState([
        { id: 0, role: 'assistant', content: "Hello! I'm your AI Breeder Consultant. Ask me anything about crested gecko genetics, breeding strategies, morph combinations, or market values. I can also keep your records: tell me to \"log 14.5g for Luna\" or ask \"what eggs are due this week?\" and I'll take care of it. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [geckos, setGeckos] = useState([]);
    const [remaining, setRemaining] = useState(null);
    const [gate, setGate] = useState(null); // null | { type: 'guest' } | { type: 'exhausted', included }
    const idRef = useRef(1);
    const undoRef = useRef({});
    const inputRef = useRef(null);

    const nextId = () => idRef.current++;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await User.me();
                if (cancelled || !me) return;
                setUser(me);
                const [collection, usage] = await Promise.all([
                    getVisibleGeckos(me, {}, '-created_date', 500).catch(() => []),
                    getFeatureUsage('assistant_message').catch(() => null),
                ]);
                if (cancelled) return;
                setGeckos(collection || []);
                if (usage && usage.remaining != null) {
                    setRemaining(usage.remaining);
                } else {
                    // No ledger row yet this month: the full allotment is left.
                    const included = getTierLimits(me).monthlyAssistantMessages;
                    if (included != null) setRemaining(included);
                }
            } catch {
                // Signed-out visitors can still read the page; sending is gated.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const appendMessage = (msg) => setMessages(prev => [...prev, { id: nextId(), ...msg }]);
    const updateMessage = (msgId, patch) =>
        setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, ...patch } : m)));

    const refreshGeckos = (currentUser) => {
        if (!currentUser) return;
        getVisibleGeckos(currentUser, {}, '-created_date', 500)
            .then(g => setGeckos(g || []))
            .catch(() => {});
    };

    const historyLine = (m) => {
        if (m.role === 'user') return `**User**: ${m.content}`;
        if (m.role === 'action') {
            return `**GeckoGenius AI**: ${m.say} [proposed action: ${m.describe}, status: ${m.status}]`;
        }
        return `**GeckoGenius AI**: ${m.content}`;
    };

    const handleParsedAction = async (parsed) => {
        const def = ACTIONS[parsed.name];
        const validation = def.validate(parsed.args, { geckos, user });
        if (!validation.ok) {
            appendMessage({ role: 'assistant', content: validation.message });
            return;
        }
        if (def.kind === 'read') {
            // Read actions change nothing, so they run without a confirm step.
            try {
                const result = await def.execute(validation.normalized, { geckos, user });
                const content = parsed.say ? `${parsed.say}\n\n${result.message}` : result.message;
                appendMessage({ role: 'assistant', content });
            } catch (error) {
                console.error('Read action failed:', error);
                appendMessage({ role: 'assistant', content: "I couldn't pull that up just now. Please try again in a moment." });
            }
            return;
        }
        // Write actions wait for an explicit Confirm.
        appendMessage({
            role: 'action',
            name: parsed.name,
            normalized: validation.normalized,
            describe: def.describe(validation.normalized),
            say: parsed.say || 'Here is what I am about to record. Just confirm below.',
            status: 'pending',
        });
    };

    const sendMessage = async (raw) => {
        const text = (raw ?? input).trim();
        if (!text || isLoading) return;
        setGate(null);

        // Metering: one credit per user message, consumed BEFORE the LLM call.
        let credit;
        try {
            credit = await consumeFeatureCredit('assistant_message', user);
        } catch (error) {
            console.error('Credit check failed:', error);
            appendMessage({ role: 'assistant', content: "I couldn't check your message allotment just now. Please try again in a moment." });
            return;
        }
        if (!credit.ok) {
            setGate(credit.guest ? { type: 'guest' } : { type: 'exhausted', included: credit.included });
            return;
        }
        if (credit.remaining != null) setRemaining(credit.remaining);

        const priorMessages = messages;
        appendMessage({ role: 'user', content: text });
        setInput('');
        setIsLoading(true);

        try {
            const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${buildActionProtocolPrompt(geckos)}`;
            const conversationHistory = priorMessages.map(historyLine).join('\n\n');
            const fullPrompt = `${systemPrompt}\n\nHere is the conversation so far:\n${conversationHistory}\n\n**User**: ${text}\n\n**GeckoGenius AI**:`;

            const response = await InvokeLLM({ prompt: fullPrompt });

            const parsed = parseAssistantAction(response);
            if (parsed) {
                await handleParsedAction(parsed);
            } else {
                appendMessage({ role: 'assistant', content: response });
            }
        } catch (error) {
            console.error("Error calling LLM:", error);
            appendMessage({ role: 'assistant', content: "I'm sorry, I'm having trouble connecting right now. Please try again later." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        sendMessage();
    };

    const handleConfirmAction = async (msg) => {
        updateMessage(msg.id, { status: 'working' });
        try {
            const def = ACTIONS[msg.name];
            const result = await def.execute(msg.normalized, { geckos, user });
            if (result.undo) undoRef.current[msg.id] = result.undo;
            updateMessage(msg.id, { status: 'done', resultMessage: result.message, undoable: !!result.undo });
            refreshGeckos(user);
        } catch (error) {
            console.error('Action failed:', error);
            updateMessage(msg.id, { status: 'error', resultMessage: "That didn't save. Please try again in a moment." });
        }
    };

    const handleCancelAction = (msg) => updateMessage(msg.id, { status: 'cancelled' });

    const handleUndoAction = async (msg) => {
        const undo = undoRef.current[msg.id];
        if (!undo) return;
        updateMessage(msg.id, { status: 'working' });
        try {
            await undo();
            delete undoRef.current[msg.id];
            updateMessage(msg.id, { status: 'undone', undoable: false });
            refreshGeckos(user);
        } catch (error) {
            console.error('Undo failed:', error);
            updateMessage(msg.id, {
                status: 'done',
                resultMessage: `${msg.resultMessage} (Undo failed, you can remove the record from the gecko's page.)`,
            });
        }
    };

    const handleChip = (chip) => {
        if (chip.send) {
            sendMessage(chip.send);
        } else {
            setInput(chip.fill);
            inputRef.current?.focus();
        }
    };

    const renderActionCard = (msg) => (
        <div className="space-y-3">
            <ReactMarkdown className="prose prose-sm prose-invert max-w-none">{msg.say}</ReactMarkdown>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-emerald-200 text-sm font-medium">{msg.describe}</p>
                {msg.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleConfirmAction(msg)} className="bg-emerald-600 hover:bg-emerald-700">
                            <Check className="w-4 h-4 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCancelAction(msg)} className="border-slate-600 text-slate-300">
                            <X className="w-4 h-4 mr-1" /> Cancel
                        </Button>
                    </div>
                )}
                {msg.status === 'working' && (
                    <div className="flex items-center gap-2 mt-3 text-slate-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Working on it...
                    </div>
                )}
                {msg.status === 'done' && (
                    <div className="mt-3 space-y-2">
                        <div className="flex items-start gap-2 text-sm text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <ReactMarkdown className="prose prose-sm prose-invert max-w-none">{msg.resultMessage || 'Done.'}</ReactMarkdown>
                        </div>
                        {msg.undoable && (
                            <Button size="sm" variant="ghost" onClick={() => handleUndoAction(msg)} className="text-slate-400 hover:text-slate-200 h-7 px-2">
                                <Undo2 className="w-3.5 h-3.5 mr-1" /> Undo
                            </Button>
                        )}
                    </div>
                )}
                {msg.status === 'cancelled' && (
                    <p className="text-slate-400 text-sm mt-3">Cancelled. Nothing was saved.</p>
                )}
                {msg.status === 'undone' && (
                    <p className="text-slate-400 text-sm mt-3">Undone. The record was removed.</p>
                )}
                {msg.status === 'error' && (
                    <p className="text-red-400 text-sm mt-3">{msg.resultMessage}</p>
                )}
            </div>
        </div>
    );

    const inputBlocked = isLoading || gate?.type === 'exhausted';

    return (
        <div className="flex flex-col h-full bg-slate-950 p-4">
            <Card className="flex-1 flex flex-col bg-slate-900 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700">
                    <CardTitle className="text-slate-100 flex items-center gap-2"><Sparkles className="text-emerald-400"/> AI Breeder Consultant</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role !== 'user' && (
                                <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-5 h-5 text-emerald-400" />
                                </div>
                            )}
                            <div className={`max-w-xl p-4 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                {msg.role === 'action'
                                    ? renderActionCard(msg)
                                    : <ReactMarkdown className="prose prose-sm prose-invert max-w-none">{msg.content}</ReactMarkdown>}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                    <UserIcon className="w-5 h-5 text-slate-300" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-5 h-5 text-emerald-400" />
                            </div>
                             <div className="max-w-xl p-4 rounded-lg bg-slate-800 text-slate-300 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Thinking...
                             </div>
                         </div>
                    )}
                </CardContent>
                <div className="border-t border-slate-700 p-4">
                    {gate?.type === 'exhausted' && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3 mb-3">
                            <Crown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <p className="text-amber-200 font-medium">You have used all of this month&apos;s assistant messages.</p>
                                <p className="text-slate-300 text-xs mt-1">
                                    Your current plan includes {gate.included ?? 0} assistant message{gate.included === 1 ? '' : 's'} per month.
                                    Upgrade for a bigger monthly allotment.
                                </p>
                                <Link to={createPageUrl('Membership')} className="inline-block mt-2">
                                    <Button size="sm">View plans</Button>
                                </Link>
                            </div>
                        </div>
                    )}
                    {gate?.type === 'guest' && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-3 mb-3">
                            <LogIn className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <p className="text-emerald-200 font-medium">Sign in to chat with GeckoGenius</p>
                                <p className="text-slate-300 text-xs mt-1">
                                    The assistant needs an account so it can find your geckos and track your monthly message allotment.
                                </p>
                                <Link to={createPageUrl('AuthPortal')} className="inline-block mt-2">
                                    <Button size="sm">Sign in</Button>
                                </Link>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {SUGGESTION_CHIPS.map((chip) => (
                            <button
                                key={chip.label}
                                type="button"
                                onClick={() => handleChip(chip)}
                                disabled={inputBlocked}
                                className="text-xs px-3 py-1.5 rounded-full border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-50"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about morphs, or say 'log 14.5g for Luna'..."
                            className="bg-slate-800 border-slate-600 text-slate-100"
                            disabled={inputBlocked}
                        />
                        <Button type="submit" disabled={inputBlocked}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                    {remaining != null && gate?.type !== 'exhausted' && (
                        <p className="text-xs text-slate-500 mt-2">
                            {remaining} assistant message{remaining === 1 ? '' : 's'} left this month
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}
