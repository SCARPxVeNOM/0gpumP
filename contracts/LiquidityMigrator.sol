// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LiquidityMigrator
 * @dev Handles migration from bonding curve to UniswapV2 DEX when graduation occurs
 */
contract LiquidityMigrator {
    
    address public immutable factory;
    address public immutable router;
    address public immutable weth;
    
    // Owner
    address public owner;
    
    // Reentrancy guard
    bool private _locked;
    
    // Migration state
    mapping(address => bool) public migratedTokens;
    mapping(address => address) public tokenToPair;
    
    // Events
    event LiquidityMigrated(
        address indexed token,
        address indexed pair,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lpTokens
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
    
    constructor(address _router) {
        require(_router != address(0), "Invalid router address");
        
        // Get factory and WETH from router
        router = _router;
        factory = IUniswapV2Router02(_router).factory();
        weth = IUniswapV2Router02(_router).WETH();
        owner = msg.sender;
    }
    
    /**
     * @dev Migrate liquidity from bonding curve to UniswapV2
     * @param token Token address to migrate
     * @param tokenAmount Amount of tokens to add to liquidity
     * @param ethAmount Amount of ETH to add to liquidity
     * @param minTokenAmount Minimum tokens to receive (slippage protection)
     * @param minEthAmount Minimum ETH to receive (slippage protection)
     * @param lpRecipient Address to receive LP tokens
     * @param deadline Transaction deadline
     */
    function migrate(
        address token,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 minTokenAmount,
        uint256 minEthAmount,
        address lpRecipient,
        uint256 deadline
    ) external onlyOwner nonReentrant returns (address pair) {
        require(token != address(0), "Invalid token address");
        require(tokenAmount > 0, "Invalid token amount");
        require(ethAmount > 0, "Invalid ETH amount");
        require(lpRecipient != address(0), "Invalid LP recipient");
        require(deadline > block.timestamp, "Expired deadline");
        require(!migratedTokens[token], "Already migrated");
        
        // Transfer tokens and ETH to this contract
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        
        // Approve router to spend tokens
        IERC20(token).approve(router, tokenAmount);
        
        // Add liquidity to UniswapV2
        (uint256 tokensUsed, uint256 ethUsed, uint256 lpTokens) = IUniswapV2Router02(router).addLiquidityETH{value: ethAmount}(
            token,
            tokenAmount,
            minTokenAmount,
            minEthAmount,
            lpRecipient,
            deadline
        );
        
        // Get pair address
        pair = IUniswapV2Factory(factory).getPair(token, weth);
        require(pair != address(0), "Pair creation failed");
        
        // Update migration state
        migratedTokens[token] = true;
        tokenToPair[token] = pair;
        
        // Refund excess tokens/ETH if any
        if (tokensUsed < tokenAmount) {
            IERC20(token).transfer(msg.sender, tokenAmount - tokensUsed);
        }
        if (ethUsed < ethAmount) {
            payable(msg.sender).transfer(ethAmount - ethUsed);
        }
        
        emit LiquidityMigrated(token, pair, tokensUsed, ethUsed, lpTokens);
    }
    
    /**
     * @dev Get migration status for a token
     */
    function getMigrationStatus(address token) external view returns (
        bool isMigrated,
        address pairAddress,
        uint256 tokenBalance,
        uint256 ethBalance
    ) {
        isMigrated = migratedTokens[token];
        pairAddress = tokenToPair[token];
        tokenBalance = IERC20(token).balanceOf(address(this));
        ethBalance = address(this).balance;
    }
    
    /**
     * @dev Emergency function to recover stuck tokens (owner only)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            // Withdraw ETH
            payable(owner).transfer(address(this).balance);
        } else {
            // Withdraw ERC20 tokens
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).transfer(owner, balance);
            }
        }
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}

// Interfaces for UniswapV2
interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
