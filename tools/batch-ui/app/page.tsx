'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { parseBatchInput, getExampleBatch } from '@/lib/batch-parser';
import { createBatchHash, shortHash } from '@/lib/hash';
import type { 
  BatchSession, 
  UIState, 
  UploadedFile,
  BatchImageResponse,
  ProblemDetails,
  CostBreakdown
} from '@/lib/types';

export default function BatchGeneratorPage() {
  // UI State
  const [uiState, setUiState] = useState<UIState>({
    currentPhase: 'editing',
    isLoading: false,
  });

  // Batch text input
  const [batchText, setBatchText] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  
  // Uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // Session management
  const [session, setSession] = useState<BatchSession | null>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Load example on mount
  useEffect(() => {
    setBatchText(getExampleBatch());
  }, []);

  // Parse batch text in real-time
  useEffect(() => {
    if (!batchText.trim()) {
      setParseErrors([]);
      return;
    }

    const parsed = parseBatchInput(batchText, {
      maxRows: Number(process.env.NEXT_PUBLIC_MAX_ROWS) || 10,
      maxVariantsPerRow: Number(process.env.NEXT_PUBLIC_MAX_VARIANTS) || 3,
      costPerImage: Number(process.env.NEXT_PUBLIC_COST_PER_IMAGE) || 0.002,
    });

    setParseErrors(parsed.errors);
    
    if (parsed.errors.length === 0 && parsed.rows.length > 0) {
      // Create batch hash for idempotency
      const hash = createBatchHash({
        rows: parsed.rows,
        timestamp: Date.now(),
      });

      // Update or create session
      setSession(prev => ({
        id: prev?.id || crypto.randomUUID(),
        batch: { ...parsed, hash },
        uploadedFiles: prev?.uploadedFiles || [],
        dryRunResult: prev?.dryRunResult,
        liveRunResult: prev?.liveRunResult,
        approvals: prev?.approvals || new Set(),
        createdAt: prev?.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString(),
      }));
    }
  }, [batchText]);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (uiState.currentPhase !== 'editing') return;
    
    setUiState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const newFiles: UploadedFile[] = [];
      
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`File ${file.name} is not an image`);
        }
        
        // Validate file size
        const maxSizeMB = 10;
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds ${maxSizeMB}MB limit`);
        }

        // Mock upload for MVP
        if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
          newFiles.push({
            name: file.name,
            url: URL.createObjectURL(file),
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          });
        } else {
          // For now, still use local URLs even in non-mock mode
          newFiles.push({
            name: file.name,
            url: URL.createObjectURL(file),
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          });
        }
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      setUiState(prev => ({
        ...prev,
        error: {
          type: '/problems/upload-failed',
          title: 'Upload Failed',
          status: 400,
          detail: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [uiState.currentPhase]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uiState.currentPhase === 'editing') {
      setIsDragging(true);
    }
  }, [uiState.currentPhase]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (uiState.currentPhase === 'editing' && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [uiState.currentPhase, handleFileUpload]);

  // Handle dry run
  const handleDryRun = useCallback(async () => {
    if (!session?.batch || parseErrors.length > 0) return;

    setUiState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const response = await fetch('/api/proxy/batch/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-batch-hash': session.batch.hash || '',
        },
        body: JSON.stringify({
          items: session.batch.rows.map(row => ({
            scene_id: row.sceneId,
            prompt: row.prompt,
            variants: row.variants,
            ref_pack_public_urls: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.url) : undefined,
          })),
          runMode: 'dry_run',
        }),
      });

      const data = await response.json();
      console.log('🎯 Dry run response:', data);

      if (!response.ok) {
        throw data as ProblemDetails;
      }

      // Store dry run result
      setSession(prev => prev ? {
        ...prev,
        dryRunResult: data as BatchImageResponse,
        lastModified: new Date().toISOString(),
      } : null);
      
      console.log('✅ Dry run result stored successfully');

      setUiState(prev => ({ ...prev, currentPhase: 'approval' }));
    } catch (error) {
      setUiState(prev => ({
        ...prev,
        error: error as ProblemDetails,
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [session, parseErrors, uploadedFiles]);

  // Handle live run
  const handleLiveRun = useCallback(async () => {
    if (!session?.batch || !session.dryRunResult) return;

    setUiState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const response = await fetch('/api/proxy/batch/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-batch-hash': session.batch.hash || '',
        },
        body: JSON.stringify({
          items: session.batch.rows.map(row => ({
            scene_id: row.sceneId,
            prompt: row.prompt,
            variants: row.variants,
            ref_pack_public_urls: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.url) : undefined,
          })),
          runMode: 'live',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw data as ProblemDetails;
      }

      // Store live run result
      setSession(prev => prev ? {
        ...prev,
        liveRunResult: data as BatchImageResponse,
        lastModified: new Date().toISOString(),
      } : null);

      setUiState(prev => ({ ...prev, currentPhase: 'completed' }));
    } catch (error) {
      setUiState(prev => ({
        ...prev,
        error: error as ProblemDetails,
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [session, uploadedFiles]);

  // Reset to start new batch
  const handleReset = useCallback(() => {
    setSession(null);
    setBatchText('');
    setUploadedFiles([]);
    setParseErrors([]);
    setUiState({
      currentPhase: 'editing',
      isLoading: false,
    });
  }, []);

  // Calculate cost breakdown
  const costBreakdown: CostBreakdown | null = session ? {
    images: {
      count: session.batch.totalImages,
      unitCost: Number(process.env.NEXT_PUBLIC_COST_PER_IMAGE) || 0.002,
      totalCost: session.batch.estimatedCost,
    },
    grandTotal: session.batch.estimatedCost,
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            AI Batch Generator MVP
          </h1>
          <p className="mt-2 text-black">
            Generate images in bulk with simple pipe-delimited format
          </p>
        </div>

        {/* Error Display */}
        {uiState.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold">
              {uiState.error.title}
            </h3>
            <p className="text-red-600 mt-1">{uiState.error.detail}</p>
          </div>
        )}

        {/* Phase Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {(['editing', 'dry_run', 'approval', 'live_run', 'completed'] as const).map((phase, idx) => (
              <div
                key={phase}
                className={`flex-1 ${idx > 0 ? 'ml-2' : ''}`}
              >
                <div
                  className={`h-2 rounded ${
                    uiState.currentPhase === phase
                      ? 'bg-blue-600'
                      : idx < ['editing', 'dry_run', 'approval', 'live_run', 'completed'].indexOf(uiState.currentPhase)
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                  }`}
                />
                <p className="text-xs mt-1 text-center capitalize">
                  {phase.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Batch Editor</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-black mb-2">
                  Batch Prompts (scene_id | prompt | variants)
                </label>
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  disabled={uiState.currentPhase !== 'editing'}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm text-gray-900 disabled:bg-gray-50 disabled:text-black"
                  placeholder="scene_1 | A beautiful sunset over mountains | 2"
                />
              </div>

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm font-semibold text-black mb-1">
                    Validation Errors:
                  </p>
                  <ul className="text-sm text-black list-disc list-inside">
                    {parseErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* File Upload Zone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-black mb-2">
                  Reference Images (Optional)
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    disabled={uiState.currentPhase !== 'editing'}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                      uiState.currentPhase !== 'editing' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span>📁 Choose Files</span>
                  </label>
                  <p className="text-xs text-black mt-2">
                    or drag and drop
                  </p>
                  <p className="text-xs text-black mt-1">
                    PNG, JPG up to 10MB each
                  </p>
                  {isDragging && (
                    <p className="text-sm text-blue-600 mt-2 font-medium">
                      Drop images here...
                    </p>
                  )}
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-black mb-1">
                      Uploaded Files:
                    </p>
                    <ul className="text-sm text-black">
                      {uploadedFiles.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between py-1">
                          <span>{file.name}</span>
                          <span className="text-xs text-black">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {uiState.currentPhase === 'editing' && (
                  <button
                    onClick={handleDryRun}
                    disabled={parseErrors.length > 0 || !session?.batch.rows.length || uiState.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {uiState.isLoading ? 'Processing...' : 'Run Dry Run'}
                  </button>
                )}

                {uiState.currentPhase === 'approval' && session?.dryRunResult && (
                  <>
                    <button
                      onClick={handleLiveRun}
                      disabled={uiState.isLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
                    >
                      {uiState.isLoading ? 'Generating...' : 'Approve & Generate'}
                    </button>
                    <button
                      onClick={() => setUiState(prev => ({ ...prev, currentPhase: 'editing' }))}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Back to Edit
                    </button>
                  </>
                )}

                {uiState.currentPhase === 'completed' && (
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Start New Batch
                  </button>
                )}

                {/* Debug: Force show phase and add reset button */}
                <div className="text-xs text-gray-500 mt-2">
                  Current Phase: {uiState.currentPhase} | 
                  <button 
                    onClick={() => setUiState(prev => ({ ...prev, currentPhase: 'editing' }))}
                    className="ml-1 text-blue-600 underline"
                  >
                    Force Reset to Editing
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Status & Cost */}
          <div className="space-y-6">
            {/* Batch Info */}
            {session && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Batch Info</h2>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-black">Batch ID</p>
                    <p className="font-mono text-sm">
                      {shortHash(session.batch.hash || session.id)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-black">Total Scenes</p>
                    <p className="font-semibold">{session.batch.rows.length}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-black">Total Images</p>
                    <p className="font-semibold">{session.batch.totalImages}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            {costBreakdown && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Cost Estimate</h2>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-black">
                      {costBreakdown.images.count} images × ${costBreakdown.images.unitCost}
                    </span>
                    <span className="font-semibold">
                      ${costBreakdown.images.totalCost.toFixed(3)}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-lg">
                        ${costBreakdown.grandTotal.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Summary */}
            {session?.dryRunResult && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {session.liveRunResult ? 'Generation Results' : 'Dry Run Results'}
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-black">Status</p>
                    <p className="font-semibold capitalize">
                      {session.liveRunResult?.status || session.dryRunResult.status}
                    </p>
                  </div>
                  
                  {session.liveRunResult && (
                    <div>
                      <p className="text-sm text-black">Progress</p>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${(session.liveRunResult.processedImages / session.liveRunResult.totalImages) * 100}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-black mt-1">
                        {session.liveRunResult.processedImages} / {session.liveRunResult.totalImages}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
