import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Upload, Download, FileSpreadsheet, AlertTriangle, Loader2,
    ArrowLeft, ArrowRight, Check, Columns3, Sparkles,
} from 'lucide-react';
import { importGeckosFromCSV } from '@/functions/importGeckosFromCSV';
import { generateCSVTemplate } from '@/functions/generateCSVTemplate';
import { parseCSV, readFileAsText, transformRows } from './csv/csvParser';
import { autoMapColumns, TEMPLATE_FIELDS, requiredFieldsCovered } from './csv/columnMapper';
import CSVColumnMapper from './csv/CSVColumnMapper';

// ---------- step labels for the stepper ----------
const STEPS = [
    { key: 'upload',  label: 'Upload' },
    { key: 'map',     label: 'Map Columns' },
    { key: 'import',  label: 'Import' },
    { key: 'results', label: 'Results' },
];

export default function CSVImportModal({ isOpen, onClose, onImportComplete }) {
    const { toast } = useToast();

    // --- workflow state ---
    const [step, setStep] = useState('upload');        // upload → map → import → results
    const [file, setFile] = useState(null);
    const [sourceHeaders, setSourceHeaders] = useState([]);
    const [sourceRows, setSourceRows] = useState([]);
    const [mapping, setMapping] = useState({});
    const [importMode, setImportMode] = useState('create_and_update');
    const [isImporting, setIsImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const [useDirectFormat, setUseDirectFormat] = useState(false); // skip mapping for exact-template CSVs

    // ------------------------------------------------------------------ helpers
    const reset = useCallback(() => {
        setStep('upload');
        setFile(null);
        setSourceHeaders([]);
        setSourceRows([]);
        setMapping({});
        setImportResults(null);
        setUseDirectFormat(false);
    }, []);

    // --------------------------------------------------- step 1: file selected
    const handleFileSelect = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        // Accept .csv extension or common CSV MIME types
        const csvMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'];
        const isCSV = csvMimeTypes.includes(selectedFile.type) ||
                      selectedFile.name.toLowerCase().endsWith('.csv');
        if (!isCSV) {
            toast({ title: 'Invalid File', description: 'Please select a CSV file (.csv).', variant: 'destructive' });
            return;
        }

        setFile(selectedFile);

        try {
            const text = await readFileAsText(selectedFile);
            const { headers, rows } = parseCSV(text);

            if (headers.length === 0) {
                toast({ title: 'Empty CSV', description: 'The file has no columns.', variant: 'destructive' });
                return;
            }

            setSourceHeaders(headers);
            setSourceRows(rows);

            // Check if the headers already match the template exactly
            const templateKeys = TEMPLATE_FIELDS.map(f => f.key);
            const isExactMatch = templateKeys.every(k => headers.includes(k));
            setUseDirectFormat(isExactMatch);

            // Auto-map columns
            const autoMapping = autoMapColumns(headers);
            setMapping(autoMapping);
        } catch (err) {
            console.error('CSV parse error:', err);
            toast({ title: 'Parse Error', description: 'Could not read the CSV. Make sure it is a valid file.', variant: 'destructive' });
        }
    };

    // ------------------------------------------- step 2 → 3: run the import
    const handleImport = async () => {
        setStep('import');
        setIsImporting(true);

        try {
            // Build row objects from the mapping
            const templateKeys = TEMPLATE_FIELDS.map(f => f.key);
            const rowObjects = transformRows(mapping, sourceHeaders, sourceRows, templateKeys);

            const { data } = await importGeckosFromCSV({ rows: rowObjects, importMode });

            setImportResults(data.results);
            setStep('results');

            if (data.success && onImportComplete) {
                onImportComplete();
            }
        } catch (error) {
            console.error('Import failed:', error);
            setImportResults({
                processed: 0,
                created: 0,
                updated: 0,
                errors: [error.message],
                warnings: [],
            });
            setStep('results');
        }

        setIsImporting(false);
    };

    // ------------------------------------------------- template download
    const downloadTemplate = async (includeExisting = false) => {
        try {
            const { data } = await generateCSVTemplate({ includeExisting });
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = includeExisting ? 'my_geckos_export.csv' : 'gecko_import_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download template:', error);
            toast({ title: 'Download Failed', description: 'Could not generate the template.', variant: 'destructive' });
        }
    };

    // --------------------------------------------------- derived state
    const coverage = requiredFieldsCovered(mapping);
    const canProceedToImport = coverage.mapped === coverage.total;
    const stepIndex = STEPS.findIndex(s => s.key === step);

    // ================================================================= RENDER
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[var(--gi-forest-deep)] border border-emerald-900/60 text-slate-100 shadow-2xl shadow-black/40">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5 text-lg">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                        Bulk Import Geckos from CSV
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-sm">
                        Upload any spreadsheet — we'll help you map the columns to match.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="import" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-800/60 border border-slate-700/40">
                        <TabsTrigger value="import" className="data-[state=active]:bg-emerald-900/50 data-[state=active]:text-emerald-300">
                            Import Data
                        </TabsTrigger>
                        <TabsTrigger value="template" className="data-[state=active]:bg-emerald-900/50 data-[state=active]:text-emerald-300">
                            Download Template
                        </TabsTrigger>
                    </TabsList>

                    {/* ============== TEMPLATE TAB ============== */}
                    <TabsContent value="template" className="space-y-4 pt-2">
                        <div className="text-sm text-slate-400 leading-relaxed">
                            <p className="mb-4">
                                Download a CSV template to get started with bulk importing your
                                gecko collection. You don't <em>have</em> to use this template — any
                                spreadsheet will work. On the Import tab you can map your columns
                                to ours.
                            </p>

                            <div className="space-y-3">
                                <h4 className="font-semibold text-slate-200">Template includes fields for:</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
                                    <li>Basic info (name, ID, sex, hatch date, status)</li>
                                    <li>Morph and trait descriptions</li>
                                    <li>Lineage relationships (sire / dam ID codes)</li>
                                    <li>Current weight and tracking data</li>
                                    <li>Categories, pricing, and notes</li>
                                    <li>Health and breeding tracking</li>
                                </ul>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Button
                                onClick={() => downloadTemplate(false)}
                                className="justify-start bg-emerald-800 hover:bg-emerald-700 text-emerald-100"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download Empty Template
                            </Button>
                            <Button
                                onClick={() => downloadTemplate(true)}
                                variant="outline"
                                className="justify-start border-slate-600 text-slate-200 hover:bg-slate-800"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export Current Collection
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ============== IMPORT TAB ============== */}
                    <TabsContent value="import" className="space-y-5 pt-2">
                        {/* ---------- Stepper ---------- */}
                        <div className="flex items-center gap-1 text-xs">
                            {STEPS.map((s, i) => (
                                <div key={s.key} className="flex items-center gap-1">
                                    <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors ${
                                        i < stepIndex
                                            ? 'bg-emerald-600 text-white'
                                            : i === stepIndex
                                                ? 'bg-emerald-500 text-white ring-2 ring-emerald-400/40'
                                                : 'bg-slate-700 text-slate-500'
                                    }`}>
                                        {i < stepIndex ? <Check className="w-3 h-3" /> : i + 1}
                                    </div>
                                    <span className={`hidden sm:inline ${
                                        i === stepIndex ? 'text-emerald-300 font-medium' : 'text-slate-500'
                                    }`}>
                                        {s.label}
                                    </span>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-6 h-px mx-1 ${
                                            i < stepIndex ? 'bg-emerald-600' : 'bg-slate-700'
                                        }`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* =================== STEP: UPLOAD =================== */}
                        {step === 'upload' && (
                            <div className="space-y-4">
                                {/* File picker — prominent drop zone */}
                                <div>
                                    <Label htmlFor="csv-file" className="text-slate-300">Select CSV File</Label>
                                    <label
                                        htmlFor="csv-file"
                                        className={`mt-2 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                                            file && sourceHeaders.length > 0
                                                ? 'border-emerald-600 bg-emerald-950/30'
                                                : 'border-slate-600 bg-slate-800/40 hover:border-emerald-700 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        {file && sourceHeaders.length > 0 ? (
                                            <>
                                                <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                                                <p className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                                                    <Check className="w-4 h-4" />
                                                    {file.name}
                                                </p>
                                                <p className="text-xs text-emerald-500/80">
                                                    {sourceRows.length} rows, {sourceHeaders.length} columns detected
                                                </p>
                                                {useDirectFormat && (
                                                    <p className="text-xs text-emerald-500/60 flex items-center gap-1.5">
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        Columns match our template — you can skip mapping!
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-8 h-8 text-slate-400" />
                                                <p className="text-sm text-slate-300 font-medium">
                                                    Click to choose a CSV file
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Any spreadsheet format works — we'll help you map the columns
                                                </p>
                                            </>
                                        )}
                                        <input
                                            id="csv-file"
                                            type="file"
                                            accept=".csv,text/csv,application/vnd.ms-excel"
                                            onChange={handleFileSelect}
                                            className="sr-only"
                                        />
                                    </label>
                                </div>

                                {/* Import mode */}
                                <div>
                                    <Label className="text-slate-300">Import Mode</Label>
                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                        <label className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="importMode"
                                                value="create_and_update"
                                                checked={importMode === 'create_and_update'}
                                                onChange={(e) => setImportMode(e.target.value)}
                                                className="accent-emerald-500"
                                            />
                                            <span className="text-sm text-slate-300 group-hover:text-slate-100">
                                                Create new and update existing geckos
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="importMode"
                                                value="create_only"
                                                checked={importMode === 'create_only'}
                                                onChange={(e) => setImportMode(e.target.value)}
                                                className="accent-emerald-500"
                                            />
                                            <span className="text-sm text-slate-300 group-hover:text-slate-100">
                                                Create new geckos only (skip existing)
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <Alert className="bg-amber-950/30 border-amber-800/50 text-amber-200">
                                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                                    <AlertDescription className="text-amber-200/90 text-sm">
                                        <strong>Tip:</strong> Lineage relationships use ID codes to match parents.
                                        Make sure parent geckos are imported first or already exist in your collection.
                                    </AlertDescription>
                                </Alert>

                                {/* Navigation */}
                                <div className="flex gap-2">
                                    {useDirectFormat ? (
                                        <>
                                            <Button
                                                onClick={() => setStep('map')}
                                                disabled={!file || sourceHeaders.length === 0}
                                                variant="outline"
                                                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                                            >
                                                <Columns3 className="w-4 h-4 mr-2" />
                                                Review Mapping
                                            </Button>
                                            <Button
                                                onClick={handleImport}
                                                disabled={!file || sourceHeaders.length === 0}
                                                className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white"
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Import Directly
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            onClick={() => setStep('map')}
                                            disabled={!file || sourceHeaders.length === 0}
                                            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white"
                                        >
                                            Map Columns
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* =================== STEP: MAP =================== */}
                        {step === 'map' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">Column Mapping</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            We auto-detected what we could. Adjust any mappings below.
                                        </p>
                                    </div>
                                    <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-700/50 text-xs">
                                        {sourceRows.length} rows
                                    </Badge>
                                </div>

                                <CSVColumnMapper
                                    sourceHeaders={sourceHeaders}
                                    previewRows={sourceRows}
                                    mapping={mapping}
                                    onMappingChange={setMapping}
                                />

                                {/* Navigation */}
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => setStep('upload')}
                                        variant="outline"
                                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleImport}
                                        disabled={!canProceedToImport}
                                        className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white disabled:bg-slate-700 disabled:text-slate-500"
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Import {sourceRows.length} Geckos
                                    </Button>
                                </div>

                                {!canProceedToImport && (
                                    <p className="text-xs text-amber-400 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Map all required fields before importing.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* =================== STEP: IMPORT (loading) =================== */}
                        {step === 'import' && (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                                <div className="text-center">
                                    <p className="text-slate-200 font-medium">
                                        Importing geckos...
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Processing {sourceRows.length} rows. This may take a moment.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* =================== STEP: RESULTS =================== */}
                        {step === 'results' && importResults && (
                            <div className="space-y-4">
                                {/* Stats grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <StatCard value={importResults.processed} label="Processed" color="blue" />
                                    <StatCard value={importResults.created}   label="Created"   color="green" />
                                    <StatCard value={importResults.updated}   label="Updated"   color="amber" />
                                    <StatCard value={importResults.errors?.length ?? 0} label="Errors" color="red" />
                                </div>

                                {/* Errors */}
                                {importResults.errors?.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-red-400 text-sm mb-2">Errors:</h4>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {importResults.errors.map((error, i) => (
                                                <Badge
                                                    key={i}
                                                    className="bg-red-950/40 text-red-300 border-red-800/50 text-xs block w-fit"
                                                >
                                                    {error}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Warnings */}
                                {importResults.warnings?.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-amber-400 text-sm mb-2">Warnings:</h4>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {importResults.warnings.map((warning, i) => (
                                                <Badge
                                                    key={i}
                                                    className="bg-amber-950/40 text-amber-300 border-amber-800/50 text-xs block w-fit"
                                                >
                                                    {warning}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <Button
                                        onClick={reset}
                                        variant="outline"
                                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                                    >
                                        Import Another File
                                    </Button>
                                    <Button
                                        onClick={onClose}
                                        className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white"
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// -------------------------------------------------------------------
// Small stat card used on the results step
// -------------------------------------------------------------------
function StatCard({ value, label, color }) {
    const styles = {
        blue:  'bg-blue-950/40   border-blue-800/40   text-blue-300',
        green: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300',
        amber: 'bg-amber-950/40  border-amber-800/40  text-amber-300',
        red:   'bg-red-950/40    border-red-800/40    text-red-300',
    };
    const labelStyles = {
        blue:  'text-blue-400/70',
        green: 'text-emerald-400/70',
        amber: 'text-amber-400/70',
        red:   'text-red-400/70',
    };

    return (
        <div className={`text-center p-3 rounded-lg border ${styles[color]}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className={`text-xs ${labelStyles[color]}`}>{label}</div>
        </div>
    );
}
