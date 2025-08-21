// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BondingCurveAMM
 * @dev Implements a step-function bonding curve AMM similar to pump.fun
 * Features: Step pricing, graduation to DEX, buy/sell functionality
 * Updated for 0G testnet (uses native 0G tokens instead of ERC20)
 */
contract BondingCurveAMM {
    
    // Token being traded on the curve
    address public immutable token;
    
    // Curve configuration
    uint256 public immutable basePrice;        // Starting price per token (in wei)
    uint256 public immutable stepSize;         // Price increase per step (in wei)
    uint256 public immutable stepQty;          // Tokens available per step
    uint256 public immutable curveCap;         // Total tokens available on curve
    uint256 public immutable feeBps;           // Protocol fee percentage (basis points)
    address public immutable feeRecipient;     // Address to receive fees
    
    // Curve state
    uint256 public tokensSoldOnCurve;          // Total tokens sold
    uint256 public nativeReserve;              // Native 0G tokens collected
    bool public graduated;                     // Whether curve has graduated to DEX
    
    // Owner
    address public owner;
    
    // Reentrancy guard
    bool private _locked;
    
    // Events
    event Trade(
        address indexed trader, 
        bool isBuy, 
        uint256 qty, 
        uint256 costOrProceeds, 
        uint256 stepIndex
    );
    event Graduated(
        uint256 tokensSoldOnCurve, 
        uint256 nativeReserve, 
        uint256 timestamp
    );
    event StepAdvanced(uint256 newStep, uint256 newPrice);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier notGraduated() {
        require(!graduated, "Curve graduated");
        _;
    }
    
    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _basePrice,
        uint256 _stepSize,
        uint256 _stepQty,
        uint256 _curveCap,
        uint256 _feeBps,
        address _feeRecipient
    ) {
        require(_basePrice > 0, "Base price must be > 0");
        require(_stepSize > 0, "Step size must be > 0");
        require(_stepQty > 0, "Step qty must be > 0");
        require(_curveCap > 0, "Curve cap must be > 0");
        require(_feeBps <= 1000, "Fee cannot exceed 10%");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        basePrice = _basePrice;
        stepSize = _stepSize;
        stepQty = _stepQty;
        curveCap = _curveCap;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        owner = msg.sender;
        
        // Deploy a simple ERC20 token for this curve
        token = address(new ProjectToken(name, symbol, address(this)));
    }
    
    /**
     * @dev Calculate the current step based on tokens sold
     */
    function getCurrentStep() public view returns (uint256) {
        return tokensSoldOnCurve / stepQty;
    }
    
    /**
     * @dev Calculate the current price per token
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 currentStep = getCurrentStep();
        return basePrice + (currentStep * stepSize);
    }
    
    /**
     * @dev Calculate how many tokens can be bought with given native amount
     */
    function quoteBuy(uint256 qty) public view notGraduated returns (uint256) {
        require(qty > 0, "Invalid quantity");
        require(tokensSoldOnCurve + qty <= curveCap, "Exceeds curve cap");
        
        uint256 totalCost = 0;
        uint256 remainingQty = qty;
        uint256 currentStep = getCurrentStep();
        uint256 tokensSoldInCurrentStep = tokensSoldOnCurve % stepQty;
        
        while (remainingQty > 0) {
            uint256 tokensAvailableInStep = stepQty - tokensSoldInCurrentStep;
            uint256 tokensToBuyInStep = remainingQty > tokensAvailableInStep ? tokensAvailableInStep : remainingQty;
            
            uint256 currentPrice = basePrice + (currentStep * stepSize);
            totalCost += tokensToBuyInStep * currentPrice;
            
            remainingQty -= tokensToBuyInStep;
            tokensSoldInCurrentStep += tokensToBuyInStep;
            
            if (tokensSoldInCurrentStep >= stepQty) {
                currentStep++;
                tokensSoldInCurrentStep = 0;
            }
        }
        
        return totalCost;
    }
    
    /**
     * @dev Calculate how much native tokens received for selling tokens
     */
    function quoteSell(uint256 qty) public view notGraduated returns (uint256) {
        require(qty > 0, "Invalid quantity");
        require(qty <= tokensSoldOnCurve, "Cannot sell more than sold");
        
        uint256 totalReceived = 0;
        uint256 remainingQty = qty;
        uint256 currentStep = getCurrentStep();
        uint256 tokensSoldInCurrentStep = tokensSoldOnCurve % stepQty;
        
        while (remainingQty > 0 && currentStep >= 0) {
            uint256 tokensInCurrentStep = tokensSoldInCurrentStep;
            uint256 tokensToSellInStep = remainingQty > tokensInCurrentStep ? tokensInCurrentStep : remainingQty;
            
            uint256 currentPrice = basePrice + (currentStep * stepSize);
            totalReceived += tokensToSellInStep * currentPrice;
            
            remainingQty -= tokensToSellInStep;
            tokensSoldInCurrentStep -= tokensToSellInStep;
            
            if (tokensSoldInCurrentStep == 0 && currentStep > 0) {
                currentStep--;
                tokensSoldInCurrentStep = stepQty;
            }
        }
        
        return totalReceived;
    }
    
    /**
     * @dev Buy tokens with native 0G tokens
     */
    function buy(uint256 qty, uint256 maxCost) external payable nonReentrant notGraduated {
        require(qty > 0, "Invalid quantity");
        require(msg.value > 0, "Must send native tokens");
        require(tokensSoldOnCurve + qty <= curveCap, "Exceeds curve cap");
        
        uint256 totalCost = quoteBuy(qty);
        require(totalCost <= maxCost, "Slippage exceeded");
        require(msg.value >= totalCost, "Insufficient payment");
        
        // Calculate and transfer fees
        uint256 feeAmount = (totalCost * feeBps) / 10000;
        uint256 netCost = totalCost - feeAmount;
        
        // Update curve state
        tokensSoldOnCurve += qty;
        nativeReserve += netCost;
        
        // Mint tokens to buyer
        ProjectToken(token).mint(msg.sender, qty);
        
        // Transfer fees to recipient
        if (feeAmount > 0) {
            payable(feeRecipient).transfer(feeAmount);
        }
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        // Check for graduation
        if (tokensSoldOnCurve >= curveCap) {
            _graduate();
        }
        
        emit Trade(msg.sender, true, qty, totalCost, getCurrentStep());
        
        // Emit step advancement if needed
        uint256 newStep = getCurrentStep();
        if (newStep > getCurrentStep()) {
            emit StepAdvanced(newStep, getCurrentPrice());
        }
    }
    
    /**
     * @dev Sell tokens for native 0G tokens
     */
    function sell(uint256 qty, uint256 minReturn) external nonReentrant notGraduated {
        require(qty > 0, "Invalid quantity");
        require(qty <= tokensSoldOnCurve, "Cannot sell more than sold");
        
        uint256 totalReceived = quoteSell(qty);
        require(totalReceived >= minReturn, "Slippage exceeded");
        require(totalReceived <= nativeReserve, "Insufficient reserve");
        
        // Calculate and transfer fees
        uint256 feeAmount = (totalReceived * feeBps) / 10000;
        uint256 netReceived = totalReceived - feeAmount;
        
        // Update curve state
        tokensSoldOnCurve -= qty;
        nativeReserve -= totalReceived;
        
        // Burn tokens from seller
        ProjectToken(token).burn(msg.sender, qty);
        
        // Transfer native tokens to seller
        payable(msg.sender).transfer(netReceived);
        
        // Transfer fees to recipient
        if (feeAmount > 0) {
            payable(feeRecipient).transfer(feeAmount);
        }
        
        emit Trade(msg.sender, false, qty, totalReceived, getCurrentStep());
    }
    
    /**
     * @dev Graduate curve to DEX (called automatically when curve fills)
     */
    function _graduate() internal {
        graduated = true;
        emit Graduated(tokensSoldOnCurve, nativeReserve, block.timestamp);
    }
    
    /**
     * @dev Get curve statistics
     */
    function getCurveStats() external view returns (
        uint256 currentStep,
        uint256 currentPrice,
        uint256 tokensSold,
        uint256 nativeReserveAmount,
        bool isGraduated,
        uint256 remainingTokens
    ) {
        currentStep = getCurrentStep();
        currentPrice = getCurrentPrice();
        tokensSold = tokensSoldOnCurve;
        nativeReserveAmount = nativeReserve;
        isGraduated = graduated;
        remainingTokens = curveCap - tokensSoldOnCurve;
    }
    
    /**
     * @dev Emergency function to recover stuck tokens (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        require(graduated, "Can only withdraw after graduation");
        payable(owner).transfer(address(this).balance);
    }
    
    // Allow contract to receive native tokens
    receive() external payable {}
}

/**
 * @title ProjectToken
 * @dev Simple ERC20 token for the bonding curve
 */
contract ProjectToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    address public immutable owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can mint/burn");
        _;
    }
    
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    ) {
        name = _name;
        symbol = _symbol;
        owner = _owner;
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyOwner {
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
