const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Test IDO Token Contract', function () {
  let IDOTokenFactory, USDCFactory, IDOSaleFactory
  let idoToken, usdc, idoSale
  let owner, minter
  before(async () => {
    [owner, minter] = await ethers.getSigners()

    IDOTokenFactory = await ethers.getContractFactory('contracts/IDOToken.sol:IDOToken')
    USDCFactory = await ethers.getContractFactory('TestUSDC')
    IDOSaleFactory = await ethers.getContractFactory('IDOPool')
  })

  beforeEach(async () => {
    idoToken = await IDOTokenFactory.connect(owner).deploy(owner.address)
    await idoToken.deployed()
    usdc = await USDCFactory.connect(owner).deploy('USDCoin', 'USDC')
    await usdc.deployed()
    idoSale = await IDOSaleFactory.connect(owner).deploy(0, '1000000000000', '1000000000000', idoToken.address, usdc.address, 40, '10000', '20000', '20000', '100', owner.address)
    await idoSale.deployed()
    await (await idoToken.connect(owner).setIdoAddress(idoSale.address)).wait()
  })

  it('IDO Success', async () => {
    expect(await usdc.balanceOf(owner.address)).to.equal('0')
    expect(idoSale.connect(minter).purchase(10)).to.be.revertedWith('Not Whitelisted')
    await (await idoSale.connect(owner).addWhitelists([minter.address])).wait()
    expect(idoSale.connect(minter).purchase(10)).to.be.revertedWith('Smaller Than Minimum Amount')
    expect(idoSale.connect(minter).purchase(100000)).to.be.revertedWith('Exceeds Max Per Wallet')
    expect(idoSale.connect(minter).purchase(10000)).to.be.revertedWith('Insufficinet Fund')
    await (await usdc.connect(minter).mint(10000)).wait()
    expect((await usdc.balanceOf(minter.address)).toString()).to.equal('10000')
    await (await usdc.connect(minter).approve(idoSale.address, 250)).wait()
    await (await idoSale.connect(minter).purchase(10000)).wait()
    expect((await idoSale.purchased(minter.address)).toString()).to.equal('10000')
    expect(idoSale.connect(owner).withdraw()).to.be.revertedWith('Presale Should Not Be Active')
    expect((await usdc.balanceOf(minter.address)).toString()).to.equal('9750') // 10000 - 10000 / 40 = 10000 - 250 = 9750
    expect(idoSale.connect(minter).purchase(20000)).to.be.revertedWith('Exceeds Hardcap')
    expect(idoSale.connect(minter).claim()).to.be.revertedWith('Claim Not Started')
    await (await usdc.connect(minter).approve(idoSale.address, 250)).wait()
    await (await idoSale.connect(minter).purchase(10000)).wait()
    expect((await idoSale.purchased(minter.address)).toString()).to.equal('20000')
    expect((await usdc.balanceOf(minter.address)).toString()).to.equal('9500') // 9750 - 10000 / 40 = 9750 - 250 = 9500
    await (await idoSale.connect(owner).setClaimTime(0)).wait()
    await (await idoSale.connect(minter).claim())
    expect((await idoToken.balanceOf(minter.address)).toString()).to.equal('20000')
    await (await idoSale.connect(owner).withdraw()).wait()
    expect((await usdc.balanceOf(owner.address)).toString()).to.equal('500')
  })

  it('IDO Fail', async () => {
    await (await idoSale.connect(owner).addWhitelists([minter.address])).wait()
    await (await usdc.connect(minter).mint(10000)).wait()
    expect((await usdc.balanceOf(minter.address)).toString()).to.equal('10000')
    await (await usdc.connect(minter).approve(idoSale.address, 100)).wait()
    await (await idoSale.connect(minter).purchase(4000)).wait()
    expect((await idoSale.purchased(minter.address)).toString()).to.equal('4000')
    expect((await usdc.balanceOf(minter.address)).toString()).to.equal('9900') // 10000 - 4000 / 40 = 10000 - 100 = 9900
    expect(idoSale.connect(owner).withdraw()).to.be.revertedWith('Presale Should Not Be Active')
    await (await idoSale.connect(owner).setEndTime(0)).wait() // Finish the presale, and IDO's failure
    await (await idoSale.connect(owner).withdraw()).wait()
    expect((await usdc.balanceOf(owner.address))).to.equal('10') // (4000 / 40) * 10% = 10
    await (await idoSale.connect(minter).claimUsdc()).wait()
    expect((await usdc.balanceOf(minter.address)).toString()).to.equal('9990') // 9900 + 100 * (100 - 10)% = 9990
  })
});
