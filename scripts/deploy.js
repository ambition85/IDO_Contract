const { ethers } = require("hardhat");
const fs = require("fs");
const { yellow, cyan } = require("colors");
const { deployPDAYL, deployPresale, deployBUSD, verifyContract } = require("./utils")
const { config } = require("./config")

async function main() {
    const [owner] = await ethers.getSigners();
    console.log("\nDeploying Contracts\n".yellow);

    // // Only once for testing, no need to deploy again
    // const busd = await deployBUSD(owner)
    // console.log("\nPresale BUSD Token deployed at: \n".yellow, busd.address);
    // await verifyContract(busd.address, [])

    const pDAYL = await deployPDAYL(owner)
    console.log("\nPresale DAYL Token deployed at: \n".yellow, pDAYL.address);
    await verifyContract(pDAYL.address, [])

    const presaleParams = [
        config.startTime, //_startTime,
        config.endTime, // _endTime,
        config.claimTime, // _claimTime,
        pDAYL.address, // _presaleDAYL,
        config.busd, // _busd,
        ethers.utils.parseUnits(config.rate, 12), // _rate,
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

    await pDAYL.setPresale(presale.address)
    console.log("\nPresale token set presale contract")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });