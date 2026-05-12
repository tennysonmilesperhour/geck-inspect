import { useEffect, useState } from 'react';
import { SupportMessage, User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { LifeBuoy, Send, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Reusable "Contact support" surface.
 *
 * Writes a new row into `support_messages` which admins triage from
 * the Admin Panel's Support Inbox. Replaces the old mailto link that
 * pointed at a personal Gmail address.
 *
 * Works for both authenticated and anonymous users ,  the RLS insert
 * policy allows anyone to file a ticket. If the caller is signed in,
 * we pre-fill user_email from their profile.
 */
export default function SupportContactCard({ title = 'Need help?' }) {
    const [user, setUser] = useState(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [email, setEmail] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        User.me()
            .then((u) => {
                setUser(u);
                if (u?.email) setEmail(u.email);
            })
            .catch((err) => console.error('SupportContactCard User.me failed:', err));
    }, []);

    const handleSubmit = async () => {
        if (!subject.trim() || !body.trim()) {
            toast({
                title: 'Missing fields',
                description: 'Add a subject and a message body.',
                variant: 'destructive',
            });
            return;
        }
        setIsSending(true);
        try {
            await SupportMessage.create({
                user_email: email || user?.email || null,
                subject: subject.trim(),
                body: body.trim(),
                status: 'new',
            });
            setSent(true);
            setSubject('');
            setBody('');
            toast({
                title: 'Message sent',
                description: "We'll get back to you as soon as we can.",
            });
        } catch (err) {
            console.error('Support submit failed:', err);
            toast({
                title: 'Could not send',
                description: err.message || 'Something went wrong ,  try again.',
                variant: 'destructive',
            });
        }
        setIsSending(false);
    };

    if (sent) {
        return (
            <Card className="bg-slate-900/50 border-emerald-500/30">
                <CardContent className="p-8 text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Message received</h3>
                    <p className="text-slate-400">
                        Thanks for reaching out. An admin will review your message and reply soon.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSent(false)}
                        className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    >
                        Send another
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5 text-emerald-400" />
                    {title}
                </CardTitle>
                <p className="text-sm text-slate-400">
                    Send a message directly to the Geck Inspect team. We'll get back to you in the
                    app.
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {!user && (
                    <Input
                        type="email"
                        placeholder="Your email (so we can reply)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                )}
                <Input
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                />
                <Textarea
                    placeholder="What's on your mind?"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100 min-h-32"
                />
                <div className="flex justify-end">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSending || !subject.trim() || !body.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        Send message
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
