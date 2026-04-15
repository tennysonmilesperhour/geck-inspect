import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, FileSpreadsheet, AlertTriangle, Loader2, ArrowRight, ArrowLeft, Columns, Check, X } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { importGeckosFromCSV } from '@/functions/importGeckosFromCSV';
import { generateCSVTemplate } from '@/functions/generateCSVTemplate';

// The gecko fields that CSV columns can be mapped to.
// label = human-readable name shown in dropdowns
// aliases = common alternative column names users might have in their spreadsheets
const GECKO_FIELDS = [
    { key: 'name',                 label: 'Name',               required: true,  aliases: ['gecko name', 'animal name', 'gecko', 'animal'] },
    { key: 'gecko_id_code',        label: 'ID Code',            required: false, aliases: ['id', 'id code', 'code', 'gecko id', 'animal id', 'identifier'] },
    { key: 'sex',                  label: 'Sex',                required: true,  aliases: ['gender'] },
    { key: 'hatch_date',           label: 'Hatch Date',         required: false, aliases: ['birth date', 'dob', 'date of birth', 'hatched', 'born', 'birthday', 'hatch'] },
    { key: 'status',               label: 'Status',             required: false, aliases: ['category'] },
    { key: 'morphs_traits',        label: 'Morphs / Traits',    required: false, aliases: ['morph', 'morphs', 'traits', 'morph traits', 'genetics', 'gene', 'genes', 'trait'] },
    { key: 'notes',                label: 'Notes',              required: false, aliases: ['comments', 'description', 'memo'] },
    { key: 'custom_category',      label: 'Category',           required: false, aliases: ['group', 'collection', 'custom category'] },
    { key: 'asking_price',         label: 'Asking Price',       required: false, aliases: ['price', 'cost', 'value', 'sale price'] },
    { key: 'sire_id_code',         label: 'Sire ID Code',       required: false, aliases: ['sire', 'sire id', 'father', 'dad', 'father id', 'sire code'] },
    { key: 'dam_id_code',          label: 'Dam ID Code',        required: false, aliases: ['dam', 'dam id', 'mother', 'mom', 'mother id', 'dam code'] },
    { key: 'current_weight_grams', label: 'Weight (grams)',     required: false, aliases: ['weight', 'weight grams', 'grams', 'weight (g)', 'wt', 'weight_grams'] },
    { key: 'weight_date',          label: 'Weight Date',        required: false, aliases: ['weigh date', 'date weighed'] },
    { key: 'last_shed_date',       label: 'Last Shed Date',     required: false, aliases: ['shed date', 'last shed', 'shedding', 'shed'] },
    { key: 'breeding_notes',       label: 'Breeding Notes',     required: false, aliases: ['breeding'] },
    { key: 'health_notes',         label: 'Health Notes',       required: false, aliases: ['health', 'medical', 'vet notes'] },
    { key: 'acquisition_date',     label: 'Acquisition Date',   required: false, aliases: ['acquired', 'purchase date', 'acquired date'] },
    { key: 'acquisition_source',   label: 'Acquisition Source', required: false, aliases: ['source', 'breeder', 'purchased from', 'from', 'seller'] },
];

const SKIP_VALUE = '__skip__';

/**
 * Normalize a string for fuzzy matching: lowercase, strip non-alphanumeric,
 * collapse whitespace, trim.
 */
function normalize(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Given a raw CSV header string, try to find the best-matching gecko field.
 * Returns the field key or SKIP_VALUE if no good match is found.
 */
function autoDetectField(header) {
    const norm = normalize(header);
    if (!norm) return SKIP_VALUE;

    // Exact key match (e.g. header is literally "morphs_traits")
    const exactKey = GECKO_FIELDS.find(f => normalize(f.key) === norm);
    if (exactKey) return exactKey.key;

    // Exact label match
    const exactLabel = GECKO_FIELDS.find(f => normalize(f.label) === norm);
    if (exactLabel) return exactLabel.key;

    // Alias match
    const aliasMatch = GECKO_FIELDS.find(f => f.aliases.some(a => normalize(a) === norm));
    if (aliasMatch) return aliasMatch.key;

    // Substring / contains match (less strict, check both directions)
    const containsMatch = GECKO_FIELDS.find(f =>
        normalize(f.label).includes(norm) || norm.includes(normalize(f.label)) ||
        f.aliases.some(a => normalize(a).includes(norm) || norm.includes(normalize(a)))
    );
    if (containsMatch) return containsMatch.key;

    return SKIP_VALUE;
}

/**
 * Parse just the header row from a CSV string (handles quoted fields).
 */
function parseCSVHeaders(text) {
    // Take the first line (handle \r\n, \r, \n)
    const firstLine = text.split(/\r?\n|\r/)[0] || '';
    if (!firstLine.trim()) return [];

    const headers = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < firstLine.length; i++) {
        const ch = firstLine[i];
        if (ch === '"') {
            if (inQuotes && firstLine[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            headers.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    headers.push(current.trim());
    return headers;
}

/**
 * Parse a few preview rows (up to 3) from CSV text.
 */
function parseCSVPreviewRows(text, maxRows = 3) {
    const lines = text.split(/\r?\n|\r/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const rows = [];
    for (let r = 1; r < Math.min(lines.length, maxRows + 1); r++) {
        const line = lines[r];
        const cells = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        cells.push(current.trim());
        rows.push(cells);
    }
    return rows;
}


export default function CSVImportModal({ isOpen, onClose, onImportComplete }) {
    const { toast } = useToast();
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const [importMode, setImportMode] = useState('create_and_update');

    // Field mapping state
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [previewRows, setPreviewRows] = useState([]);
    const [fieldMapping, setFieldMapping] = useState({}); // { csvHeader: geckoFieldKey }
    const [showMapping, setShowMapping] = useState(false);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
            toast({ title: "Invalid File", description: "Please select a valid CSV file.", variant: "destructive" });
            return;
        }

        setFile(selectedFile);
        setImportResults(null);
        setShowMapping(false);

        // Read the file to extract headers
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const headers = parseCSVHeaders(text);
            const preview = parseCSVPreviewRows(text);

            if (headers.length === 0) {
                toast({ title: "Empty File", description: "The CSV file appears to be empty.", variant: "destructive" });
                setFile(null);
                return;
            }

            setCsvHeaders(headers);
            setPreviewRows(preview);

            // Auto-detect mappings, avoiding duplicate assignments
            const used = new Set();
            const mapping = {};
            headers.forEach(h => {
                const detected = autoDetectField(h);
                if (detected !== SKIP_VALUE && !used.has(detected)) {
                    mapping[h] = detected;
                    used.add(detected);
                } else {
                    mapping[h] = SKIP_VALUE;
                }
            });
            setFieldMapping(mapping);
            setShowMapping(true);
        };
        reader.readAsText(selectedFile);
    };

    const handleMappingChange = (csvHeader, geckoField) => {
        setFieldMapping(prev => {
            const updated = { ...prev };

            // If a different header was previously mapped to this gecko field, clear it
            if (geckoField !== SKIP_VALUE) {
                Object.keys(updated).forEach(h => {
                    if (h !== csvHeader && updated[h] === geckoField) {
                        updated[h] = SKIP_VALUE;
                    }
                });
            }

            updated[csvHeader] = geckoField;
            return updated;
        });
    };

    // Check which required fields are mapped
    const mappingValidation = useMemo(() => {
        const mappedFields = new Set(Object.values(fieldMapping).filter(v => v !== SKIP_VALUE));
        const missingRequired = GECKO_FIELDS.filter(f => f.required && !mappedFields.has(f.key));
        const mappedCount = mappedFields.size;
        return { missingRequired, mappedCount };
    }, [fieldMapping]);

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
            alert('Failed to download template');
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            // Upload the CSV file first
            const { file_url } = await UploadFile({ file });

            setIsUploading(false);
            setIsImporting(true);

            // Build the mapping to send to the backend.
            // Only include headers that are actually mapped to a field.
            const activeMappings = {};
            Object.entries(fieldMapping).forEach(([csvHeader, geckoField]) => {
                if (geckoField !== SKIP_VALUE) {
                    activeMappings[csvHeader] = geckoField;
                }
            });

            // Import the data with field mapping
            const { data } = await importGeckosFromCSV({
                fileUrl: file_url,
                importMode,
                fieldMapping: activeMappings,
            });

            setImportResults(data.results);

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
                warnings: []
            });
        }

        setIsUploading(false);
        setIsImporting(false);
    };

    const resetImport = () => {
        setFile(null);
        setImportResults(null);
        setCsvHeaders([]);
        setPreviewRows([]);
        setFieldMapping({});
        setShowMapping(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-slate-900 border-slate-700 text-slate-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Bulk Import Geckos from CSV
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="import" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="import">Import Data</TabsTrigger>
                        <TabsTrigger value="template">Download Template</TabsTrigger>
                    </TabsList>

                    <TabsContent value="template" className="space-y-4">
                        <div className="text-sm text-slate-400">
                            <p className="mb-4">Download a CSV template to get started with bulk importing your gecko collection.</p>

                            <div className="space-y-3">
                                <h4 className="font-semibold">Template includes fields for:</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Basic info (name, ID, sex, hatch date, status)</li>
                                    <li>Morph and trait descriptions</li>
                                    <li>Lineage relationships (sire/dam ID codes)</li>
                                    <li>Current weight and tracking data</li>
                                    <li>Categories, pricing, and notes</li>
                                    <li>Health and breeding tracking</li>
                                </ul>
                            </div>

                            <Alert className="mt-4 border-slate-600 bg-slate-800">
                                <Columns className="h-4 w-4" />
                                <AlertDescription className="text-slate-300">
                                    <strong>Already have your own spreadsheet?</strong> No need to reformat it!
                                    Use the Import tab and you'll be able to map your columns to the fields above.
                                </AlertDescription>
                            </Alert>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Button onClick={() => downloadTemplate(false)} className="justify-start">
                                <Download className="w-4 h-4 mr-2" />
                                Download Empty Template
                            </Button>
                            <Button onClick={() => downloadTemplate(true)} variant="outline" className="justify-start">
                                <Download className="w-4 h-4 mr-2" />
                                Export Current Collection
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="import" className="space-y-4">
                        {importResults ? (
                            /* ---- Results view ---- */
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 bg-blue-950/50 border border-blue-800 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-400">{importResults.processed}</div>
                                        <div className="text-sm text-blue-300">Processed</div>
                                    </div>
                                    <div className="text-center p-3 bg-green-950/50 border border-green-800 rounded-lg">
                                        <div className="text-2xl font-bold text-green-400">{importResults.created}</div>
                                        <div className="text-sm text-green-300">Created</div>
                                    </div>
                                    <div className="text-center p-3 bg-yellow-950/50 border border-yellow-800 rounded-lg">
                                        <div className="text-2xl font-bold text-yellow-400">{importResults.updated}</div>
                                        <div className="text-sm text-yellow-300">Updated</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-950/50 border border-red-800 rounded-lg">
                                        <div className="text-2xl font-bold text-red-400">{importResults.errors.length}</div>
                                        <div className="text-sm text-red-300">Errors</div>
                                    </div>
                                </div>

                                {importResults.errors.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-red-400 mb-2">Errors:</h4>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {importResults.errors.map((error, i) => (
                                                <Badge key={i} variant="destructive" className="text-xs">
                                                    {error}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {importResults.warnings.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-yellow-400 mb-2">Warnings:</h4>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {importResults.warnings.map((warning, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs">
                                                    {warning}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button onClick={resetImport} variant="outline" className="flex-1">
                                        Import Another File
                                    </Button>
                                    <Button onClick={onClose} className="flex-1">
                                        Done
                                    </Button>
                                </div>
                            </div>
                        ) : showMapping ? (
                            /* ---- Column mapping step ---- */
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                                            <Columns className="w-4 h-4" />
                                            Map Your Columns
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Tell us which of your columns correspond to each gecko field.
                                            We've auto-detected what we can — adjust anything that looks wrong.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                        {mappingValidation.mappedCount} of {csvHeaders.length} mapped
                                    </Badge>
                                </div>

                                {mappingValidation.missingRequired.length > 0 && (
                                    <Alert variant="destructive" className="border-red-800 bg-red-950/40">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>
                                            Required fields not yet mapped:{' '}
                                            {mappingValidation.missingRequired.map(f => f.label).join(', ')}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <ScrollArea className="max-h-[340px] pr-3">
                                    <div className="space-y-2">
                                        {/* Header row */}
                                        <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-center px-1 pb-1 border-b border-slate-700">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your CSV Column</span>
                                            <span />
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gecko Field</span>
                                        </div>

                                        {csvHeaders.map((header) => {
                                            const mapped = fieldMapping[header];
                                            const isSkipped = mapped === SKIP_VALUE;
                                            const matchedField = GECKO_FIELDS.find(f => f.key === mapped);
                                            // Show preview data for this column
                                            const colIdx = csvHeaders.indexOf(header);
                                            const sampleValues = previewRows
                                                .map(row => row[colIdx])
                                                .filter(Boolean)
                                                .slice(0, 2);

                                            return (
                                                <div
                                                    key={header}
                                                    className={`grid grid-cols-[1fr_32px_1fr] gap-2 items-center p-2 rounded-lg transition-colors ${
                                                        isSkipped ? 'bg-slate-800/40 opacity-60' : 'bg-slate-800'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-slate-200 truncate" title={header}>
                                                            {header}
                                                        </div>
                                                        {sampleValues.length > 0 && (
                                                            <div className="text-xs text-slate-500 truncate mt-0.5" title={sampleValues.join(', ')}>
                                                                e.g. {sampleValues.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-center">
                                                        <ArrowRight className="w-4 h-4 text-slate-500" />
                                                    </div>

                                                    <Select
                                                        value={fieldMapping[header]}
                                                        onValueChange={(val) => handleMappingChange(header, val)}
                                                    >
                                                        <SelectTrigger className={`h-9 text-sm ${
                                                            isSkipped
                                                                ? 'border-slate-700 text-slate-500'
                                                                : matchedField?.required
                                                                    ? 'border-green-700 text-green-300'
                                                                    : 'border-slate-600 text-slate-200'
                                                        }`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-800 border-slate-700">
                                                            <SelectItem value={SKIP_VALUE} className="text-slate-400">
                                                                <span className="flex items-center gap-1.5">
                                                                    <X className="w-3 h-3" />
                                                                    Skip this column
                                                                </span>
                                                            </SelectItem>
                                                            {GECKO_FIELDS.map(field => {
                                                                const alreadyUsed = Object.entries(fieldMapping).some(
                                                                    ([h, v]) => h !== header && v === field.key
                                                                );
                                                                return (
                                                                    <SelectItem
                                                                        key={field.key}
                                                                        value={field.key}
                                                                        disabled={alreadyUsed}
                                                                        className={alreadyUsed ? 'opacity-40' : ''}
                                                                    >
                                                                        <span className="flex items-center gap-1.5">
                                                                            {field.label}
                                                                            {field.required && (
                                                                                <span className="text-red-400 text-xs">*</span>
                                                                            )}
                                                                            {alreadyUsed && (
                                                                                <span className="text-xs text-slate-500">(in use)</span>
                                                                            )}
                                                                        </span>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>

                                {/* Import mode */}
                                <div className="border-t border-slate-700 pt-3">
                                    <Label className="text-sm">Import Mode</Label>
                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                        <label className="flex items-center space-x-2 text-sm">
                                            <input
                                                type="radio"
                                                value="create_and_update"
                                                checked={importMode === 'create_and_update'}
                                                onChange={(e) => setImportMode(e.target.value)}
                                            />
                                            <span>Create new and update existing geckos</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm">
                                            <input
                                                type="radio"
                                                value="create_only"
                                                checked={importMode === 'create_only'}
                                                onChange={(e) => setImportMode(e.target.value)}
                                            />
                                            <span>Create new geckos only (skip existing)</span>
                                        </label>
                                    </div>
                                </div>

                                <Alert className="border-slate-600 bg-slate-800/60">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription className="text-slate-300 text-xs">
                                        <strong>Lineage:</strong> Sire/Dam fields use ID codes to match parents.
                                        Make sure parent geckos are imported first or already exist in your collection.
                                    </AlertDescription>
                                </Alert>

                                <div className="flex gap-2">
                                    <Button onClick={resetImport} variant="outline" className="flex-1">
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleImport}
                                        disabled={mappingValidation.missingRequired.length > 0 || isUploading || isImporting}
                                        className="flex-1"
                                    >
                                        {isUploading || isImporting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                {isUploading ? 'Uploading...' : 'Importing...'}
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Import {csvHeaders.length > 0 ? `(${mappingValidation.mappedCount} fields)` : ''}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* ---- File selection step ---- */
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="csv-file">Select CSV File</Label>
                                    <p className="text-xs text-slate-400 mt-1 mb-2">
                                        Upload any CSV — your own spreadsheet or our template.
                                        You'll be able to map your columns to gecko fields in the next step.
                                    </p>
                                    <Input
                                        id="csv-file"
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileSelect}
                                        className="mt-2"
                                    />
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
