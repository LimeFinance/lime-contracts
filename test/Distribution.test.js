require("dotenv").config();

const truffleAssert = require("truffle-assertions");
const BN = require("bn.js");

const LimeToken = artifacts.require("LimeToken");
const TokenFarm = artifacts.require("TokenFarm");
const BEP20 = artifacts.require("MockBEP20");
const Distribution = artifacts.require("Distribution");

const PancakeRouter = require("../abis/PancakeRouter.json");
const PancakeFactory = require("../abis/PancakeFactory.json");
const PancakePair = require("../abis/PancakePair.json");
const WETH = require("../abis/WETH.json");
const { ADDRESSES, SAFE_GAS_PRICE, SAFE_GAS } = require("../constants");
const { fromTokens, revertToSnapShot, takeSnapshot, tokensBN } = require("./utils");

const ERROR_MARGIN = tokensBN("0.005");
const { DEV_ADDRESS } = process.env;

const tokens = (amount) => {
  return web3.utils.toWei(amount);
};

const {
  pancakeRouter: pancakeRouterAddr,
  pancakeFactory: pancakeFactoryAddr,
  USDT,
  WBNB,
  BUSD,
  ZERO,
} = ADDRESSES["testnet"];

contract("Distribution", ([owner, lottery, cards, roulette]) => {
  before(async () => {
    limeToken = await LimeToken.new();
    distribution = await Distribution.deployed();
    tokenFarm = await TokenFarm.new(distribution.address, limeToken.address);
    busdToken = await BEP20.at(BUSD);
    usdtToken = await BEP20.at(USDT);
    wbnb = new web3.eth.Contract(WETH, WBNB);
    pancakeRouter = new web3.eth.Contract(PancakeRouter, pancakeRouterAddr);
    pancakeFactory = new web3.eth.Contract(PancakeFactory, pancakeFactoryAddr);

    await wbnb.methods.deposit().send({ from: owner, value: tokens("5") });

    await wbnb.methods.approve(pancakeRouterAddr, tokens("1000000")).send({ from: owner });
    await pancakeRouter.methods
      .swapExactTokensForTokens(tokens("1"), tokens("300"), [WBNB, USDT], owner, Date.now() + 1e12)
      .send({
        from: owner,
        gas: 1000000,
      });
    await pancakeRouter.methods
      .swapExactTokensForTokens(tokens("1"), tokens("300"), [WBNB, BUSD], owner, Date.now() + 1e12)
      .send({
        from: owner,
        gas: 1000000,
      });
    await usdtToken.approve(pancakeRouterAddr, tokens("10000"));
    await busdToken.approve(pancakeRouterAddr, tokens("10000"));

    await pancakeRouter.methods
      .addLiquidity(
        WBNB,
        USDT,
        tokens("1"),
        tokens("300"),
        tokens("0.7"),
        tokens("200"),
        owner,
        Date.now() + 1e12
      )
      .send({ from: owner, gas: 1000000 });

    await pancakeRouter.methods
      .addLiquidity(
        BUSD,
        USDT,
        tokens("25"),
        tokens("25"),
        tokens("0.05"),
        tokens("0.05"),
        owner,
        Date.now() + 1e12
      )
      .send({ from: owner, gas: 1000000 });

    lpTokens = await pancakeFactory.methods.getPair(WBNB, USDT).call();
    lpTokens2 = await pancakeFactory.methods.getPair(BUSD, USDT).call();
    lpTokenContract = new web3.eth.Contract(PancakePair, lpTokens);
    lpTokenContract2 = new web3.eth.Contract(PancakePair, lpTokens2);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    snapshotId = snapshot.result;
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  it("Receives and converts LP tokens to ether (with WETH)", async () => {
    await lpTokenContract.methods.transfer(distribution.address, tokens("1")).send({ from: owner });
    await distribution.receiveTokensAndConvertToETH(tokens("1"), lpTokens, true, {
      from: owner,
    });
    const distBalance = new BN(await web3.eth.getBalance(distribution.address));
    const devBalance = new BN(await web3.eth.getBalance(DEV_ADDRESS));
    console.log(fromTokens(distBalance));
    console.log(fromTokens(devBalance));
    assert(
      distBalance.mul(new BN(9)).gt(devBalance.sub(ERROR_MARGIN)) &&
        distBalance.mul(new BN(9)).lt(devBalance.add(ERROR_MARGIN)),
      "The balances are not correct"
    );
  });

  it("Receives and converts LP tokens to ether (no WETH)", async () => {
    await lpTokenContract2.methods
      .transfer(distribution.address, tokens("10"))
      .send({ from: owner });

    await distribution.receiveTokensAndConvertToETH(tokens("10"), lpTokens2, true, { from: owner });

    const distBalance = new BN(await web3.eth.getBalance(distribution.address));
    const devBalance = new BN(await web3.eth.getBalance(DEV_ADDRESS));

    console.log(fromTokens(distBalance));
    console.log(fromTokens(devBalance));
    assert(
      distBalance.mul(new BN(9)).gt(devBalance.sub(ERROR_MARGIN)) &&
        distBalance.mul(new BN(9)).lt(devBalance.add(ERROR_MARGIN)),
      "The balances are not correct"
    );
  });

  it("Receives normal tokens and converts them to ether", async () => {
    await usdtToken.transfer(distribution.address, tokens("1"));
    await distribution.receiveTokensAndConvertToETH(tokens("1"), usdtToken.address, false, {
      from: owner,
      gas: SAFE_GAS_PRICE,
    });
    const distBalance = new BN(await web3.eth.getBalance(distribution.address));
    const devBalance = new BN(await web3.eth.getBalance(DEV_ADDRESS));

    console.log(fromTokens(distBalance));
    console.log(fromTokens(devBalance));

    assert(
      distBalance.mul(new BN(9)).gt(devBalance.sub(ERROR_MARGIN)) &&
        distBalance.mul(new BN(9)).lt(devBalance.add(ERROR_MARGIN)),
      "The balances are not correct"
    );
  });

  it("Distributes the payments correcty", async () => {
    // Burn the ether in the lottery and roulette
    assert(
      (await web3.eth.getBalance(lottery)) == tokens("10000"),
      "Lotto ether balance is not correct. Set the ganache settings to default 10,000"
    );
    await web3.eth.sendTransaction({
      from: lottery,
      value: tokensBN("10000").sub(tokensBN("0.0018")),
      to: ZERO,
    });
    await web3.eth.sendTransaction({
      from: roulette,
      value: tokensBN("10000").sub(tokensBN("0.0018")),
      to: ZERO,
    });
    // Rates:
    // 16.27866LP = 1WBNB + 360USDT = ~ 2BNB
    await lpTokenContract.methods
      .transfer(distribution.address, tokens("10"))
      .send({ from: owner });
    await distribution.addProduct(lottery, 2);
    await distribution.addProduct(roulette, 1);

    await distribution.receiveTokensAndConvertToETH(tokens("10"), lpTokens, {
      from: owner,
    });

    const devBalance = new BN(await web3.eth.getBalance(DEV_ADDRESS));
    const distBalance = new BN(await web3.eth.getBalance(distribution.address));
    const lottoBalance = new BN(await web3.eth.getBalance(lottery));
    const rouletteBalance = new BN(await web3.eth.getBalance(roulette));

    assert(
      rouletteBalance.mul(new BN(2)).lt(lottoBalance.add(ERROR_MARGIN)) &&
        rouletteBalance.mul(new BN(2)).gt(lottoBalance.sub(ERROR_MARGIN)) &&
        rouletteBalance.mul(new BN(3)).gt(lottoBalance.div(new BN(9)).sub(ERROR_MARGIN)) &&
        rouletteBalance.mul(new BN(3)).lt(devBalance.div(new BN(9)).add(ERROR_MARGIN)),
      "Balances are incorrect"
    );
    assert(distBalance.lt(ERROR_MARGIN), "Distribution contract balance should be 0");
  });

  it("Can stake WETH", async () => {
    await wbnb.methods
      .transfer(distribution.address, tokens("0.5"))
      .send({ from: owner, gas: SAFE_GAS });

    console.log("Transfer OK");
    await distribution.receiveTokensAndConvertToETH(tokens("0.5"), WBNB, false, { gas: SAFE_GAS });

    const devBalance = new BN(await web3.eth.getBalance(DEV_ADDRESS));

    // assert(devBalance.eq())
  });
});
