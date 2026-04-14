import { useState, useEffect } from 'react';
import { MorphReferenceImage, MorphGuide, Notification } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Check, X, Loader2, User as UserIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

export default function MorphSubmissionReview() {
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [morphGuides, setMorphGuides] = useState({});
    const { toast } = useToast();

    const fetchSubmissions = async () => {
        setIsLoading(true);
        try {
            const pendingSubmissions = await MorphReferenceImage.filter({ status: 'pending' });
            const guides = await MorphGuide.list();
            const guidesMap = guides.reduce((acc, guide) => {
                acc[guide.id] = guide.morph_name;
                return acc;
            }, {});
            setSubmissions(pendingSubmissions);
            setMorphGuides(guidesMap);
        } catch (error) {
            console.error("Failed to fetch submissions:", error);
            toast({ title: "Error", description: "Could not fetch submissions.", variant: "destructive" });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchSubmissions();
    }, [toast]);

    const handleAction = async (submissionId, action, reason = "") => {
        const submission = submissions.find(s => s.id === submissionId);
        if (!submission) return;

        try {
            const updateData = { status: action };
            if (action === 'rejected') {
                updateData.rejection_reason = reason;
            }
            await MorphReferenceImage.update(submissionId, updateData);

            // Send notification to user
            await Notification.create({
                user_email: submission.submitted_by_email,
                type: 'submission_approved',
                content: `Your image submission for the ${morphGuides[submission.morph_guide_id]} guide has been ${action}.`,
                link: '/MorphGuide'
            });

            toast({ title: "Success", description: `Submission has been ${action}.` });
            fetchSubmissions(); // Refresh the list
        } catch (error) {
            console.error(`Failed to ${action} submission:`, error);
            toast({ title: "Error", description: "An error occurred.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-slate-100 mb-4">Review Morph Guide Submissions</h2>
                {submissions.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No pending submissions.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {submissions.map(submission => (
                            <div key={submission.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-600">
                                <img src={submission.image_url} alt="Submission" className="w-full h-48 object-cover" />
                                <div className="p-4 space-y-3">
                                    <p className="font-semibold text-slate-200">
                                        For: <span className="font-bold text-emerald-400">{morphGuides[submission.morph_guide_id] || 'Unknown Morph'}</span>
                                    </p>
                                    <p className="text-sm text-slate-400 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4" /> Submitted by: {submission.submitted_by_email}
                                    </p>
                                    <div className="flex gap-2 pt-2">
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleAction(submission.id, 'approved')}>
                                            <Check className="w-4 h-4 mr-2" /> Approve
                                        </Button>
                                        <RejectDialog onConfirm={(reason) => handleAction(submission.id, 'rejected', reason)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RejectDialog({ onConfirm }) {
    const [reason, setReason] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const handleConfirm = () => {
        onConfirm(reason);
        setIsOpen(false);
        setReason('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                    <X className="w-4 h-4 mr-2" /> Reject
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                    <DialogTitle>Reject Submission</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for rejecting this image (optional, but recommended).
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Blurry image, incorrect morph..."
                    className="bg-slate-800 border-slate-600 mt-4"
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleConfirm}>Confirm Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}