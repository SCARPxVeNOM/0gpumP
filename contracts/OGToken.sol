// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OGToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    // 0G Storage integration
    bytes32 public metadataRootHash;
    bytes32 public imageRootHash;
    string public description;
    address public creator;
    uint256 public createdAt;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event TokenCreated(
        address indexed creator,
        string name,
        string symbol,
        bytes32 metadataRootHash,
        bytes32 imageRootHash,
        uint256 initialSupply
    );
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 initialSupply,
        string memory _description,
        bytes32 _metadataRootHash,
        bytes32 _imageRootHash
    ) {
        name = _name;
        symbol = _symbol;
        description = _description;
        metadataRootHash = _metadataRootHash;
        imageRootHash = _imageRootHash;
        creator = msg.sender;
        createdAt = block.timestamp;
        
        _mint(msg.sender, initialSupply);
        
        emit TokenCreated(
            msg.sender,
            _name,
            _symbol,
            _metadataRootHash,
            _imageRootHash,
            initialSupply
        );
    }
    
    // Update 0G Storage metadata
    function updateMetadata(
        string memory _description,
        bytes32 _metadataRootHash,
        bytes32 _imageRootHash
    ) external {
        require(msg.sender == creator, "Only creator can update metadata");
        description = _description;
        metadataRootHash = _metadataRootHash;
        imageRootHash = _imageRootHash;
    }
    
    // Get token metadata
    function getMetadata() external view returns (
        string memory _name,
        string memory _symbol,
        string memory _description,
        bytes32 _metadataRootHash,
        bytes32 _imageRootHash,
        address _creator,
        uint256 _createdAt
    ) {
        return (
            name,
            symbol,
            description,
            metadataRootHash,
            imageRootHash,
            creator,
            createdAt
        );
    }
    
    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
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
}

