const { expect } = require('chai');
const { utils } = require('ethers');
const { ethers } = require('hardhat');

let pDAYL, presale, busd
const zeroAddress = "0x0000000000000000000000000000000000000000"
const rate = utils.parseUnits("40", 12)

describe('Test Presale DAYL Success Senario', function () {

  before(async () => {
    [owner, alice, bob, treasury, vault] = await ethers.getSigners()

    console.log("Deploying Contracts\n")

    const timeNow = (await ethers.provider.getBlock("latest")).timestamp
    console.log("Block time now: ", new Date(timeNow * 1000))

    const PresaleDAYL = await ethers.getContractFactory('PresaleDAYL')
    pDAYL = await PresaleDAYL.deploy()
    console.log("Presale DAYL deployed at: ", pDAYL.address)

    const BUSD = await ethers.getContractFactory("TestBUSD")
    busd = await BUSD.deploy()
    console.log("Test BUSD deployed at: ", busd.address)

    const Presale = await ethers.getContractFactory('Presale')
    presale = await Presale.deploy([
      timeNow, //_startTime,
      timeNow + 3600, // _endTime,
      timeNow + 5000, // _claimTime,
      pDAYL.address, // _presaleDAYL,
      busd.address, // _busd,
      rate, // _rate,
      ethers.utils.parseUnits("25000", 18), // _softCap - 20,000,
      ethers.utils.parseUnits("60000", 18), // _hardCap,
      ethers.utils.parseUnits("30000", 18), // _maxPerWallet,
      ethers.utils.parseUnits("30", 18), // _minPerWallet,
      3600 * 24 * 30 * 5, // _vestingPeriod: 5 month,
      3600 * 24 * 30, //_unVestingGap,
      treasury.address, // _treasury
      vault.address, // _vault
    ])
    console.log(`Presale deployed at: ${presale.address}\n`)
  })

  it("Presale DAYL set Presale", async () => {
    await pDAYL.setPresale(presale.address)
    const addr = await pDAYL.presale()
    console.log(`\n\tPresale address in DAYL token: ${addr}`)
    expect(addr).to.equal(presale.address)
  })

  it("Mint Test BUSD", async () => {
    await busd.connect(alice).mint(utils.parseUnits("10000", 18))
    await busd.connect(bob).mint(utils.parseUnits("1000", 18))
  })

  it("Set White List users", async () => {
    await presale.addWhitelists([alice.address])
    const aliceListed = await presale.whitelisted(alice.address)
    console.log(`\n\tAlice Listed: ${aliceListed}`)
    expect(aliceListed).to.equal(true)
  })

  it("Alice Deposit BUSD", async () => {
    await busd.connect(alice).approve(presale.address, utils.parseUnits("100000000000", 18))

    await presale.connect(alice).deposit(rate.mul(utils.parseUnits("10000", 18)))
    const aliceInfo = await presale.userInfo(alice.address)
    console.log(`\n\tAlice Deposited: ${utils.formatUnits(aliceInfo.depositAmount, 18)}`)
    expect(aliceInfo.depositAmount).to.equal(utils.parseUnits("10000", 18))
    console.log(`\n\tAlice Total Reward: ${utils.formatEther(aliceInfo.totalReward)}`)
    expect(aliceInfo.totalReward).to.equal(utils.parseEther("400000"))
  })

  it("Set White List users more", async () => {
    await presale.addWhitelists([bob.address])
    const bobListed = await presale.whitelisted(bob.address)
    console.log(`\n\tbob Listed: ${bobListed}`)
    expect(bobListed).to.equal(true)
  })

  it("Bob Deposit BUSD", async () => {
    await busd.connect(bob).approve(presale.address, utils.parseUnits("100000000000", 18))

    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("1000", 18)))
    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 18)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("1000", 18))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("40000"))
  })

  it("Spent time to the end", async () => {
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
  })

  it("Set Vault Ratio", async () => {
    await presale.setMinVault(10)
    const ratio = await presale.minToVault()
    console.log(`\n\tVault Ratio is ${Number(ratio)}`)
  })

  it("Withdraw BUSD", async () => {
    const total = await presale.totalBUSD()
    const tVal = await busd.balanceOf(treasury.address)
    const vVal = await busd.balanceOf(vault.address)

    console.log(`\n\tVault have ${utils.formatUnits(vVal, 18)}`)
    console.log(`\n\tTreasury have ${utils.formatUnits(tVal, 18)}`)

    expect(tVal).to.equal(0)
    expect(vVal).to.equal(total.div(10))
  })

  it("Withdraw BUSD will be reverted", async () => {
    await expect(presale.connect(alice).withdraw()).to.revertedWith("Unable to withdraw")
  })

  it("Spent time to the end", async () => {
    await network.provider.send("evm_increaseTime", [1400]);
    await network.provider.send("evm_mine");
  })

  it("User withdraw busd", async () => {
    await presale.setWithdrawable()

    const aliceDeposit = (await presale.userInfo(alice.address)).depositAmount
    console.log("\n\tAlice Deposit: ", utils.formatUnits(aliceDeposit, 18))

    oldBal = await busd.balanceOf(alice.address)
    await presale.connect(alice).withdraw()
    newBal = await busd.balanceOf(alice.address)
    console.log("\n\tAlice Withdraw: ", utils.formatUnits(newBal.sub(oldBal), 18))

    expect(newBal.sub(oldBal)).to.equal(aliceDeposit.mul(9).div(10))
  })

  // it("Withdraw BUSD will be reverted", async () => {
  //   await expect(presale.connect(alice).withdraw()).to.revertedWith("No BUSD To Withdraw")
  // })

  it("User Claim Token should fail", async () => {
    const aliceClaimable = await presale.claimableAmount(alice.address)
    console.log("\n\tAlice Claimable: ", utils.formatEther(aliceClaimable))
    expect(aliceClaimable).to.equal(0)
    await expect(presale.connect(alice).claimToken()).to.revertedWith("Unable to claim any tokens")
  })
});
