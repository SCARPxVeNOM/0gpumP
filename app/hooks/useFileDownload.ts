import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useZgStorage } from "../providers/ZgStorageProvider";

export const useFileDownload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { zgStorage, isConnected, error: zgError } = useZgStorage();
  
  const mutation = useMutation({
    mutationFn: async ({ rootHash }: { rootHash: string }) => {
      if (!zgStorage) {
        throw new Error("0G Storage not available");
      }
      if (!isConnected) {
        throw new Error(`0G Storage connection failed: ${zgError || 'Unknown error'}`);
      }

      setProgress(0);
      setStatus("📥 Downloading file from 0G Storage...");
      setProgress(40);

      const downloadResult = await zgStorage.downloadFile(rootHash, true);
      
      if (!downloadResult.success) {
        throw new Error(`Download failed: ${downloadResult.error || 'Unknown error'}`);
      }

      if (!downloadResult.data) {
        throw new Error("No data received from 0G Storage");
      }

      setProgress(100);
      setStatus("✅ File downloaded successfully");

      return {
        data: downloadResult.data,
        size: downloadResult.size,
      };
    },
    onError: (error: any) => {
      setStatus(`❌ Download failed: ${error.message}`);
      setProgress(0);
    },
  });

  return {
    downloadFileMutation: mutation,
    progress,
    status,
  };
};
