// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simple ERC20 with a single minter that can be set once by the owner (your factory).
contract MemeToken is ERC20, Ownable {
    address public minter;
    bool public minterLocked;

    error MinterAlreadyLocked();
    error NotMinter();

    constructor(string memory name_, string memory symbol_, address owner_)
        ERC20(name_, symbol_)
    {
        _transferOwnership(owner_);
    }

    /// @notice Set the bonding curve as the minter. Can only be done once.
    function setMinter(address _minter) external onlyOwner {
        if (minterLocked) revert MinterAlreadyLocked();
        minter = _minter;
        minterLocked = true;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _burn(from, amount);
    }
}
