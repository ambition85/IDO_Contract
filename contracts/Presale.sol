//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPresaleDAYL.sol";
import "hardhat/console.sol";

contract Presale is Ownable {
    IERC20 public usdc;
    IPresaleDAYL public presaleDAYL;

    // Rate of USDC and presale DAYL = 1: 40 * 1e12
    uint256 public rate;

    // hardcap of 6M * 1e6
    uint256 public hardCap;

    // Softcap of 2.5M * 1e6
    uint256 public softCap;

    // Minimum deposit 30 * 1e6
    uint256 public minPerWallet;

    // Maximum deposit 30000 * 1e6
    uint256 public maxPerWallet;

    // Total Vesting Period
    uint256 public vestingPeriod;

    // Unvesting Gap
    uint256 public unVestingGap;

    struct UserDetail {
        uint256 depositAmount;
        uint256 totalReward;
        uint256 withdrawnReward;
    }

    mapping(address => bool) public whitelisted;
    mapping(address => UserDetail) public userInfo;

    // Time for Presale Start
    uint256 public startTime;

    // Time for Presale End
    uint256 public endTime;

    // Time for Distribution
    uint256 public claimTime;

    // Address for Treasury wallet - USDC invest should go there
    address public treasury;

    // Address for Vault wallet - USDC invest should go there
    address public vault;

    // Ratio of usdc withdraw between vault and treasury
    uint256 public vaultRatio;

    // minimum vault ratio
    uint256 public minToVault;

    // Total Amount Presaled
    uint256 public totalPresale;

    // Total USDC deposited
    uint256 public totalUSDC;

    struct PresaleInfo {
        uint256 _startTime;
        uint256 _endTime;
        uint256 _claimTime;
        address _presaleDAYL;
        address _usdc;
        uint256 _rate;
        uint256 _softCap;
        uint256 _hardCap;
        uint256 _maxPerWallet;
        uint256 _minPerWallet;
        uint256 _vestingPeriod;
        uint256 _unVestingGap;
        address _treasury;
        address _vault;
    }

    constructor(PresaleInfo memory info) {
        require(
            info._endTime > info._startTime &&
                info._claimTime > info._endTime &&
                info._endTime > block.timestamp,
            "Wrong Endtime"
        );
        require(info._rate > 0, "Invalid Presale Rate");
        require(
            info._presaleDAYL != address(0),
            "Invalid Presale Token Address"
        );
        require(
            info._softCap < info._hardCap,
            "Softcap Must Be Lower Than Hardcap"
        );
        require(
            info._minPerWallet < info._maxPerWallet,
            "Incorrect Limits Per Wallet"
        );

        // Configure time frames for presale
        startTime = info._startTime;
        endTime = info._endTime;
        claimTime = info._claimTime;

        // Configure Token address
        presaleDAYL = IPresaleDAYL(info._presaleDAYL);
        usdc = IERC20(info._usdc);

        // Configure Presale Details
        rate = info._rate;
        softCap = info._softCap;
        hardCap = info._hardCap;

        // Configure Owner and Vault Address
        treasury = info._treasury;
        vault = info._vault;

        // Configure Wallet Amount
        maxPerWallet = info._maxPerWallet;
        minPerWallet = info._minPerWallet;

        // Configure Vesting
        vestingPeriod = info._vestingPeriod;
        unVestingGap = info._unVestingGap;

        // Set treasury address as owner of presale
        _transferOwnership(info._treasury);
    }

    event Deposit(address account, uint256 depositUSDC, uint256 reward);
    event Withdraw(address account, uint256 withdrawUSDC);
    event ClaimToken(address account, uint256 reward);

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

    function deposit(uint256 _amount) external {
        require(block.timestamp >= startTime, "Presale Not Started");
        require(block.timestamp <= endTime, "Presale Already Ended");
        require(whitelisted[msg.sender], "Not Whitelisted User");
        uint256 depositUSDC = _amount / rate;
        UserDetail storage user = userInfo[msg.sender];

        // Check Hardcap
        require(totalUSDC + depositUSDC <= hardCap, "Exceeds Hardcap");

        // Check min and max deposit amount
        require(
            (depositUSDC > 0 &&
                user.depositAmount + depositUSDC >= minPerWallet &&
                user.depositAmount + depositUSDC <= maxPerWallet),
            "Invalid USDC deposit"
        );

        // Receive USDC from user
        usdc.transferFrom(msg.sender, address(this), depositUSDC);

        // Update User Info
        user.depositAmount += depositUSDC;
        user.totalReward += _amount;

        // Update Total Info
        totalUSDC += depositUSDC;
        totalPresale += _amount;

        emit Deposit(msg.sender, depositUSDC, _amount);
    }

    function withdraw() external {
        // Revert presale not ended or softcap reached
        require(
            block.timestamp >= claimTime && totalUSDC < softCap,
            "Unable to withdraw"
        );

        // Calculate User's withdrawable amount, e.g. deposit * 0.9
        UserDetail storage user = userInfo[msg.sender];
        uint256 withdrawable = (user.depositAmount * (100 - minToVault)) / 100;

        require(withdrawable > 0, "No USDC To Withdraw");

        // Transfer usdc to user
        usdc.transfer(msg.sender, withdrawable);
        user.depositAmount = 0;

        emit Withdraw(msg.sender, withdrawable);
    }

    function claimableAmount(address account) public view returns (uint256) {
        if (block.timestamp < claimTime || totalUSDC < softCap) return 0;
        UserDetail storage user = userInfo[account];

        // Calculate how many rounds have passed so far
        uint256 round = (block.timestamp - claimTime) / unVestingGap + 1;

        // Calculate Total Rounds for this vesting program
        uint256 totalRound = vestingPeriod / unVestingGap;

        // if round is bigger than total, make it the same as round
        if (round > totalRound) round = totalRound;

        uint256 claimable = (user.totalReward * round) /
            totalRound -
            user.withdrawnReward;
        return claimable;
    }

    function claimToken() external {
        UserDetail storage user = userInfo[msg.sender];
        uint256 claimable = claimableAmount(msg.sender);
        require(claimable > 0, "Unable to claim any tokens");

        // Mint Presale Daylight Token to user
        presaleDAYL.mint(msg.sender, claimable);

        // Increase user's withdrawn amount by claimed amount
        user.withdrawnReward += claimable;

        emit ClaimToken(msg.sender, claimable);
    }

    function moveFunds() external onlyOwner {
        require(
            block.timestamp >= endTime || totalUSDC >= hardCap,
            "Presale Not Ended"
        );
        require(totalUSDC > 0, "No USDC To Withdraw");

        uint256 toVault;
        uint256 toTreasury;

        if (totalUSDC >= softCap) {
            // Success Presale
            toVault = (totalUSDC * vaultRatio) / 100;
            toTreasury = (totalUSDC * (100 - vaultRatio)) / 100;
        } else {
            //Failed Presale
            toVault = (totalUSDC * minToVault) / 100;
        }

        if (toVault > 0) usdc.transfer(vault, toVault);
        if (toTreasury > 0) usdc.transfer(treasury, toTreasury);
    }

    function setVaultRatio(uint256 _vaultRatio) external onlyOwner {
        require(_vaultRatio <= 100, "Invalid Ratio Value");
        vaultRatio = _vaultRatio;
    }

    function setMinVault(uint256 _minToVault) external onlyOwner {
        require(_minToVault < 100, "Invlaid Mimum Amount for Vault");
        minToVault = _minToVault;
    }
}
