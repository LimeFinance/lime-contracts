const LotteryGovernance = artifacts.require("LotteryGovernance");

module.exports = async (deployer, network, [owner]) => {
  if (network === "bsc") return;
  await deployer.deploy(LotteryGovernance);
};
