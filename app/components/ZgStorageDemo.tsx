import React, { useState } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { useFileDownload } from '../hooks/useFileDownload';
import { useAccount } from 'wagmi';

export const ZgStorageDemo = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedHash, setUploadedHash] = useState<string>('');
  const [downloadData, setDownloadData] = useState<Uint8Array | null>(null);
  
  const { address } = useAccount();
  const { uploadFileMutation, progress: uploadProgress, status: uploadStatus } = useFileUpload();
  const { downloadFileMutation, progress: downloadProgress, status: downloadStatus } = useFileDownload();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      const result = await uploadFileMutation.mutateAsync({ file: selectedFile });
      setUploadedHash(result.rootHash);
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleDownload = async () => {
    if (!uploadedHash) return;
    
    try {
      const result = await downloadFileMutation.mutateAsync({ rootHash: uploadedHash });
      setDownloadData(result.data);
      console.log('Download successful:', result);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const downloadAsFile = () => {
    if (!downloadData) return;
    
    const blob = new Blob([downloadData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'downloaded-file';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">0G Storage Demo</h2>
      
      {!address && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Please connect your wallet to use 0G Storage
        </div>
      )}

      <div className="space-y-6">
        {/* File Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File to Upload
          </label>
          <input
            type="file"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {selectedFile.name} ({selectedFile.size} bytes)
            </p>
          )}
        </div>

        {/* Upload Section */}
        <div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !address || uploadFileMutation.isPending}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploadFileMutation.isPending ? 'Uploading...' : 'Upload to 0G Storage'}
          </button>
          
          {uploadProgress > 0 && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">{uploadStatus}</p>
            </div>
          )}
          
          {uploadedHash && (
            <div className="mt-2 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              <p className="text-sm font-medium">Upload Successful!</p>
              <p className="text-xs break-all">Root Hash: {uploadedHash}</p>
            </div>
          )}
        </div>

        {/* Download Section */}
        {uploadedHash && (
          <div>
            <button
              onClick={handleDownload}
              disabled={downloadFileMutation.isPending}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {downloadFileMutation.isPending ? 'Downloading...' : 'Download from 0G Storage'}
            </button>
            
            {downloadProgress > 0 && (
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">{downloadStatus}</p>
              </div>
            )}
            
            {downloadData && (
              <div className="mt-2 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                <p className="text-sm font-medium">Download Successful!</p>
                <p className="text-xs">Size: {downloadData.length} bytes</p>
                <button
                  onClick={downloadAsFile}
                  className="mt-2 bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700"
                >
                  Save as File
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
