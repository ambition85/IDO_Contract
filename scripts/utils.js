const { ethers, run, upgrades } = require("hardhat");
const { getAddress, keccak256, solidityPack } = require("ethers/lib/utils");

exports.deployPDAYL = async function (deployer) {
	const PresaleDAYL = await ethers.getContractFactory("PresaleDAYL", {
		signer: deployer,
	});

	const pDAYL = await PresaleDAYL.connect(deployer).deploy();
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

exports.deployBUSD = async function (deployer) {
	const BUSD = await ethers.getContractFactory("TestBUSD", {
		signer: deployer,
	});

	const busd = await BUSD.connect(deployer).deploy();
	await busd.deployed();

	return busd;
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