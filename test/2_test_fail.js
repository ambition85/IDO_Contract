const { expect } = require('chai');
const { utils } = require('ethers');
const { ethers } = require('hardhat');

let pDAYL, presale, usdc
const zeroAddress = "0x0000000000000000000000000000000000000000"
const rate = utils.parseUnits("40", 12)

describe('Test Presale DAYL Success Senario', function () {

  before(async () => {
    [owner, alice, bob, treasury, vault] = await ethers.getSigners()

    console.log("Deploying Contracts\n")

    const timeNow = (await ethers.provider.getBlock("latest")).timestamp
    console.log("Block time now: ", new Date(timeNow * 1000))

    const PresaleDAYL = await ethers.getContractFactory('PresaleDAYL')
    pDAYL = await PresaleDAYL.deploy(treasury.address)
    console.log("Presale DAYL deployed at: ", pDAYL.address)

    const USDC = await ethers.getContractFactory("TestUSDC")
    usdc = await USDC.deploy()
    console.log("Test USDC deployed at: ", usdc.address)

    const Presale = await ethers.getContractFactory('Presale')
    presale = await Presale.deploy([
      timeNow, //_startTime,
      timeNow + 3600, // _endTime,
      timeNow + 5000, // _claimTime,
      pDAYL.address, // _presaleDAYL,
      usdc.address, // _usdc,
      rate, // _rate,
      ethers.utils.parseUnits("25000", 6), // _softCap - 20,000,
      ethers.utils.parseUnits("60000", 6), // _hardCap,
      ethers.utils.parseUnits("30000", 6), // _maxPerWallet,
      ethers.utils.parseUnits("30", 6), // _minPerWallet,
      3600 * 24 * 30 * 5, // _vestingPeriod: 5 month,
      3600 * 24 * 30, //_unVestingGap,
      treasury.address, // _treasury
      vault.address, // _vault
    ])
    console.log(`Presale deployed at: ${presale.address}\n`)
  })

  it("Presale DAYL set Presale", async () => {
    await pDAYL.connect(treasury).setPresale(presale.address)
    const addr = await pDAYL.presale()
    console.log(`\n\tPresale address in DAYL token: ${addr}`)
    expect(addr).to.equal(presale.address)
  })

  it("Mint Test USDC", async () => {
    await usdc.connect(alice).mint(utils.parseUnits("10000", 6))
    await usdc.connect(bob).mint(utils.parseUnits("1000", 6))
  })

  it("Set White List users", async () => {
    await presale.connect(treasury).addWhitelists([alice.address])
    const aliceListed = await presale.whitelisted(alice.address)
    console.log(`\n\tAlice Listed: ${aliceListed}`)
    expect(aliceListed).to.equal(true)
  })

  it("Alice Deposit USDC", async () => {
    await usdc.connect(alice).approve(presale.address, utils.parseUnits("100000000000", 6))

    await presale.connect(alice).deposit(rate.mul(utils.parseUnits("10000", 6)))
    const aliceInfo = await presale.userInfo(alice.address)
    console.log(`\n\tAlice Deposited: ${utils.formatUnits(aliceInfo.depositAmount, 6)}`)
    expect(aliceInfo.depositAmount).to.equal(utils.parseUnits("10000", 6))
    console.log(`\n\tAlice Total Reward: ${utils.formatEther(aliceInfo.totalReward)}`)
    expect(aliceInfo.totalReward).to.equal(utils.parseEther("400000"))
  })

  it("Set White List users more", async () => {
    await presale.connect(treasury).addWhitelists([bob.address])
    const bobListed = await presale.whitelisted(bob.address)
    console.log(`\n\tbob Listed: ${bobListed}`)
    expect(bobListed).to.equal(true)
  })

  it("Bob Deposit USDC", async () => {
    await usdc.connect(bob).approve(presale.address, utils.parseUnits("100000000000", 6))

    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("1000", 6)))
    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 6)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("1000", 6))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("40000"))
  })

  it("Spent time to the end", async () => {
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
  })

  it("Set Vault Ratio", async () => {
    await presale.connect(treasury).setMinVault(10)
    const ratio = await presale.minToVault()
    console.log(`\n\tVault Ratio is ${Number(ratio)}`)
  })

  it("Withdraw USDC", async () => {
    const total = await presale.totalUSDC()
    await presale.connect(treasury).moveFunds()
    const tVal = await usdc.balanceOf(treasury.address)
    const vVal = await usdc.balanceOf(vault.address)

    console.log(`\n\tVault have ${utils.formatUnits(tVal, 6)}`)
    console.log(`\n\tTreasury have ${utils.formatUnits(vVal, 6)}`)

    expect(tVal).to.equal(0)
    expect(vVal).to.equal(total.div(10))
  })

  it("Withdraw USDC will be reverted", async () => {
    await expect(presale.connect(alice).withdraw()).to.revertedWith("Unable to withdraw")
  })

  it("Spent time to the end", async () => {
    await network.provider.send("evm_increaseTime", [1400]);
    await network.provider.send("evm_mine");
  })

  it("User withdraw usdc", async () => {
    const aliceDeposit = (await presale.userInfo(alice.address)).depositAmount
    console.log("\n\tAlice Deposit: ", utils.formatUnits(aliceDeposit, 6))

    oldBal = await usdc.balanceOf(alice.address)
    await presale.connect(alice).withdraw()
    newBal = await usdc.balanceOf(alice.address)
    console.log("\n\tAlice Withdraw: ", utils.formatUnits(newBal.sub(oldBal), 6))

    expect(newBal.sub(oldBal)).to.equal(aliceDeposit.mul(9).div(10))
  })

  it("Withdraw USDC will be reverted", async () => {
    await expect(presale.connect(alice).withdraw()).to.revertedWith("No USDC To Withdraw")
  })

  it("User Claim Token should fail", async () => {
    const aliceClaimable = await presale.claimableAmount(alice.address)
    console.log("\n\tAlice Claimable: ", utils.formatEther(aliceClaimable))
    expect(aliceClaimable).to.equal(0)
    await expect(presale.connect(alice).claimToken()).to.revertedWith("Unable to claim any tokens")
  })
});
