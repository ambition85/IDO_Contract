const { ethers, run, upgrades } = require("hardhat");
const { getAddress, keccak256, solidityPack } = require("ethers/lib/utils");

exports.deployPDAYL = async function (deployer, params) {
	const PresaleDAYL = await ethers.getContractFactory("PresaleDAYL", {
		signer: deployer,
	});

	const pDAYL = await PresaleDAYL.connect(deployer).deploy(params);
	await pDAYL.deployed();

	return pDAYL;
};

exports.deployPresale = async function (deployer, params) {
	const Presale = await ethers.getContractFactory("Presale", {
		signer: deployer,
	});

	const p = await Presale.connect(deployer).deploy(params);
	await p.deployed();

	return p;
};

exports.deployUSDC = async function (deployer) {
	const USDC = await ethers.getContractFactory("TestUSDC", {
		signer: deployer,
	});

	const usdc = await USDC.connect(deployer).deploy();
	await usdc.deployed();

	return usdc;
};

exports.verifyContract = async function (contract, params) {
	try {
		// Verify
		console.log("Verifying: ", contract);
		await run("verify:verify", {
			address: contract,
			constructorArguments: params,
		});
	} catch (error) {
		if (error && error.message.includes("Reason: Already Verified")) {
			console.log("Already verified, skipping...");
		} else {
			console.error(error);
		}
	}
};