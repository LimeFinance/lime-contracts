const { ADDRESSES } = require("../constants");

require("dotenv").config({
  path: "../.env",
});

const LimeToken = artifacts.require("LimeToken");
const MockBEP20 = artifacts.require("MockBEP20");

module.exports = async (deployer, network, [owner]) => {
  const { pancakeRouter, pancakeFactory } = ADDRESSES[network !== "bsc" ? "testnet" : "bsc"];

  if (network === "bsc") {
    await deployer.deploy(LimeToken);
    const limeToken = await LimeToken.deployed();
    console.log(limeToken.address);
  }

  // if (network === "development") {
  //   await deployer.deploy(MockBEP20);
  // }
  // if (network == "development" || network === "testnet") {
  //   await deployer.deploy(LimeToken);
  // }

  // Router
  await limeToken.setExcludedFromAntiWhale(pancakeRouter, true);
  // Factory
  await limeToken.setExcludedFromAntiWhale(pancakeFactory, true);
  // Operator
  await limeToken.setExcludedFromAntiWhale(owner, true);
};
