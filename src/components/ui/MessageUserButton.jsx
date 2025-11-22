import React, { useState } from 'react';
import { DirectMessage } from '@/entities/DirectMessage';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Send } from 'lucide-react';

export default function MessageUserButton({ recipientEmail, recipientName, variant = "outline", size = "sm" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const sendMessage = async () => {
        if (!message.trim()) return;
        
        setIsSending(true);
        try {
            await DirectMessage.create({
                recipient_email: recipientEmail,
                content: message.trim()
            });
            
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
                <Button variant={variant} size={size}>
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