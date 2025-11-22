import React, { useState } from 'react';
import { Upload, Camera, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ImageUploadZone({ onFilesSelected, selectedFiles, uploadType, setUploadType }) {
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files).filter(
      file => file.type.startsWith('image/')
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Type Selection */}
      <Card className="bg-sage-50 border-sage-200">
        <CardContent className="p-4">
          <Label className="text-base font-semibold text-sage-900 mb-3 block">
            What are you uploading?
          </Label>
          <RadioGroup value={uploadType} onValueChange={setUploadType} className="flex flex-col space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="same-gecko" id="same-gecko" />
              <Label htmlFor="same-gecko" className="text-sm text-sage-700 cursor-pointer">
                Multiple photos of the same gecko (will be classified together)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="different-geckos" id="different-geckos" />
              <Label htmlFor="different-geckos" className="text-sm text-sage-700 cursor-pointer">
                Multiple different geckos (each photo will be classified separately)
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-sage-300 rounded-xl p-8 text-center bg-sage-50 hover:bg-sage-100 transition-colors"
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-sage-200 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-sage-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-sage-900 mb-2">
              Upload Gecko Images
            </h3>
            <p className="text-sage-600 mb-4">
              {uploadType === 'same-gecko' 
                ? 'Upload multiple photos of the same gecko for better AI training'
                : 'Upload photos of different geckos to classify individually'
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('file-upload').click()}
              className="border-sage-300 text-sage-700 hover:bg-sage-100"
            >
              <Image className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'camera';
                input.multiple = true;
                input.onchange = handleFileInput;
                input.click();
              }}
              className="border-sage-300 text-sage-700 hover:bg-sage-100"
            >
              <Camera className="w-4 h-4 mr-2" />
              Take Photos
            </Button>
          </div>

          <p className="text-xs text-sage-500">
            Supports JPG, PNG, WEBP files. Best quality photos will improve AI accuracy.
          </p>
        </div>
      </div>
    </div>
  );
}