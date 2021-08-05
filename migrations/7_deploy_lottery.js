const LotteryGovernance = artifacts.require("LotteryGovernance");
const LimeToken = artifacts.require("LimeToken");
const Distribution = artifacts.require("Distribution");
const Lottery = artifacts.require("Lottery");
const { ADDRESSES } = require("../constants");

module.exports = async (deployer, network, [owner]) => {
  if (network === "bsc") return;
  const { LINK } = ADDRESSES[network !== "bsc" ? "testnet" : "bsc"];
  const lotteryGovernance = await LotteryGovernance.deployed();
  const limeToken = await LimeToken.deployed();
  const distribution = await Distribution.deployed();
  await deployer.deploy(Lottery, lotteryGovernance.address, LINK, limeToken.address);

  if (network !== "development") {
    await distribution.addProduct((await Lottery.deployed()).address, 1);
  }
};
