import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useZgStorage } from "../providers/ZgStorageProvider";
import { useEthersSigner } from "./useEthers";

export const useFileUpload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { zgStorage, isConnected, error: zgError } = useZgStorage();
  const { address } = useAccount();
  const signer = useEthersSigner();

  const mutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!zgStorage) {
        throw new Error("0G Storage not available");
      }
      if (!address) {
        throw new Error("Wallet not connected");
      }
      if (!isConnected) {
        throw new Error(`0G Storage connection failed: ${zgError || 'Unknown error'}`);
      }
      
      setProgress(0);
      setStatus("🔄 Uploading file to 0G Storage...");
      setProgress(30);

      if (!signer) {
        throw new Error('Wallet not connected');
      }
      
      const uploadResult = await zgStorage.uploadFile(file, signer);
      
      setProgress(70);
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error || 'Unknown error'}`);
      }

      setProgress(100);
      setStatus("🎉 File uploaded successfully!");

      return {
        rootHash: uploadResult.rootHash,
        txHash: uploadResult.txHash,
        fileName: file.name,
        fileSize: file.size,
      };
    },
    onError: (error: any) => {
      setStatus(`❌ Upload failed: ${error.message}`);
      setProgress(0);
    },
  });

  return {
    uploadFileMutation: mutation,
    progress,
    status,
  };
};
