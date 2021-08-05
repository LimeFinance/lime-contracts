require("dotenv").config({ path: "../.env" });
const tokens = (amount) => {
  return web3.utils.toWei(amount);
};
const PancakeRouter = require("../abis/PancakeRouter.json");
const PancakeFactory = require("../abis/PancakeFactory.json");
const TokenFarm = artifacts.require("TokenFarm");
const LimeToken = artifacts.require("LimeToken");
const BEP20 = artifacts.require("MockBEP20");
const BN = require("bn.js");
const { ADDRESSES, SAFE_GAS } = require("../constants");

const {
  pancakeRouter: pancakeRouterAddr,
  pancakeFactory: pancakeFactoryAddr,
  BUSD,
  USDT,
  WBNB,
  ETH,
  DAI,
  CAKE,
} = ADDRESSES.testnet;

module.exports = async (deployer, network, [owner]) => {
  if (network === "bsc") return;
  if (network !== "testnet" && network !== "development") return;
  try {
    // perform actions
    console.log("Starting");
    const gas = SAFE_GAS;
    const tokenFarm = await TokenFarm.deployed();
    const limeToken = await LimeToken.deployed();
    const busdToken = await BEP20.at(BUSD);
    const usdtToken = await BEP20.at(USDT);
    const wbnbToken = await BEP20.at(WBNB);
    const pancakeRouter = new web3.eth.Contract(PancakeRouter, pancakeRouterAddr);
    const pancakeFactory = new web3.eth.Contract(PancakeFactory, pancakeFactoryAddr);

    await pancakeRouter.methods
      .swapExactETHForTokens(0, [WBNB, USDT], owner, Date.now() + 1e12)
      .send({
        from: owner,
        value: tokens("0.1"),
        gas,
      });

    await pancakeRouter.methods
      .swapExactETHForTokens("0", [WBNB, BUSD], owner, Date.now() + 1e12)
      .send({
        from: owner,
        value: tokens("0.1"),
        gas,
      });

    await limeToken.approve(pancakeRouterAddr, tokens("10000000"), { from: owner });
    await busdToken.approve(pancakeRouterAddr, tokens("1000000"), { from: owner });
    await wbnbToken.approve(pancakeRouterAddr, tokens("1000000"), { from: owner });
    await usdtToken.approve(pancakeRouterAddr, tokens("1000000"), { from: owner });

    console.log("Approvals succeeded, providing liquidity for LIME-BNB and LIME-BUSD");

    await pancakeRouter.methods
      .addLiquidityETH(limeToken.address, tokens("2000"), "0", "0", owner, 1e12)
      .send({ from: owner, value: tokens("0.1"), gas });

    console.log("First liquidity added");

    await pancakeRouter.methods
      .addLiquidity(
        limeToken.address,
        BUSD,
        tokens("1000"),
        tokens("20"),
        tokens("0"),
        tokens("0"),
        owner,
        Date.now() + 1e12
      )
      .send({ from: owner, gas });

    console.log("LIME Liquidity succeed");

    // Lime pairs
    const busdPair = await pancakeFactory.methods.getPair(limeToken.address, BUSD).call();
    const bnbPair = await pancakeFactory.methods.getPair(limeToken.address, WBNB).call();

    // Other pairs
    const bnbBusd = await pancakeFactory.methods.getPair(BUSD, WBNB).call();
    const daiBusd = await pancakeFactory.methods.getPair(BUSD, DAI).call();

    // MAINNET
    // const btcBnb = await pancakeFactory.methods.getPair(BTC, WBNB).call();
    // const usdcBusd = await pancakeFactory.methods.getPair(USDC, BUSD).call();

    // ------- FARMS -------
    console.log("Creating Farms...");

    // BNB/LIME LP - Tax free
    await tokenFarm.createPool(bnbPair, tokens("10"), true);
    console.log("BNB/LIME created, address: ", bnbPair);

    // BUSD/LIME LP - Tax free
    await tokenFarm.createPool(busdPair, tokens("10"), true);
    console.log("BUSD/LIME created, address: ", busdPair);

    console.log("Tax-free pools created");

    // BNB/BUSD LP
    await tokenFarm.createPool(bnbBusd, tokens("7.5"), false);
    console.log("BNB/BUSD created, address: ", bnbBusd);

    // DAI/BUSD LP
    await tokenFarm.createPool(daiBusd, tokens("7.5"), false);
    console.log("DAI/BUSD created, address: ", daiBusd);

    // // BTC/BNB LP
    // await tokenFarm.createPool(btcBnb, tokens("7.5"), false);
    // console.log("BTC/BNB created, address: ", btcBnb);

    // // USDC/BUSD LP
    // await tokenFarm.createPool(usdcBusd, tokens("7.5"), false);
    // console.log("USDC/BUSD created, address: ", usdcBusd);

    // ------- POOLS -------
    console.log("Creating pools...");

    // LIME
    await tokenFarm.createPool(limeToken.address, tokens("12.5"), true);

    // BNB
    await tokenFarm.createPool(WBNB, tokens("15"), false);

    // BUSD
    await tokenFarm.createPool(BUSD, tokens("15"), false);

    // ETH
    await tokenFarm.createPool(ETH, tokens("8.5"), false);

    // CAKE
    await tokenFarm.createPool(CAKE, tokens("8.5"), false);

    console.log("Success");
  } catch (e) {
    console.error(e);
  }
};
