const { expect } = require('chai');
const { utils } = require('ethers');
const { ethers } = require('hardhat');

let pDAYL, presale, busd
const zeroAddress = "0x0000000000000000000000000000000000000000"
const rate = utils.parseUnits("40", 0)
const depositors = require("../migration/depositor.json")

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
      timeNow + 5000, // _endTime,
      pDAYL.address, // _presaleDAYL,
      busd.address, // _busd,
      rate, // _rate,
      ethers.utils.parseUnits("10000", 18), // _softCap - 20,000,
      ethers.utils.parseUnits("60000", 18), // _hardCap,
      ethers.utils.parseUnits("5000", 18), // _maxPerWallet,
      ethers.utils.parseUnits("100", 18), // _minPerWallet,
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
    await pDAYL.setPresale(presale.address)
    const addr = await pDAYL.presale()
    console.log(`\n\tPresale address in DAYL token: ${addr}`)
    expect(addr).to.equal(presale.address)
  })

  it("Presale DAYL set Presale by non-owner will be reverted", async () => {
    await expect(pDAYL.connect(alice).setPresale(presale.address)).to.revertedWith("Ownable: caller is not the owner")
  })

  it("Presale DAYL set Presale to zero will be reverted", async () => {
    await expect(pDAYL.setPresale(zeroAddress)).to.revertedWith("Invalid Presale Address")
  })

  it("Presale DAYL mint tokens", async () => {
    await pDAYL.mint(alice.address, utils.parseEther("100"))
    const bal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice got ${utils.formatEther(bal)}`)
    expect(bal).to.equal(utils.parseEther("100"))
  })

  it("Presale DAYL mint tokens by non-owner will be reverted", async () => {
    await expect(pDAYL.connect(alice).mint(alice.address, utils.parseEther("100"))).to.revertedWith("Only Owner and Presale contract Mintable")
  })

  it("Burn Presale tokens", async () => {
    await pDAYL.connect(alice).burn(utils.parseEther("100"))
    const bal = await pDAYL.balanceOf(alice.address)
    console.log(`\n\tAlice got ${utils.formatEther(bal)}`)
    expect(bal).to.equal(utils.parseEther("0"))
  })

  it("Mint Test BUSD", async () => {
    await busd.connect(alice).mint(utils.parseUnits("1000", 18))
    await busd.connect(bob).mint(utils.parseUnits("1000", 18))
  })

  it("Set White List users", async () => {
    await presale.addWhitelists([alice.address])
    const aliceListed = await presale.whitelisted(alice.address)
    console.log(`\n\tAlice Listed: ${aliceListed}`)
    expect(aliceListed).to.equal(true)
  })

  it("Deposit will be revert with minimum check msg", async () => {
    await expect(presale.connect(alice).deposit(rate.mul(utils.parseUnits("29", 18)))).to.revertedWith("Invalid BUSD deposit")
  })

  it("Alice Deposit BUSD", async () => {
    await busd.connect(alice).approve(presale.address, utils.parseUnits("100000000000", 18))

    await presale.connect(alice).deposit(rate.mul(utils.parseUnits("1000", 18)))
    const aliceInfo = await presale.userInfo(alice.address)
    console.log(`\n\tAlice Deposited: ${utils.formatUnits(aliceInfo.depositAmount, 18)}`)
    expect(aliceInfo.depositAmount).to.equal(utils.parseUnits("1000", 18))
    console.log(`\n\tAlice Total Reward: ${utils.formatEther(aliceInfo.totalReward)}`)
    expect(aliceInfo.totalReward).to.equal(utils.parseEther("40000"))
  })

  it("Move BUSD during presale", async () => {
    const total = await presale.totalBUSD()
    console.log("\n\tTotal BUSD: ", utils.formatUnits(total, 18))
    const vaultBal = await busd.balanceOf(vault.address)
    console.log("\n\tVault BUSD: ", utils.formatUnits(vaultBal, 18))
    expect(vaultBal).to.equal(total.div(10))
  })

  it("Deposit Will be reverted - Not listed user", async () => {
    await expect(presale.deposit(rate)).to.revertedWith("Not Whitelisted User")
  })

  it("Deposit Will be reverted - Not enough BUSD", async () => {
    await expect(presale.connect(alice).deposit(rate)).to.revertedWith("ERC20: transfer amount exceeds balance")
  })

  it("Set White List users more", async () => {
    await presale.addWhitelists([bob.address])
    const bobListed = await presale.whitelisted(bob.address)
    console.log(`\n\tbob Listed: ${bobListed}`)
    expect(bobListed).to.equal(true)
  })

  it("Bob Deposit 100 BUSD", async () => {
    await busd.connect(bob).approve(presale.address, utils.parseUnits("100000000000", 18))

    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("100", 18)))
    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 18)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("100", 18))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("4000"))
  })

  it("Move BUSD during presale", async () => {
    const total = await presale.totalBUSD()
    console.log("\n\tTotal BUSD: ", utils.formatUnits(total, 18))
    const vaultBal = await busd.balanceOf(vault.address)
    console.log("\n\tVault BUSD: ", utils.formatUnits(vaultBal, 18))
    expect(vaultBal).to.equal(total.div(10))
  })

  it("Move BUSD during presale", async () => {
    const total = await presale.totalBUSD()
    console.log("\n\tTotal BUSD: ", utils.formatUnits(total, 18))
    const vaultBal = await busd.balanceOf(vault.address)
    console.log("\n\tVault BUSD: ", utils.formatUnits(vaultBal, 18))
    expect(vaultBal).to.equal(total.div(10))
  })

  it("Mint Test BUSD", async () => {
    await busd.connect(alice).mint(utils.parseUnits("300000", 18))
    await busd.connect(bob).mint(utils.parseUnits("300000", 18))
  })

  it("Deposit will be revert with maximum check msg", async () => {
    await expect(presale.connect(bob).deposit(rate.mul(utils.parseUnits("5001", 18)))).to.revertedWith("Invalid BUSD deposit")
  })

  it("Deposit Until SoftCap reaches", async () => {
    await presale.connect(alice).deposit(rate.mul(utils.parseUnits("4000", 18)))

    const aliceInfo = await presale.userInfo(alice.address)
    console.log(`\n\tAlice Deposited: ${utils.formatUnits(aliceInfo.depositAmount, 18)}`)
    expect(aliceInfo.depositAmount).to.equal(utils.parseUnits("5000", 18))
    console.log(`\n\tAlice Total Reward: ${utils.formatEther(aliceInfo.totalReward)}`)
    expect(aliceInfo.totalReward).to.equal(utils.parseEther("200000"))

  })

  // it("Withdraw BUSD", async () => {
  //   const total = await presale.totalBUSD()
  //   await presale.moveFunds()
  //   const tVal = await busd.balanceOf(treasury.address)
  //   const vVal = await busd.balanceOf(vault.address)

  //   console.log(`\n\tVault have ${utils.formatUnits(tVal, 18)}`)
  //   console.log(`\n\tTreasury have ${utils.formatUnits(vVal, 18)}`)

  //   expect(tVal).to.equal(total.mul(9).div(10))
  //   expect(vVal).to.equal(total.div(10))
  // })

  it("Bob Deposit More: ", async () => {
    await presale.connect(bob).deposit(rate.mul(utils.parseUnits("4900", 18)))
    const bobInfo = await presale.userInfo(bob.address)
    console.log(`\n\tBob Deposited: ${utils.formatUnits(bobInfo.depositAmount, 18)}`)
    expect(bobInfo.depositAmount).to.equal(utils.parseUnits("5000", 18))
    console.log(`\n\tBob Total Reward: ${utils.formatEther(bobInfo.totalReward)}`)
    expect(bobInfo.totalReward).to.equal(utils.parseEther("200000"))
  })

  it("Revert Claim since presale not ended", async () => {
    await expect(presale.connect(bob).claimToken()).to.revertedWith("Unable to claim any tokens")
  })

  it("Spent time to the end", async () => {
    await network.provider.send("evm_increaseTime", [5000]);
    await network.provider.send("evm_mine");
  })

  it("Withdraw BUSD will be failed", async () => {
    await expect(presale.connect(alice).withdraw()).to.revertedWith("Unable to withdraw")
  })


  it("Bob Claim Token", async () => {
    let bobClaimable = await presale.claimableAmount(bob.address)

    expect(bobClaimable).to.equal(utils.parseEther("200000"))
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
    await expect(presale.setVaultRatio(101)).to.revertedWith("Invalid Ratio Value")
  })

  it("Set Vault Ratio", async () => {
    await presale.setVaultRatio(10)
    const ratio = await presale.vaultRatio()
    console.log(`\n\tVault Ratio is ${Number(ratio)}`)
  })

  it("Check Total BUSD", async () => {
    const total = await presale.totalBUSD()
    console.log(`\n\tTotal BUSD deposit: ${utils.formatUnits(total, 18)}`)
    expect(total).to.equal(utils.parseUnits("10000", 18))
  })

  // it("Withdraw BUSD", async () => {
  //   const total = await presale.totalBUSD()
  //   await presale.moveFunds()
  //   const tVal = await busd.balanceOf(treasury.address)
  //   const vVal = await busd.balanceOf(vault.address)

  //   console.log(`\n\tVault have ${utils.formatUnits(tVal, 18)}`)
  //   console.log(`\n\tTreasury have ${utils.formatUnits(vVal, 18)}`)

  //   expect(tVal).to.equal(total.mul(9).div(10))
  //   expect(vVal).to.equal(total.div(10))
  // })

  it("Test Migrate", async () => {
    const accounts = depositors.map(d => d.address)
    const deposits = depositors.map(d => utils.parseUnits(d.amount.toString(), 12))
    await presale.migrateUserDetail(accounts, deposits)
    console.log("\n\tPresale set migration: ")
    const totalBUSD = await presale.totalBUSD()
    const totalPresale = await presale.totalPresale()
    console.log(totalBUSD, totalPresale)
    console.log("Total Info: ", utils.formatUnits(totalBUSD, 18), utils.formatEther(totalPresale))
  })
});
