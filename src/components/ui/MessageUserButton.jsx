import { useState } from 'react';
import { DirectMessage } from '@/entities/DirectMessage';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Send } from 'lucide-react';
import { notifyNewMessage } from '@/components/notifications/NotificationService';

export default function MessageUserButton({ recipientEmail, recipientName, variant = "outline", size = "sm", className = "", context = null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const sendMessage = async () => {
        if (!message.trim()) return;

        setIsSending(true);
        try {
            const currentUser = await User.me();
            await DirectMessage.create({
                sender_email: currentUser.email,
                recipient_email: recipientEmail,
                content: message.trim(),
                ...(context ? { message_type: context } : {})
            });

            // Trigger notification for the recipient
            await notifyNewMessage(
                recipientEmail,
                currentUser.email,
                currentUser.full_name || currentUser.breeder_name || currentUser.email,
                message.trim()
            ).catch(e => console.error('Notification failed:', e));

            setMessage('');
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to send message:", error);
        }
        setIsSending(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} size={size} className={className}>
                    <Mail className="w-4 h-4 mr-2" />
                    Message
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Send Message to {recipientName || recipientEmail}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Textarea
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="h-32"
                    />
                    <div className="flex gap-2">
                        <Button 
                            onClick={sendMessage} 
                            disabled={isSending || !message.trim()}
                            className="flex-1"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            {isSending ? 'Sending...' : 'Send Message'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}