//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDOToken is IERC20 {
    function mint(address dest, uint256 amount) external returns (bool);
}

contract IDOPool is Ownable {
    IERC20 public usdc = IERC20(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
    IDOToken public idoToken;

    uint256 public rate; // 40 
    uint256 public hardCap; // 6M
    uint256 public softCap; // 2.5M
    uint256 public minPerWallet;
    uint256 public maxPerWallet;

    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public purchased;

    uint256 public startTime;
    uint256 public endTime;

    address public treasuryWallet;
    uint256 totalPurchased;

    constructor(
        uint256 _startTime,
        uint256 _endTime,
        address _idoToken,
        uint256 _rate, 
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _maxPerWallet,
        uint256 _minPerWallet,
        address _treasuryWallet
    ) {
        require(
            _endTime > _startTime && _endTime > block.timestamp,
            "Wrong endtime"
        );
        require(_rate > 0, "Rate is 0");
        require(_idoToken != address(0), "Token is the zero address");
        require(_softCap < _hardCap, "Softcap must be lower than Hardcap");
        require(_minPerWallet < _maxPerWallet, "Incorrect limits per wallet");
        startTime = _startTime;
        endTime = _endTime;
        idoToken = IDOToken(_idoToken);
        rate = _rate;
        softCap = _softCap;
        hardCap = _hardCap;
        treasuryWallet = _treasuryWallet;
        maxPerWallet = _maxPerWallet;
        minPerWallet = _minPerWallet;
        _transferOwnership(_treasuryWallet);
    }

    function addWhitelists(address[] memory _whitelist) external onlyOwner {
        for (uint256 i = 0; i < _whitelist.length; i++) {
            whitelisted[_whitelist[i]] = true;
        }
    }

    function removeWhitelists(address[] memory _whitelist) external onlyOwner {
        for (uint256 i = 0; i < _whitelist.length; i++) {
            whitelisted[_whitelist[i]] = false;
        }
    }

    function purchase(uint256 _amount) external idoActive {
        require(whitelisted[msg.sender] == true, "not whitelisted");
        require(_amount != 0, "Presale: weiAmount is 0");
        if (purchased[msg.sender] == 0) {
            require(_amount >= minPerWallet, "Smaller than minimum amount");
        }
        require(
            purchased[msg.sender] + _amount <= maxPerWallet,
            "Exceeds max per wallet"
        );
        require(totalPurchased + _amount <= hardCap, "Exceeds Hard Cap");
        require(
            usdc.balanceOf(msg.sender) >= _amount / rate,
            "Insufficinet Fund"
        );
        usdc.transferFrom(msg.sender, treasuryWallet, _amount / rate);
        idoToken.mint(msg.sender, _amount);
        purchased[msg.sender] += _amount;
        totalPurchased += _amount;
    }

    function setRate(uint256 newRate) external onlyOwner {
        rate = newRate;
    }

    function setHardCap(uint256 value) external onlyOwner {
        hardCap = value;
    }

    function setSoftCap(uint256 value) external onlyOwner {
        softCap = value;
    }

    modifier idoActive() {
        require(
            block.timestamp >= startTime && block.timestamp <= endTime,
            "Presale must be active"
        );
        _;
    }

    modifier idoNotActive() {
        require(block.timestamp >= endTime, "Presale should not be active");
        _;
    }
}
