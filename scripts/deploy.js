const { ethers } = require("hardhat");
const fs = require("fs");
const { yellow, cyan } = require("colors");
const { deployPDAYL, deployPresale, deployUSDC, verifyContract } = require("./utils")
const { config } = require("./config")

async function main() {
    const [owner] = await ethers.getSigners();
    console.log("\nDeploying Contracts\n".yellow);

    // // Only once for testing, no need to deploy again
    // const usdc = await deployUSDC(owner)
    // console.log("\nPresale USDC Token deployed at: \n".yellow, usdc.address);
    // await verifyContract(usdc.address, [])

    const pDAYL = await deployPDAYL(owner, config.treasury)
    console.log("\nPresale DAYL Token deployed at: \n".yellow, pDAYL.address);
    await verifyContract(pDAYL.address, [config.treasury])

    const presaleParams = [
        config.startTime, //_startTime,
        config.endTime, // _endTime,
        config.claimTime, // _claimTime,
        pDAYL.address, // _presaleDAYL,
        config.usdc, // _usdc,
        utils.parseUnits(config.rate, 12), // _rate,
        ethers.utils.parseUnits(config.softCap, 6), // _softCap - 20,000,
        ethers.utils.parseUnits(config.hardCap, 6), // _hardCap,
        ethers.utils.parseUnits(config.maxPerWallet, 6), // _maxPerWallet,
        ethers.utils.parseUnits(config.minPerWallet, 6), // _minPerWallet,
        config.vestingPeriod, // _vestingPeriod: 5 month,
        config.unvestingGap, //_unVestingGap,
        config.treasury, // _treasury
        config.vault, // _vault
    ]
    const presale = await deployPresale(owner, presaleParams)
    console.log("\nPresale deployed at: \n".yellow, presale.address);
    await verifyContract(presale.address, [presaleParams])
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });