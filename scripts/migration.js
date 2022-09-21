const { ethers } = require("hardhat");
const fs = require("fs");
const { abi } = require("../artifacts/contracts/Presale.sol/Presale.json")
const { yellow, cyan } = require("colors");

const presaleAddress = "0xB1f21C719e7674c580948Ee048617cE72fAA4eFA"
const depositors = require("../migration/depositor.json")

async function main() {
    const [owner] = await ethers.getSigners();
    console.log("\nMigrating Contracts\n".yellow);

    const presale = new ethers.Contract(presaleAddress, abi, owner)

    // Migrate
    const accounts = depositors.map(d => d.address)
    const deposits = depositors.map(d => ethers.utils.parseUnits(d.amount.toString(), 12))
    await presale.migrateUserDetail(accounts, deposits)
    console.log("\nPresale set migration")
}

main()