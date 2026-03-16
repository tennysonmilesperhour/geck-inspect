import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { importGeckosFromCSV } from '@/functions/importGeckosFromCSV';
import { generateCSVTemplate } from '@/functions/generateCSVTemplate';

export default function CSVImportModal({ isOpen, onClose, onImportComplete }) {
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const [importMode, setImportMode] = useState('create_and_update');

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
            setImportResults(null);
        } else {
            alert('Please select a valid CSV file');
        }
    };

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

            // Import the data
            const { data } = await importGeckosFromCSV({ 
                fileUrl: file_url, 
                importMode 
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
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
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
                        <div className="text-sm text-gray-600">
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
                        {!importResults ? (
                            <>
                                <div>
                                    <Label htmlFor="csv-file">Select CSV File</Label>
                                    <Input
                                        id="csv-file"
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileSelect}
                                        className="mt-2"
                                    />
                                    {file && (
                                        <p className="text-sm text-green-600 mt-2">
                                            ✓ Selected: {file.name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label>Import Mode</Label>
                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                        <label className="flex items-center space-x-2">
                                            <input 
                                                type="radio" 
                                                value="create_and_update" 
                                                checked={importMode === 'create_and_update'}
                                                onChange={(e) => setImportMode(e.target.value)}
                                            />
                                            <span>Create new and update existing geckos</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
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

                                <Alert>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        <strong>Important:</strong> Lineage relationships use ID codes to match parents. 
                                        Make sure parent geckos are imported first or already exist in your collection.
                                    </AlertDescription>
                                </Alert>

                                <Button 
                                    onClick={handleImport} 
                                    disabled={!file || isUploading || isImporting}
                                    className="w-full"
                                >
                                    {isUploading || isImporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            {isUploading ? 'Uploading...' : 'Importing...'}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Import Geckos
                                        </>
                                    )}
                                </Button>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-700">{importResults.processed}</div>
                                        <div className="text-sm text-blue-600">Processed</div>
                                    </div>
                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                        <div className="text-2xl font-bold text-green-700">{importResults.created}</div>
                                        <div className="text-sm text-green-600">Created</div>
                                    </div>
                                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                        <div className="text-2xl font-bold text-yellow-700">{importResults.updated}</div>
                                        <div className="text-sm text-yellow-600">Updated</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded-lg">
                                        <div className="text-2xl font-bold text-red-700">{importResults.errors.length}</div>
                                        <div className="text-sm text-red-600">Errors</div>
                                    </div>
                                </div>

                                {importResults.errors.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
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
                                        <h4 className="font-semibold text-yellow-700 mb-2">Warnings:</h4>
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
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}