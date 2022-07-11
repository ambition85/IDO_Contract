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
      timeNow + 5000, // _endTime,
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

  it("Presale DAYL Token: Symbol, Name, Decimals", async () => {
    expect(await pDAYL.symbol()).to.equal("DAYL")
    expect(await pDAYL.name()).to.equal("Presale Daylight")
    expect(await pDAYL.decimals()).to.equal(18)
  })

  it("Presale DAYL set Presale", async () => {
    await pDAYL.connect(treasury).setPresale(presale.address)
    const addr = await pDAYL.presale()
    console.log(`\n\tPresale address in DAYL token: ${addr}`)
    expect(addr).to.equal(presale.address)
  })

  it("Presale DAYL set Presale by non-owner will be reverted", async () => {
    await expect(pDAYL.setPresale(presale.address)).to.revertedWith("Ownable: caller is not the owner")
  })

  it("Presale DAYL set Presale to zero will be reverted", async () => {
    await expect(pDAYL.connect(treasury).setPresale(zeroAddress)).to.revertedWith("Invalid Presale Address")
  })

  it("Presale DAYL mint tokens", async () => {
    await pDAYL.connect(treasury).mint(alice.address, utils.parseEther("100"))
    const bal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice got ${utils.formatEther(bal)}`)
    expect(bal).to.equal(utils.parseEther("100"))
  })

  it("Presale DAYL mint tokens by non-owner will be reverted", async () => {
    await expect(pDAYL.mint(alice.address, utils.parseEther("100"))).to.revertedWith("Only Owner and Presale contract Mintable")
  })

  it("Burn Presale tokens", async () => {
    await pDAYL.connect(alice).burn(utils.parseEther("100"))
    const bal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice got ${utils.formatEther(bal)}`)
    expect(bal).to.equal(utils.parseEther("0"))
  })

  it("Mint Test USDC", async () => {
    await usdc.connect(alice).mint(utils.parseUnits("1000", 6))
    await usdc.connect(bob).mint(utils.parseUnits("100", 6))
  })

  it("Set White List users", async () => {
    await presale.connect(treasury).addWhitelists([alice.address])
    const aliceListed = await presale.whitelisted(alice.address)
    console.log(`\n\tAlice Listed: ${aliceListed}`)
    expect(aliceListed).to.equal(true)
  })

  it("Deposit will be revert with minimum check msg", async () => {
    await expect(presale.connect(alice).deposit(rate.mul(utils.parseUnits("29", 6)))).to.revertedWith("Invalid USDC deposit")
  })

  it("Alice Deposit USDC", async () => {
    await usdc.connect(alice).approve(presale.address, utils.parseUnits("100000000000", 6))

    await presale.connect(alice).deposit(rate.mul(utils.parseUnits("1000", 6)))
    const aliceInfo = await presale.userInfo(alice.address)
    console.log(`\n\tAlice Deposited: ${utils.formatUnits(aliceInfo.depositAmount, 6)}`)
    expect(aliceInfo.depositAmount).to.equal(utils.parseUnits("1000", 6))
    console.log(`\n\tAlice Total Reward: ${utils.formatEther(aliceInfo.totalReward)}`)
    expect(aliceInfo.totalReward).to.equal(utils.parseEther("40000"))
  })

  it("Deposit Will be reverted - Not listed user", async () => {
    await expect(presale.deposit(rate)).to.revertedWith("Not Whitelisted User")
  })

  it("Deposit Will be reverted - Not enough USDC", async () => {
    await expect(presale.connect(alice).deposit(rate)).to.revertedWith("ERC20: transfer amount exceeds balance")
  })

  it("Set White List users more", async () => {
    await presale.connect(treasury).addWhitelists([bob.address])
    const bobListed = await presale.whitelisted(bob.address)
    console.log(`\n\tbob Listed: ${bobListed}`)
    expect(bobListed).to.equal(true)
  })

  it("Bob Deposit 50 USDC", async () => {
    await usdc.connect(bob).approve(presale.address, utils.parseUnits("100000000000", 6))

    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("50", 6)))
    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 6)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("50", 6))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("2000"))
  })

  it("Bob Deposit 50 USDC more", async () => {
    await usdc.connect(bob).approve(presale.address, utils.parseUnits("100000000000", 6))

    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("50", 6)))
    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 6)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("100", 6))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("4000"))
  })

  it("Mint Test USDC", async () => {
    await usdc.connect(alice).mint(utils.parseUnits("300000", 6))
    await usdc.connect(bob).mint(utils.parseUnits("300000", 6))
  })

  it("Deposit will be revert with maximum check msg", async () => {
    await expect(presale.connect(bob).deposit(rate.mul(utils.parseUnits("30001", 6)))).to.revertedWith("Invalid USDC deposit")
  })

  it("Deposit Until SoftCap reaches", async () => {
    await presale.connect(alice).deposit(rate.mul(utils.parseUnits("29000", 6)))
    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("9900", 6)))

    const aliceInfo = await presale.userInfo(alice.address)
    console.log(`\n\tAlice Deposited: ${utils.formatUnits(aliceInfo.depositAmount, 6)}`)
    expect(aliceInfo.depositAmount).to.equal(utils.parseUnits("30000", 6))
    console.log(`\n\tAlice Total Reward: ${utils.formatEther(aliceInfo.totalReward)}`)
    expect(aliceInfo.totalReward).to.equal(utils.parseEther("1200000"))

    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 6)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("10000", 6))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("400000"))
  })

  it("Revert Claim since presale not ended", async () => {
    await expect(presale.connect(bob).claimToken()).to.revertedWith("Unable to claim any tokens")
  })

  it("Spent time to the end", async () => {
    await network.provider.send("evm_increaseTime", [5000]);
    await network.provider.send("evm_mine");
  })

  it("Withdraw USDC will be failed", async () => {
    await expect(presale.connect(alice).withdraw()).to.revertedWith("Unable to withdraw")
  })

  it("Alice Claim Token", async () => {
    let aliceClaimable = await presale.claimableAmount(alice.address)

    expect(aliceClaimable).to.equal(utils.parseEther("240000"))
    console.log(`\n\tAlice can claim ${utils.formatEther(aliceClaimable)}`)

    oldBal = await pDAYL.balanceOf(alice.address)
    await presale.connect(alice).claimToken()
    newBal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice Withdrawn Amount: ${utils.formatEther(newBal.sub(oldBal))}`)

    expect(aliceClaimable).to.equal(newBal.sub(oldBal))

    aliceClaimable = await presale.claimableAmount(alice.address)
    console.log(`\n\tAlice can claim ${utils.formatEther(aliceClaimable)}`)
    expect(aliceClaimable).to.equal(0)
  })

  it("Bob Claim Token", async () => {
    let bobClaimable = await presale.claimableAmount(bob.address)
    console.log(`\n\tBob can claim ${utils.formatEther(bobClaimable)}`)

    expect(bobClaimable).to.equal(utils.parseEther("80000"))

    oldBal = await pDAYL.balanceOf(bob.address)
    await presale.connect(bob).claimToken()
    newBal = await pDAYL.balanceOf(bob.address)
    console.log(`\n\tbob Withdrawn Amount: ${utils.formatEther(newBal.sub(oldBal))}`)

    expect(bobClaimable).to.equal(newBal.sub(oldBal))

    bobClaimable = await presale.claimableAmount(bob.address)
    console.log(`\n\tBob can claim ${utils.formatEther(bobClaimable)}`)
    expect(bobClaimable).to.equal(0)
  })

  it("Revert Claim since no claimable amount", async () => {
    await expect(presale.connect(bob).claimToken()).to.revertedWith("Unable to claim any tokens")
    await expect(presale.connect(alice).claimToken()).to.revertedWith("Unable to claim any tokens")
  })

  it("Spent 2 month time", async () => {
    await network.provider.send("evm_increaseTime", [3600 * 24 * 30 * 2]);
    await network.provider.send("evm_mine");
  })

  it("Alice Claim Token", async () => {
    let aliceClaimable = await presale.claimableAmount(alice.address)

    expect(aliceClaimable).to.equal(utils.parseEther("480000"))
    console.log(`\n\tAlice can claim ${utils.formatEther(aliceClaimable)}`)

    oldBal = await pDAYL.balanceOf(alice.address)
    await presale.connect(alice).claimToken()
    newBal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice Withdrawn Amount: ${utils.formatEther(newBal.sub(oldBal))}`)

    expect(aliceClaimable).to.equal(newBal.sub(oldBal))

    aliceClaimable = await presale.claimableAmount(alice.address)
    console.log(`\n\tAlice can claim ${utils.formatEther(aliceClaimable)}`)
    expect(aliceClaimable).to.equal(0)
  })

  it("Spent 2 month time", async () => {
    await network.provider.send("evm_increaseTime", [3600 * 24 * 30 * 2]);
    await network.provider.send("evm_mine");
  })

  it("Alice Claim Token", async () => {
    let aliceClaimable = await presale.claimableAmount(alice.address)

    expect(aliceClaimable).to.equal(utils.parseEther("480000"))
    console.log(`\n\tAlice can claim ${utils.formatEther(aliceClaimable)}`)

    oldBal = await pDAYL.balanceOf(alice.address)
    await presale.connect(alice).claimToken()
    newBal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice Withdrawn Amount: ${utils.formatEther(newBal.sub(oldBal))}`)

    expect(aliceClaimable).to.equal(newBal.sub(oldBal))

    aliceClaimable = await presale.claimableAmount(alice.address)
    console.log(`\n\tAlice can claim ${utils.formatEther(aliceClaimable)}`)
    expect(aliceClaimable).to.equal(0)
  })

  it("Spent time more", async () => {
    await network.provider.send("evm_increaseTime", [3600 * 24 * 30]);
    await network.provider.send("evm_mine");
  })

  it("Revert Claim since no claimable amount", async () => {
    await expect(presale.connect(alice).claimToken()).to.revertedWith("Unable to claim any tokens")
  })

  it("Bob Claim Token", async () => {
    let bobClaimable = await presale.claimableAmount(bob.address)

    expect(bobClaimable).to.equal(utils.parseEther("320000"))
    console.log(`\n\tBob can claim ${utils.formatEther(bobClaimable)}`)

    oldBal = await pDAYL.balanceOf(bob.address)
    await presale.connect(bob).claimToken()
    newBal = await pDAYL.balanceOf(bob.address)
    console.log(`\n\tBob Withdrawn Amount: ${utils.formatEther(newBal.sub(oldBal))}`)

    expect(bobClaimable).to.equal(newBal.sub(oldBal))

    bobClaimable = await presale.claimableAmount(bob.address)
    console.log(`\n\tbob can claim ${utils.formatEther(bobClaimable)}`)
    expect(bobClaimable).to.equal(0)
  })

  it("Revert Claim since no claimable amount", async () => {
    await expect(presale.connect(bob).claimToken()).to.revertedWith("Unable to claim any tokens")
  })

  it("Set Vault Ratio will be reverted", async () => {
    await expect(presale.connect(alice).setVaultRatio(10)).to.revertedWith("Ownable: caller is not the owner")
    await expect(presale.connect(treasury).setVaultRatio(101)).to.revertedWith("Invalid Ratio Value")
  })

  it("Set Vault Ratio", async () => {
    await presale.connect(treasury).setVaultRatio(10)
    const ratio = await presale.vaultRatio()
    console.log(`\n\tVault Ratio is ${Number(ratio)}`)
  })

  it("Check Total USDC", async () => {
    const total = await presale.totalUSDC()
    console.log(`\n\tTotal USDC deposit: ${utils.formatUnits(total, 6)}`)
    expect(total).to.equal(utils.parseUnits("40000", 6))
  })

  it("Withdraw USDC", async () => {
    const total = await presale.totalUSDC()
    await presale.connect(treasury).moveFunds()
    const tVal = await usdc.balanceOf(treasury.address)
    const vVal = await usdc.balanceOf(vault.address)

    console.log(`\n\tVault have ${utils.formatUnits(tVal, 6)}`)
    console.log(`\n\tTreasury have ${utils.formatUnits(vVal, 6)}`)

    expect(tVal).to.equal(total.mul(9).div(10))
    expect(vVal).to.equal(total.div(10))
  })
});
