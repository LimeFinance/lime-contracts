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
const { ADDRESSES } = require("../constants");

const { OPERATOR_ADDRESS } = process.env;
const {
  pancakeRouter: pancakeRouterAddr,
  pancakeFactory: pancakeFactoryAddr,
  BUSD,
  USDT,
  WBNB,
  ETH,
  DAI,
} = ADDRESSES.testnet;

module.exports = async (cb) => {
  try {
    // perform actions
    const tokenFarm = await TokenFarm.deployed();
    const limeToken = await LimeToken.deployed();
    const busdToken = await BEP20.at(BUSD);
    const usdtToken = await BEP20.at(USDT);
    const wbnbToken = await BEP20.at(WBNB);
    const pancakeRouter = new web3.eth.Contract(PancakeRouter, pancakeRouterAddr);
    const pancakeFactory = new web3.eth.Contract(PancakeFactory, pancakeFactoryAddr);

    await pancakeRouter.methods
      .swapExactETHForTokens(0, [WBNB, USDT], OPERATOR_ADDRESS, Date.now() + 1e12)
      .send({
        from: OPERATOR_ADDRESS,
        value: tokens("0.1"),
      });

    await pancakeRouter.methods
      .swapExactETHForTokens("0", [WBNB, BUSD], OPERATOR_ADDRESS, Date.now() + 1e12)
      .send({
        from: OPERATOR_ADDRESS,
        value: tokens("0.1"),
      });

    await limeToken.approve(pancakeRouter, tokens("10000000"));
    await busdToken.approve(pancakeRouter, tokens("1000000"), { from: OPERATOR_ADDRESS });
    await wbnbToken.approve(pancakeRouter, tokens("1000000"), { from: OPERATOR_ADDRESS });
    await usdtToken.approve(pancakeRouter, tokens("1000000"), { from: OPERATOR_ADDRESS });

    console.log("Approvals succeeded, providing liquidity for LIME-BNB and LIME-BUSD");

    await pancakeRouter.methods
      .addLiquidity(
        limeToken.address,
        BUSD,
        tokens("1000"),
        tokens("20"),
        tokens("0"),
        tokens("0"),
        OPERATOR_ADDRESS,
        Date.now() + 1e12
      )
      .send({ from: OPERATOR_ADDRESS, gas: 5000000 });

    console.log("First liquidity added");

    await pancakeRouter.methods
      .addLiquidityETH(limeToken.address, tokens("2000"), "0", "0", OPERATOR_ADDRESS, 1e12)
      .send({ from: OPERATOR_ADDRESS, value: tokens("0.1") });

    console.log("LIME Liquidity succeed");

    const busdPair = await pancakeFactory.methods.getPair(limeToken.address, BUSD).call();
    const bnbPair = await pancakeFactory.methods.getPair(limeToken.address, WBNB).call();
    const usdtBusd = await pancakeFactory.methods.getPair(BUSD, USDT).call();
    const ethBnb = await pancakeFactory.methods.getPair(ETH, WBNB).call();
    const bnbBusd = await pancakeFactory.methods.getPair(BUSD, WBNB).call();
    const daiBusd = await pancakeFactory.methods.getPair(BUSD, DAI).call();

    // ------- FARMS -------
    console.log("Creating Farms...");

    // BUSD/LIME LP - Tax free
    await tokenFarm.createPool(busdPair, tokens("10"), true);
    console.log("BUSD/LIME created, address: ", busdPair);

    // BNB/LIME LP - Tax free
    await tokenFarm.createPool(bnbPair, tokens("7.5"), true);
    console.log("BNB/LIME created, address: ", bnbPair);

    console.log("Tax-free pools created");

    // USDT/BUSD LP
    await tokenFarm.createPool(usdtBusd, tokens("7.5"), false);
    console.log("USDT/BUSD created, address: ", usdtBusd);

    // ETH/BNB LP
    await tokenFarm.createPool(ethBnb, tokens("7.5"), false);
    console.log("ETH/BNB created, address: ", ethBnb);

    // BNB/BUSD LP
    await tokenFarm.createPool(bnbBusd, tokens("7.5"), false);
    console.log("BNB/BUSD created, address: ", bnbBusd);

    // DAI/BUSD LP
    await tokenFarm.createPool(daiBusd, tokens("7.5"), false);
    console.log("DAI/BUSD created, address: ", daiBusd);

    // ------- POOLS -------
    console.log("Creating pools...");

    // LIME
    await tokenFarm.createPool(limeToken.address, tokens("5"), false);

    // BUSD
    await tokenFarm.createPool(BUSD, tokens("9.75"), false);

    // USDT
    await tokenFarm.createPool(USDT, tokens("9.75"), false);

    // BNB
    await tokenFarm.createPool(WBNB, tokens("9.75"), false);
  } catch (e) {
    console.error(e);
  }
  cb();
};
