import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, CheckCircle } from "lucide-react";

export default function TrainingProgress({ totalImages, verifiedImages, isLoading }) {
  const trainingGoal = 10000; // Increased training goal

  return (
    <Card className="gecko-card">
      <CardHeader>
        <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gecko-accent" />
          AI Training Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium text-gecko-text-muted">Overall Progress</span>
            <span className="font-bold text-gecko-text">{totalImages.toLocaleString()} / {trainingGoal.toLocaleString()} images</span>
          </div>
          <Progress value={(totalImages / trainingGoal) * 100} className="h-3 [&>*]:bg-gradient-to-r [&>*]:from-emerald-500 [&>*]:to-green-400" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium text-gecko-text-muted flex items-center gap-1"><CheckCircle className="w-4 h-4 text-cyan-400"/> Verified Submissions</span>
            <span className="font-bold text-gecko-text">
              {verifiedImages.toLocaleString()}
            </span>
          </div>
           <Progress value={totalImages > 0 ? (verifiedImages / totalImages) * 100 : 0} className="h-3 [&>*]:bg-gradient-to-r [&>*]:from-cyan-500 [&>*]:to-blue-400" />
           <p className="text-xs text-slate-400 mt-1">{totalImages > 0 ? Math.round((verifiedImages / totalImages) * 100) : 0}% of all submissions are verified.</p>
        </div>
      </CardContent>
    </Card>
  );
}