require("dotenv").config({
  path: "../.env",
});

const { ADDRESSES } = require("../constants");

const Distribution = artifacts.require("Distribution");

module.exports = async (deployer, network) => {
  const validAddresses = ADDRESSES[network !== "bsc" ? "testnet" : "bsc"];
  if (network == "testnet" || network === "development") {
    await deployer.deploy(Distribution, process.env.DEV_ADDRESS, validAddresses.pancakeRouter);
  }
};
