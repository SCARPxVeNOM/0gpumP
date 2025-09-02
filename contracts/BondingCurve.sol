// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MemeToken.sol";

/// @notice Constant-product bonding-curve AMM: x * y = k
/// Base asset is native coin (OG on 0G testnet). Token side is MemeToken.
/// Reserves live in this contract. No LP tokens. Fees go to treasury.
contract BondingCurve is ReentrancyGuard, Ownable {
    using Address for address payable;

    event Seeded(uint256 ogReserve, uint256 tokenReserve);
    event Buy(address indexed buyer, uint256 ogIn, uint256 tokensOut, uint256 priceImpact);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ogOut, uint256 priceImpact);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);

    MemeToken public immutable token;
    address public treasury;

    // basis points (e.g., 50 = 0.50%, 100 = 1.00%). Applied symmetrically on buys/sells (in OG).
    uint16 public feeBps;

    // Reserves held by this contract
    uint256 public ogReserve;       // native coin reserve (OG)
    uint256 public tokenReserve;    // token reserve

    bool public seeded;

    error AlreadySeeded();
    error InvalidParams();
    error InsufficientOutput();
    error DeadlineExpired();

    constructor(address _token, address _owner, address _treasury, uint16 _feeBps) {
        require(_token != address(0) && _treasury != address(0), "zero addr");
        token = MemeToken(_token);
        treasury = _treasury;
        feeBps = _feeBps;
        _transferOwnership(_owner);
    }

    /// @notice One-time seeding of initial liquidity. Owner mints token inventory here and sends OG.
    /// @param initialTokenAmount amount of tokens to deposit as starting inventory (minted by token minter).
    function seed(uint256 initialTokenAmount) external payable onlyOwner nonReentrant {
        if (seeded) revert AlreadySeeded();
        if (msg.value == 0 || initialTokenAmount == 0) revert InvalidParams();

        // Mint initial token inventory directly to this contract as reserve
        token.mint(address(this), initialTokenAmount);

        ogReserve = msg.value;
        tokenReserve = initialTokenAmount;
        seeded = true;

        emit Seeded(ogReserve, tokenReserve);
    }

    /// @notice Buy tokens with OG (native coin).
    /// @param minTokensOut slippage protection
    /// @param deadline unix timestamp after which the tx is invalid
    function buy(uint256 minTokensOut, uint256 deadline) external payable nonReentrant {
        if (!seeded) revert InvalidParams();
        if (block.timestamp > deadline) revert DeadlineExpired();
        uint256 ogIn = msg.value;
        require(ogIn > 0, "no OG");

        // Take fee in OG
        uint256 fee = (ogIn * feeBps) / 10_000;
        uint256 ogInAfterFee = ogIn - fee;

        // x*y=k ⇒ tokensOut = tokenRes - (k / (ogRes + ogInAfterFee))
        uint256 k = ogReserve * tokenReserve;
        uint256 newOgReserve = ogReserve + ogInAfterFee;
        uint256 newTokenReserve = k / newOgReserve;
        uint256 tokensOut = tokenReserve - newTokenReserve;

        if (tokensOut < minTokensOut) revert InsufficientOutput();

        // Effects
        ogReserve = newOgReserve;
        tokenReserve = newTokenReserve;

        // Interactions
        if (fee > 0) payable(treasury).sendValue(fee);
        token.transfer(msg.sender, tokensOut);

        // A rough measure of price impact: tokensOut vs input (not exact)
        emit Buy(msg.sender, ogIn, tokensOut, (tokensOut * 1e18) / (ogInAfterFee));
    }

    /// @notice Sell tokens for OG.
    /// @param tokensIn amount of tokens to sell
    /// @param minOgOut slippage protection
    /// @param deadline unix timestamp after which the tx is invalid
    function sell(uint256 tokensIn, uint256 minOgOut, uint256 deadline) external nonReentrant {
        if (!seeded) revert InvalidParams();
        if (block.timestamp > deadline) revert DeadlineExpired();
        require(tokensIn > 0, "no tokens");

        // Pull tokens in
        token.transferFrom(msg.sender, address(this), tokensIn);

        // x*y=k ⇒ ogOut = ogRes - (k / (tokenRes + tokensIn))
        uint256 k = ogReserve * tokenReserve;
        uint256 newTokenReserve = tokenReserve + tokensIn;
        uint256 newOgReserve = k / newTokenReserve;
        uint256 ogOutBeforeFee = ogReserve - newOgReserve;

        // Fee in OG
        uint256 fee = (ogOutBeforeFee * feeBps) / 10_000;
        uint256 ogOut = ogOutBeforeFee - fee;
        if (ogOut < minOgOut) revert InsufficientOutput();

        // Effects
        ogReserve = newOgReserve;
        tokenReserve = newTokenReserve;

        // Interactions
        if (fee > 0) payable(treasury).sendValue(fee);
        payable(msg.sender).sendValue(ogOut);

        emit Sell(msg.sender, tokensIn, ogOut, (ogOut * 1e18) / (tokensIn));
    }

    // --- Admin ---

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee too high"); // max 10%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "zero addr");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // Safety receive to reject unexpected plain sends after seed
    receive() external payable {
        // allow top-ups (e.g., platform adds OG) — counted as ogReserve growth
        ogReserve += msg.value;
    }
}
