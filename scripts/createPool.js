require("dotenv").config({ path: "../.env" });

const tokens = (amount) => {
  return web3.utils.toWei(amount);
};

const TokenFarm = artifacts.require("TokenFarm");

const ADDRESSES = {
  pancakeRouter: "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3",
  pancakeFactory: "0xb7926c0430afb07aa7defde6da862ae0bde767bc",
  BUSD: "0x78867bbeef44f2326bf8ddd1941a4439382ef2a7",
  USDT: "0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684",
  WBNB: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
  ETH: "0x8babbb98678facc7342735486c851abd7a0d17ca",
  DAI: "0x8a9424745056eb399fd19a0ec26a14316684e274",
};

module.exports = async (cb) => {
  const tokenFarm = await TokenFarm.deployed();
  await tokenFarm.createPool(ADDRESSES.USDT, tokens("5.65"), false);
  await tokenFarm.createPool(ADDRESSES.DAI, tokens("5.45"), false);

  cb();
};
