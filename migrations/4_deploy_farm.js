require("dotenv").config({
  path: "../.env",
});

const { ADDRESSES } = require("../constants");

const LimeToken = artifacts.require("LimeToken");
const TokenFarm = artifacts.require("TokenFarm");
const Distribution = artifacts.require("Distribution");

module.exports = async (deployer, network) => {
  if (network === "bsc") return;
  const limeToken = await LimeToken.deployed();

  if (network == "testnet" || network === "development") {
    const distribution = await Distribution.deployed();
    await deployer.deploy(TokenFarm, distribution.address, limeToken.address);
    const tokenFarm = await TokenFarm.deployed();

    await limeToken.transferOwnership(tokenFarm.address);
  }
};
