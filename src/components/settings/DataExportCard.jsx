import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Gecko } from '@/entities/all';
import { exportGeckosCSV, exportFullBackupJSON } from '@/lib/exportUtils';

/**
 * Data-ownership card for the Settings page. Two one-click exports:
 *
 *   1. Collection CSV, the same roster format as the My Geckos export
 *   2. Full backup JSON, every record type the user owns in one file
 *      (geckos, weights, breeding plans, eggs, clutches, sheds, feedings)
 *
 * The point is as much messaging as mechanism: your records are yours,
 * there is no lock-in, and you can leave with everything any time.
 */
export default function DataExportCard({ user }) {
  const [exporting, setExporting] = useState(null); // null | 'csv' | 'json'
  const { toast } = useToast();

  const handleExportCSV = async () => {
    setExporting('csv');
    try {
      const geckos = await Gecko.filter(
        { created_by: user.email, archived: { $ne: true } },
        'name'
      );
      const name = exportGeckosCSV(geckos);
      toast({
        title: 'Collection exported',
        description: `${geckos.length} gecko${geckos.length === 1 ? '' : 's'} saved to ${name}.`,
      });
    } catch (err) {
      console.error('CSV export failed:', err);
      toast({
        title: 'Export failed',
        description: err?.message || 'Could not export your collection. Please try again.',
        variant: 'destructive',
      });
    }
    setExporting(null);
  };

  const handleExportJSON = async () => {
    setExporting('json');
    try {
      const { filename, counts, notes } = await exportFullBackupJSON();
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      toast({
        title: 'Full backup downloaded',
        description:
          notes.length > 0
            ? `${total} records saved to ${filename}. Some record types could not be fetched; see the notes inside the file.`
            : `${total} records saved to ${filename}.`,
      });
    } catch (err) {
      console.error('JSON backup failed:', err);
      toast({
        title: 'Backup failed',
        description: err?.message || 'Could not create your backup. Please try again.',
        variant: 'destructive',
      });
    }
    setExporting(null);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Your data is yours
        </CardTitle>
        <CardDescription className="text-slate-400">
          No lock-in, ever. Export your full records any time: your collection as a
          spreadsheet-friendly CSV, or everything (geckos, weights, breeding plans,
          eggs, clutches, sheds, feedings) as a single JSON backup.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            disabled={exporting !== null}
            onClick={handleExportCSV}
            className="bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700 hover:text-white"
          >
            {exporting === 'csv' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Export collection CSV
          </Button>
          <Button
            disabled={exporting !== null}
            onClick={handleExportJSON}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {exporting === 'json' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileJson className="w-4 h-4 mr-2" />
            )}
            Download full backup (JSON)
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Backups download straight to your device. Nothing is emailed or shared.
        </p>
      </CardContent>
    </Card>
  );
}
