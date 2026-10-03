import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Bot, User as UserIcon, Loader2, Sparkles, Crown, LogIn, Check, X, Undo2, CheckCircle2, History, Plus, Trash2 } from 'lucide-react';
import { InvokeLLMDetailed } from '@/lib/invokeLlm';
import { isGuestMode } from '@/lib/guestMode';
import ReactMarkdown from 'react-markdown';
import { User } from '@/entities/all';
import { getVisibleGeckos } from '@/lib/geckoAccess';
import { getFeatureUsage } from '@/lib/usageMeter';
import { getTierLimits } from '@/lib/tierLimits';
import { createPageUrl } from '@/utils';
import { ACTIONS, buildActionProtocolPrompt, parseAssistantAction } from '@/lib/assistantActions';
import { buildConsultantFacts, isPairingQuestion, isValueQuestion } from '@/lib/consultantContext';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { listConversations, loadConversation, saveConversation, deleteConversation } from '@/lib/consultantConversations';

/**
 * GeckoGenius AI, the breeder consultant chat. Originally read-only
 * advice; now it can also ACT on the user's collection through the
 * five-action registry in src/lib/assistantActions.js (log weights,
 * sheds, feedings, list what's due, search the collection).
 *
 * Flow: every user message consumes one 'assistant_message' credit
 * BEFORE the LLM call, and the server gives it back if the call fails.
 * For pairing and value questions the prompt carries the genetics
 * calculator's odds and the value table's prices (consultantContext.js),
 * so the answer matches those screens. Chats are saved per member. The model replies either with prose (rendered
 * as-is) or with a single JSON action block. Write actions render a
 * confirmation card and only execute on Confirm, with a one-tap Undo
 * after. Read actions run immediately since they change nothing.
 */

const BASE_SYSTEM_PROMPT = `You are a world-class expert on crested gecko (Correlophus ciliatus) genetics, breeding, and market trends. Your name is "GeckoGenius AI". Provide detailed, accurate, and helpful advice. When discussing genetics, use clear terms. When asked about potential pairings, list the likely visual outcomes and their approximate probabilities. If asked about value, provide a realistic price range in USD and explain the factors that influence it (e.g., structure, lineage, specific trait expression). When the prompt includes a FACTS FROM GECK INSPECT block, those odds and prices come from the app's genetics calculator and value table: use them exactly and do not contradict them. Without that block, say that odds and prices are rough and suggest the Genetics Calculator for exact odds. Always be encouraging and supportive. Format your answers clearly using markdown. Never use em dashes.`;

const GREETING = { id: 0, role: 'assistant', content: "Hello! I'm your AI Breeder Consultant. Ask me anything about crested gecko genetics, breeding strategies, morph combinations, or market values. I can also keep your records: tell me to \"log 14.5g for Luna\" or ask \"what eggs are due this week?\" and I'll take care of it. How can I help you today?" };

const SUGGESTION_CHIPS = [
    { label: 'What eggs are due this week?', send: 'What eggs are due this week?' },
    { label: 'Who is overdue for feeding?', send: 'Which feeding groups are overdue for feeding?' },
    { label: 'Log a shed for...', fill: 'Log a clean shed for ' },
    { label: 'Log a weight for...', fill: 'Log a weight for ' },
];

export default function BreederConsultantPage() {
    const [messages, setMessages] = useState([GREETING]);
    const [conversationId, setConversationId] = useState(null);
    const [pastChats, setPastChats] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const priceIndexRef = useRef(null);
    const saveTimerRef = useRef(null);
    const conversationIdRef = useRef(null);
    const dirtyRef = useRef(false);
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
                listConversations().then((rows) => { if (!cancelled) setPastChats(rows); }).catch(() => {});
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

    // Save the chat a moment after it changes (each answer, each confirmed
    // or cancelled action). Only chats with something the member asked.
    useEffect(() => {
        if (!user || isGuestMode()) return undefined;
        if (!messages.some((m) => m.role === 'user')) return undefined;
        if (isLoading || !dirtyRef.current) return undefined;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            dirtyRef.current = false;
            try {
                const id = await saveConversation({ id: conversationIdRef.current, messages });
                if (!conversationIdRef.current) {
                    conversationIdRef.current = id;
                    setConversationId(id);
                }
                listConversations().then(setPastChats).catch(() => {});
            } catch (error) {
                console.warn('Could not save chat:', error);
            }
        }, 800);
        return () => clearTimeout(saveTimerRef.current);
    }, [messages, isLoading, user]);

    const startNewChat = () => {
        clearTimeout(saveTimerRef.current);
        dirtyRef.current = false;
        undoRef.current = {};
        conversationIdRef.current = null;
        setConversationId(null);
        setMessages([GREETING]);
        setShowHistory(false);
        setGate(null);
    };

    const openChat = async (id) => {
        try {
            const row = await loadConversation(id);
            if (!row) return;
            clearTimeout(saveTimerRef.current);
            dirtyRef.current = false;
            undoRef.current = {};
            const restored = (row.messages || []).map((m) => ({ id: nextId(), role: m.role, content: m.content }));
            conversationIdRef.current = row.id;
            setConversationId(row.id);
            setMessages([GREETING, ...restored]);
            setShowHistory(false);
        } catch (error) {
            console.warn('Could not open chat:', error);
        }
    };

    const removeChat = async (id) => {
        try {
            await deleteConversation(id);
            setPastChats((rows) => rows.filter((r) => r.id !== id));
            if (conversationIdRef.current === id) startNewChat();
        } catch (error) {
            console.warn('Could not delete chat:', error);
        }
    };

    // Calculator odds and value-table prices for pairing and value
    // questions. The price table loads once, only when first needed.
    const factsFor = async (text) => {
        if (!isPairingQuestion(text) && !isValueQuestion(text)) return '';
        if (!priceIndexRef.current) {
            try {
                priceIndexRef.current = await loadTraitValueIndex();
            } catch {
                priceIndexRef.current = null;
            }
        }
        try {
            return buildConsultantFacts(text, { geckos, priceIndex: priceIndexRef.current });
        } catch (error) {
            console.warn('Consultant facts failed:', error);
            return '';
        }
    };

    const appendMessage = (msg) => {
        dirtyRef.current = true;
        setMessages(prev => [...prev, { id: nextId(), ...msg }]);
    };
    const updateMessage = (msgId, patch) => {
        dirtyRef.current = true;
        setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, ...patch } : m)));
    };

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

        // Metering happens inside the invoke-llm edge function now: one
        // assistant_message credit per call, with the allotment resolved
        // from the caller's real tier on the server. Guests never reach it.
        if (isGuestMode() || !user) {
            setGate({ type: 'guest' });
            return;
        }

        const priorMessages = messages;
        appendMessage({ role: 'user', content: text });
        setInput('');
        setIsLoading(true);

        try {
            const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${buildActionProtocolPrompt(geckos)}`;
            // Only the recent turns: the whole conversation went out every
            // time, and past the function's 40,000-character cap every
            // message failed until the page was reloaded.
            const conversationHistory = priorMessages.slice(-12).map(historyLine).join('\n\n');
            const facts = await factsFor(text);
            const factsBlock = facts ? `\n\n${facts}` : '';
            const fullPrompt = `${systemPrompt}\n\nHere is the conversation so far:\n${conversationHistory}${factsBlock}\n\n**User**: ${text}\n\n**GeckoGenius AI**:`;

            const { text: response, credits } = await InvokeLLMDetailed({ prompt: fullPrompt });
            if (credits?.remaining != null) setRemaining(credits.remaining);

            const parsed = parseAssistantAction(response);
            if (parsed) {
                await handleParsedAction(parsed);
            } else {
                appendMessage({ role: 'assistant', content: response });
            }
        } catch (error) {
            if (error?.code === 'credits_exhausted') {
                // The server's refusal carries no allowance, so fall back to
                // the plan's (it read "includes 0 messages" before).
                setGate({ type: 'exhausted', included: error.included ?? getTierLimits(user).monthlyAssistantMessages ?? null });
                return;
            }
            console.error("Error calling LLM:", error);
            if (error?.credits?.remaining != null) setRemaining(error.credits.remaining);
            appendMessage({
                role: 'assistant',
                content: error?.refunded
                    ? "I couldn't get an answer just now. That message was not counted, so please try again."
                    : "I'm sorry, I'm having trouble connecting right now. Please try again later.",
            });
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
            <Card className="flex-1 flex flex-col">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-700">
                    <CardTitle className="text-slate-100 flex items-center gap-2"><Sparkles className="text-emerald-400"/> AI Breeder Consultant</CardTitle>
                    {user && !isGuestMode() && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
                                <History className="w-4 h-4 mr-1" /> Past chats
                            </Button>
                            <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={startNewChat} disabled={isLoading}>
                                <Plus className="w-4 h-4 mr-1" /> New chat
                            </Button>
                        </div>
                    )}
                    {showHistory && (
                        <div className="w-full rounded-lg border border-slate-700 bg-slate-900/70 p-2 max-h-64 overflow-y-auto">
                            {pastChats.length === 0 ? (
                                <p className="text-sm text-slate-400 p-2">No saved chats yet. Chats save as you go.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {pastChats.map((c) => (
                                        <li key={c.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${c.id === conversationId ? 'bg-slate-800' : 'hover:bg-slate-800/60'}`}>
                                            <button type="button" onClick={() => openChat(c.id)} className="flex-1 min-w-0 text-left touch:min-h-11">
                                                <span className="block text-sm text-slate-200 truncate">{c.title}</span>
                                                <span className="block text-[11px] text-slate-500">{new Date(c.updated_date).toLocaleString()}</span>
                                            </button>
                                            <Button size="sm" variant="ghost" className="touch:min-w-11 text-slate-500 hover:text-red-300" onClick={() => removeChat(c.id)} aria-label={`Delete chat ${c.title}`}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 md:gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
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
                         <div className="flex items-start gap-3 md:gap-4">
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
                                    {gate.included != null && <>Your current plan includes {gate.included} assistant message{gate.included === 1 ? '' : 's'} per month. </>}
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
                                className="touch:min-h-11 text-xs px-3 py-1.5 rounded-full border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors disabled:opacity-50"
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
