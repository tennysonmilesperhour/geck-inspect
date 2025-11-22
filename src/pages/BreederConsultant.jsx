import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { InvokeLLM } from '@/integrations/Core';
import ReactMarkdown from 'react-markdown';

export default function BreederConsultantPage() {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hello! I'm your AI Breeder Consultant. Ask me anything about crested gecko genetics, breeding strategies, morph combinations, or market values. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const systemPrompt = `You are a world-class expert on crested gecko (Correlophus ciliatus) genetics, breeding, and market trends. Your name is "GeckoGenius AI". Provide detailed, accurate, and helpful advice. When discussing genetics, use clear terms. When asked about potential pairings, list the likely visual outcomes and their approximate probabilities. If asked about value, provide a realistic price range in USD and explain the factors that influence it (e.g., structure, lineage, specific trait expression). Always be encouraging and supportive. Format your answers clearly using markdown.`;
            
            const conversationHistory = messages.map(m => `**${m.role === 'user' ? 'User' : 'GeckoGenius AI'}**: ${m.content}`).join('\n\n');
            const fullPrompt = `${systemPrompt}\n\nHere is the conversation so far:\n${conversationHistory}\n\n**User**: ${input}\n\n**GeckoGenius AI**:`;

            const response = await InvokeLLM({
                prompt: fullPrompt,
            });

            const assistantMessage = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Error calling LLM:", error);
            const errorMessage = { role: 'assistant', content: "I'm sorry, I'm having trouble connecting right now. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 p-4">
            <Card className="flex-1 flex flex-col bg-slate-900 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700">
                    <CardTitle className="text-slate-100 flex items-center gap-2"><Sparkles className="text-emerald-400"/> AI Breeder Consultant</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-5 h-5 text-emerald-400" />
                                </div>
                            )}
                            <div className={`max-w-xl p-4 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                <ReactMarkdown className="prose prose-sm prose-invert max-w-none">{msg.content}</ReactMarkdown>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-slate-300" />
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
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about morphs, pairings, genetics..."
                            className="bg-slate-800 border-slate-600 text-slate-100"
                            disabled={isLoading}
                        />
                        <Button type="submit" disabled={isLoading}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    );
}