//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDOToken is IERC20 {
    function mint(address dest, uint256 amount) external returns (bool);
}

contract IDOPool is Ownable {
    IERC20 public usdc;
    IDOToken public idoToken;

    uint256 public rate;
    uint256 public hardCap;
    uint256 public softCap;
    uint256 public minPerWallet;
    uint256 public maxPerWallet;

    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public purchased;
    mapping(address => uint256) public usdcAmount;

    uint256 public startTime;
    uint256 public endTime;
    uint256 public claimTime;

    address public treasuryWallet;
    uint256 totalIdo;
    uint256 totalUsdc;

    constructor(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _claimTime,
        address _idoToken,
        address _usdc,
        uint256 _rate, // 40
        uint256 _softCap, // 25 * 10 ** 23
        uint256 _hardCap, // 6 * 10 ** 24
        uint256 _maxPerWallet,
        uint256 _minPerWallet,
        address _treasuryWallet
    ) {
        require(
            _endTime > _startTime && _endTime > block.timestamp,
            "Wrong Endtime"
        );
        require(_rate > 0, "Rate is 0");
        require(_idoToken != address(0), "Token Is The Zero Address");
        require(_softCap < _hardCap, "Softcap Must Be Lower Than Hardcap");
        require(_minPerWallet < _maxPerWallet, "Incorrect Limits Per Wallet");
        startTime = _startTime;
        endTime = _endTime;
        claimTime = _claimTime;
        idoToken = IDOToken(_idoToken);
        usdc = IERC20(_usdc);
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
        require(whitelisted[msg.sender] == true, "Not Whitelisted");
        require(_amount != 0, "Presale: weiAmount is 0");
        if (purchased[msg.sender] == 0) {
            require(_amount >= minPerWallet, "Smaller Than Minimum Amount");
        }
        require(totalIdo + _amount <= hardCap, "Exceeds Hardcap");
        require(
            purchased[msg.sender] + _amount <= maxPerWallet,
            "Exceeds Max Per Wallet"
        );
        require(
            usdc.balanceOf(msg.sender) >= _amount / rate,
            "Insufficinet Fund"
        );
        usdc.transferFrom(msg.sender, address(this), _amount / rate);
        totalUsdc += _amount / rate;
        usdcAmount[msg.sender] += _amount / rate;
        purchased[msg.sender] += _amount;
        totalIdo += _amount;
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

    function setStartTime(uint256 value) external onlyOwner {
        startTime = value;
    }

    function setEndTime(uint256 value) external onlyOwner {
        endTime = value;
    }

    function setClaimTime(uint256 value) external onlyOwner {
        claimTime = value;
    }

    function withdraw() external onlyOwner idoNotActive {
        require(totalUsdc > 0, "No USDC To Withdraw");
        if (totalIdo >= softCap) {
            // Success IDO
            usdc.transfer(treasuryWallet, totalUsdc);
        } else {
            //Failed IDO
            usdc.transfer(treasuryWallet, totalUsdc / 10);
        }
        totalUsdc = 0;
    }

    function claimUsdc() external {
        require(totalIdo < softCap, "Won SoftCap"); // Presale Failure
        require(block.timestamp >= endTime, "Ido Not Ended");
        require(usdcAmount[msg.sender] > 0, "No USDC To Claim");
        usdc.transfer(msg.sender, (usdcAmount[msg.sender] * 9) / 10);
        usdcAmount[msg.sender] = 0;
    }

    function claim() external {
        require(block.timestamp >= claimTime, "Claim Not Started");
        require(purchased[msg.sender] > 0, "No Token Bought");
        idoToken.mint(msg.sender, purchased[msg.sender]);
        purchased[msg.sender] = 0;
    }

    modifier idoActive() {
        require(block.timestamp >= startTime, "Presale Not Started");
        require(block.timestamp <= endTime, "Presale Already Ended");
        require(totalIdo < hardCap, "Exceeds Hardcap");
        _;
    }

    modifier idoNotActive() {
        require(
            block.timestamp >= endTime || totalIdo >= hardCap,
            "Presale Should Not Be Active"
        );
        _;
    }
}
