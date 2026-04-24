import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Link as LinkIcon, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const CodeExample = ({ children }) => (
    <pre className="bg-muted p-2 rounded-md text-sm text-foreground font-mono">
        <code>{children}</code>
    </pre>
);

export default function GeckoIdGuide() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card className="bg-card/80 backdrop-blur-sm border-border shadow-lg">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/60 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Info className="w-5 h-5 text-primary" />
                                <CardTitle className="text-lg">Understanding Gecko ID Codes</CardTitle>
                            </div>
                            <Button variant="ghost" size="sm" className="p-1">
                                {isOpen ? (
                                    <ChevronUp className="w-4 h-4" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground text-left mt-1">
                            {isOpen ? 'Click to hide guide' : 'Click to learn how automatic ID codes work'}
                        </p>
                    </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <CardContent className="space-y-4 text-muted-foreground pt-0">
                        <p>
                            Our system automatically generates unique ID codes to help you track lineage effortlessly. While you can manually override them, here's how the automatic system works:
                        </p>

                        <div className="p-4 border border-border rounded-lg">
                            <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                <Users className="w-5 h-5" /> Founder Geckos (No Parents)
                            </h4>
                            <p className="mb-2">
                                For geckos without a sire or dam in your collection, the ID is based on your breeder prefix (from your profile settings) and a sequential number.
                            </p>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">Breeder Prefix</Badge>
                                <span>+</span>
                                <Badge variant="outline">Sequential Number</Badge>
                            </div>
                            <p className="text-sm mt-2 mb-2">Example:</p>
                            <CodeExample>GI-001</CodeExample>
                        </div>

                        <div className="p-4 border border-border rounded-lg">
                            <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                <LinkIcon className="w-5 h-5" /> Offspring (With Parents)
                            </h4>
                            <p className="mb-2">
                                For offspring, the ID is created by combining the ID codes of the sire and dam, followed by a number for that specific pairing's offspring.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">Sire's ID</Badge>
                                <span>x</span>
                                <Badge variant="outline">Dam's ID</Badge>
                                <span>-</span>
                                <Badge variant="outline">Offspring Number</Badge>
                            </div>
                            <p className="text-sm mt-2 mb-2">Example:</p>
                            <CodeExample>GI-001xREX-003-01</CodeExample>
                            <p className="text-sm mt-1">
                                (The first offspring from the pairing of GI-001 and REX-003)
                            </p>
                        </div>
                        <p className="text-xs text-center text-sage-500 pt-2">
                            This automated system ensures that every gecko has a unique, traceable ID, making lineage management simple and clear.
                        </p>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}