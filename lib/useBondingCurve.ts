import { useState, useEffect, useCallback } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction, useProvider } from 'wagmi';
import { ethers } from 'ethers';

// Bonding Curve ABI (minimal for hooks)
const BONDING_CURVE_ABI = [
  'function getCurrentStep() external view returns (uint256)',
  'function getCurrentPrice() external view returns (uint256)',
  'function quoteBuy(uint256 qty) external view returns (uint256 totalCost)',
  'function quoteSell(uint256 qty) external view returns (uint256 ogReceived)',
  'function buy(uint256 qty, uint256 maxCost) external payable',
  'function sell(uint256 qty, uint256 minReturn) external',
  'function getCurveStats() external view returns (uint256 currentStep, uint256 currentPrice, uint256 tokensSold, uint256 nativeReserveAmount, bool isGraduated, uint256 remainingTokens)',
  'function graduated() external view returns (bool)',
  'function token() external view returns (address)'
];

export interface CurveStats {
  currentStep: number;
  currentPrice: number;
  tokensSold: number;
  nativeReserve: number;
  isGraduated: boolean;
  remainingTokens: number;
}

export interface BuyQuote {
  tokenAmount: number;
  totalCost: number;
  currentStep: number;
  currentPrice: number;
}

export interface SellQuote {
  ogReceived: number;
  currentStep: number;
  currentPrice: number;
}

export function useBondingCurve(curveAddress: string) {
  const { address } = useAccount();
  const provider = useProvider();
  
  // State
  const [curveStats, setCurveStats] = useState<CurveStats | null>(null);
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Contract reads
  const { data: currentStep } = useContractRead({
    address: curveAddress as `0x${string}`,
    abi: BONDING_CURVE_ABI,
    functionName: 'getCurrentStep',
    watch: true,
  });

  const { data: currentPrice } = useContractRead({
    address: curveAddress as `0x${string}`,
    abi: BONDING_CURVE_ABI,
    functionName: 'getCurrentPrice',
    watch: true,
  });

  const { data: isGraduated } = useContractRead({
    address: curveAddress as `0x${string}`,
    abi: BONDING_CURVE_ABI,
    functionName: 'graduated',
    watch: true,
  });

  const { data: tokenAddress } = useContractRead({
    address: curveAddress as `0x${string}`,
    abi: BONDING_CURVE_ABI,
    functionName: 'token',
  });

  // Contract writes
  const { write: buy, data: buyTx } = useContractWrite({
    address: curveAddress as `0x${string}`,
    abi: BONDING_CURVE_ABI,
    functionName: 'buy',
  });

  const { write: sell, data: sellTx } = useContractWrite({
    address: curveAddress as `0x${string}`,
    abi: BONDING_CURVE_ABI,
    functionName: 'sell',
  });

  // Transaction status
  const { isLoading: buyLoading, isSuccess: buySuccess } = useWaitForTransaction({
    hash: buyTx?.hash,
  });

  const { isLoading: sellLoading, isSuccess: sellSuccess } = useWaitForTransaction({
    hash: sellTx?.hash,
  });

  // Load curve stats
  const loadCurveStats = useCallback(async () => {
    if (!curveAddress || !provider) return;
    
    try {
      setLoading(true);
      const contract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, provider);
      const stats = await contract.getCurveStats();
      
      setCurveStats({
        currentStep: stats.currentStep.toNumber(),
        currentPrice: parseFloat(ethers.utils.formatEther(stats.currentPrice)),
        tokensSold: parseFloat(ethers.utils.formatEther(stats.tokensSold)),
        nativeReserve: parseFloat(ethers.utils.formatEther(stats.nativeReserveAmount)),
        isGraduated: stats.isGraduated,
        remainingTokens: parseFloat(ethers.utils.formatEther(stats.remainingTokens))
      });
    } catch (err) {
      console.error('Error loading curve stats:', err);
      setError('Failed to load curve stats');
    } finally {
      setLoading(false);
    }
  }, [curveAddress, provider]);

  // Get buy quote
  const getBuyQuote = useCallback(async (tokenQty: string) => {
    if (!curveAddress || !provider || !tokenQty || parseFloat(tokenQty) <= 0) {
      setBuyQuote(null);
      return;
    }
    
    try {
      setLoading(true);
      const contract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, provider);
      const tokenQtyWei = ethers.utils.parseEther(tokenQty);
      
      const totalCost = await contract.quoteBuy(tokenQtyWei);
      const step = await contract.getCurrentStep();
      const price = await contract.getCurrentPrice();
      
      setBuyQuote({
        tokenAmount: parseFloat(tokenQty),
        totalCost: parseFloat(ethers.utils.formatEther(totalCost)),
        currentStep: step.toNumber(),
        currentPrice: parseFloat(ethers.utils.formatEther(price))
      });
    } catch (err) {
      console.error('Error getting buy quote:', err);
      setError('Failed to get buy quote');
      setBuyQuote(null);
    } finally {
      setLoading(false);
    }
  }, [curveAddress, provider]);

  // Get sell quote
  const getSellQuote = useCallback(async (tokenQty: string) => {
    if (!curveAddress || !provider || !tokenQty || parseFloat(tokenQty) <= 0) {
      setSellQuote(null);
      return;
    }
    
    try {
      setLoading(true);
      const contract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, provider);
      const tokenQtyWei = ethers.utils.parseEther(tokenQty);
      
      const ogReceived = await contract.quoteSell(tokenQtyWei);
      const step = await contract.getCurrentStep();
      const price = await contract.getCurrentPrice();
      
      setSellQuote({
        ogReceived: parseFloat(ethers.utils.formatEther(ogReceived)),
        currentStep: step.toNumber(),
        currentPrice: parseFloat(ethers.utils.formatEther(price))
      });
    } catch (err) {
      console.error('Error getting sell quote:', err);
      setError('Failed to get sell quote');
      setSellQuote(null);
    } finally {
      setLoading(false);
    }
  }, [curveAddress, provider]);

  // Execute buy
  const executeBuy = useCallback(async (tokenQty: string, maxCost: number) => {
    if (!buy || !tokenQty || parseFloat(tokenQty) <= 0) return;
    
    try {
      const tokenQtyWei = ethers.utils.parseEther(tokenQty);
      const maxCostWei = ethers.utils.parseEther(maxCost.toString());
      
      buy({
        args: [tokenQtyWei, maxCostWei],
        value: maxCostWei,
      });
    } catch (err) {
      console.error('Error executing buy:', err);
      setError('Failed to execute buy');
    }
  }, [buy]);

  // Execute sell
  const executeSell = useCallback(async (tokenQty: string, minReturn: number) => {
    if (!sell || !tokenQty || parseFloat(tokenQty) <= 0) return;
    
    try {
      const tokenQtyWei = ethers.utils.parseEther(tokenQty);
      const minReturnWei = ethers.utils.parseEther(minReturn.toString());
      
      sell({
        args: [tokenQtyWei, minReturnWei],
      });
    } catch (err) {
      console.error('Error executing sell:', err);
      setError('Failed to execute sell');
    }
  }, [sell]);

  // Load stats on mount and when dependencies change
  useEffect(() => {
    loadCurveStats();
  }, [loadCurveStats]);

  // Clear error when successful
  useEffect(() => {
    if (buySuccess || sellSuccess) {
      setError(null);
      // Reload stats after successful transaction
      loadCurveStats();
    }
  }, [buySuccess, sellSuccess, loadCurveStats]);

  return {
    // State
    curveStats,
    buyQuote,
    sellQuote,
    error,
    loading,
    isGraduated,
    tokenAddress,
    
    // Actions
    getBuyQuote,
    getSellQuote,
    executeBuy,
    executeSell,
    loadCurveStats,
    
    // Transaction status
    buyLoading,
    buySuccess,
    sellLoading,
    sellSuccess,
    
    // Clear error
    clearError: () => setError(null),
  };
}




