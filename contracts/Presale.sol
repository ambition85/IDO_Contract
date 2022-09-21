//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPresaleDAYL.sol";
import "hardhat/console.sol";

contract Presale is Ownable {
    IERC20 public busd;
    IPresaleDAYL public presaleDAYL;

    // Rate of BUSD and presale DAYL = 1: 40
    uint256 public rate;

    // hardcap of 6M * 1e18
    uint256 public hardCap;

    // Softcap of 2.5M * 1e18
    uint256 public softCap;

    // Minimum deposit 30 * 1e18
    uint256 public minPerWallet;

    // Maximum deposit 30000 * 1e18
    uint256 public maxPerWallet;

    // // Total Vesting Period
    // uint256 public vestingPeriod;

    // // Unvesting Gap
    // uint256 public unVestingGap;

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

    // Address for Treasury wallet - BUSD invest should go there
    address public treasury;

    // Address for Vault wallet - BUSD invest should go there
    address public vault;

    // Ratio of busd withdraw between vault and treasury
    uint256 public vaultRatio;

    // Total Amount Presaled
    uint256 public totalPresale;

    // Total BUSD deposited
    uint256 public totalBUSD;

    // Flag for users to withdraw busd
    bool public busdWithdrawable;

    struct PresaleInfo {
        uint256 _startTime;
        uint256 _endTime;
        uint256 _claimTime;
        address _presaleDAYL;
        address _busd;
        uint256 _rate;
        uint256 _softCap;
        uint256 _hardCap;
        uint256 _maxPerWallet;
        uint256 _minPerWallet;
        // uint256 _vestingPeriod;
        // uint256 _unVestingGap;
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
        busd = IERC20(info._busd);

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
        // vestingPeriod = info._vestingPeriod;
        // unVestingGap = info._unVestingGap;
        vaultRatio = 10;
    }

    event Deposit(address account, uint256 depositBUSD, uint256 reward);
    event Withdraw(address account, uint256 withdrawBUSD);
    event ClaimToken(address account, uint256 reward);
    event MoveFunds(uint256 toVault, uint256 toTreasury);

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
        uint256 depositBUSD = _amount / rate;
        UserDetail storage user = userInfo[msg.sender];

        // Check Hardcap
        require(totalBUSD + depositBUSD <= hardCap, "Exceeds Hardcap");

        // Check min and max deposit amount
        require(
            (depositBUSD > 0 &&
                user.depositAmount + depositBUSD >= minPerWallet &&
                user.depositAmount + depositBUSD <= maxPerWallet),
            "Invalid BUSD deposit"
        );

        // Receive BUSD from user
        uint256 toVault = (depositBUSD * vaultRatio) / 100;

        busd.transferFrom(msg.sender, vault, toVault);
        busd.transferFrom(msg.sender, treasury, depositBUSD - toVault);

        // Update User Info
        user.depositAmount += depositBUSD;
        user.totalReward += _amount;

        // Update Total Info
        totalBUSD += depositBUSD;
        totalPresale += _amount;

        emit Deposit(msg.sender, depositBUSD, _amount);
    }

    function withdraw() external {
        // Revert presale not ended or softcap reached
        require(
            block.timestamp >= claimTime &&
                totalBUSD < softCap &&
                busdWithdrawable,
            "Unable to withdraw"
        );

        // Calculate User's withdrawable amount, e.g. deposit * 0.9
        UserDetail storage user = userInfo[msg.sender];
        uint256 withdrawable = (user.depositAmount * (100 - vaultRatio)) / 100;

        require(withdrawable > 0, "No BUSD To Withdraw");

        // Transfer busd to user
        busd.transfer(msg.sender, withdrawable);
        user.depositAmount = 0;

        emit Withdraw(msg.sender, withdrawable);
    }

    function claimableAmount(address account) public view returns (uint256) {
        if (block.timestamp < claimTime || totalBUSD < softCap) return 0;
        UserDetail storage user = userInfo[account];

        // // Calculate how many rounds have passed so far
        // uint256 round = (block.timestamp - claimTime) / unVestingGap + 1;

        // // Calculate Total Rounds for this vesting program
        // uint256 totalRound = vestingPeriod / unVestingGap;

        // // if round is bigger than total, make it the same as round
        // if (round > totalRound) round = totalRound;

        uint256 claimable = user.totalReward - user.withdrawnReward;
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

    function withdrawRest() external onlyOwner {
        uint256 busdBal = busd.balanceOf(address(this));
        busd.transfer(vault, busdBal);
    }

    function setVaultRatio(uint256 _vaultRatio) external onlyOwner {
        require(_vaultRatio <= 100, "Invalid Ratio Value");
        vaultRatio = _vaultRatio;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid Treasury Address");
        treasury = _treasury;
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault Address");
        vault = _vault;
    }

    function setWithdrawable() external onlyOwner {
        busdWithdrawable = true;
    }

    function setHardCap(uint256 _hardCap) external onlyOwner {
        require(hardCap > 0, "Invalid HardCap");
        hardCap = _hardCap;
    }

    function setSoftCap(uint256 _softCap) external onlyOwner {
        require(softCap > 0, "Invalid SoftCap");
        softCap = _softCap;
    }

    function setStartTime(uint256 _startTime) external onlyOwner {
        startTime = _startTime;
    }

    function setEndTime(uint256 _endTime) external onlyOwner {
        require(_endTime > 0, "Invalid EndTime");
        endTime = _endTime;
    }

    function setClaimTime(uint256 _claimTime) external onlyOwner {
        require(_claimTime > 0, "Invalid ClaimTime");
        claimTime = _claimTime;
    }

    function migrateUserDetail(
        address[] memory _accounts,
        uint256[] memory _deposits
    ) external onlyOwner {
        require(_accounts.length == _deposits.length, "LENGTH_MISMATCH");

        for (uint256 i = 0; i < _accounts.length; i++) {
            UserDetail storage user = userInfo[_accounts[i]];

            user.depositAmount = _deposits[i];
            user.totalReward = _deposits[i] * rate;
            user.withdrawnReward = 0;

            // Update Total Info
            totalBUSD += _deposits[i];
            totalPresale += _deposits[i] * rate;
        }
    }

    function setTotal(uint256 _totalBUSD) public onlyOwner {
        totalBUSD = _totalBUSD;
        totalPresale = _totalBUSD * rate;
    }
}
