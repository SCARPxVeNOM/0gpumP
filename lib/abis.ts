/**
 * Centralized ABIs for smart contracts used in the 0G Pump application
 */

export const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)'
]

export const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external'
]

export const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
]

export const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)'
]

export const IWETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256) external',
  'function transfer(address to, uint256 amount) external returns (bool)'
]

export default {
  FACTORY_ABI,
  PAIR_ABI,
  ROUTER_ABI,
  ERC20_ABI,
  IWETH_ABI
}
























