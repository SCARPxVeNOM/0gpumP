// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MemeToken.sol";
import "./BondingCurve.sol";

/// @notice One-shot creator: deploys a MemeToken + BondingCurve and seeds initial liquidity.
/// Send OG (testnet native) with the tx; factory mints initial token inventory into the curve.
contract Factory {
    event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens);

    address public immutable treasury;
    uint16  public immutable defaultFeeBps;

    constructor(address _treasury, uint16 _defaultFeeBps) {
        require(_treasury != address(0), "zero treasury");
        require(_defaultFeeBps <= 1000, "fee too high");
        treasury = _treasury;
        defaultFeeBps = _defaultFeeBps;
    }

    /// @param name ERC-20 name
    /// @param symbol ERC-20 symbol
    /// @param seedTokenAmount initial token inventory to deposit into the curve reserves
    /// @dev send OG along with this tx to seed the OG side of the pool.
    function createPair(
        string calldata name,
        string calldata symbol,
        uint256 seedTokenAmount
    ) external payable returns (address tokenAddr, address curveAddr) {
        require(msg.value > 0, "send OG to seed");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "bad meta");
        require(seedTokenAmount > 0, "zero token seed");

        // 1) Deploy token; owner = this factory so it can set minter once
        MemeToken token = new MemeToken(name, symbol, address(this));

        // 2) Deploy curve; set owner = this factory temporarily so it can seed
        BondingCurve curve = new BondingCurve(address(token), address(this), treasury, defaultFeeBps);

        // 3) Set curve as token minter (one-time), then lock
        token.setMinter(address(curve));

        // 4) Seed: mint initial token inventory to curve + forward OG to curve.seed()
        // We call curve.seed, which mints tokens (via token.mint) and locks both reserves.
        (bool ok, ) = address(curve).call{value: msg.value}(
            abi.encodeWithSelector(BondingCurve.seed.selector, seedTokenAmount)
        );
        require(ok, "seed failed");

        // 5) Transfer curve ownership to the creator
        curve.transferOwnership(msg.sender);

        emit PairCreated(address(token), address(curve), msg.sender, name, symbol, msg.value, seedTokenAmount);
        return (address(token), address(curve));
    }
}
