const { ADDRESSES } = require("../constants");
const LimeToken = artifacts.require("LimeToken");

module.exports = async (cb) => {
  const limeToken = await LimeToken.at("");
  const { pancakeRouter, pancakeFactory } = ADDRESSES["bsc"];

  // Router
  await limeToken.setExcludedFromAntiWhale(pancakeRouter, true);
  // Factory
  await limeToken.setExcludedFromAntiWhale(pancakeFactory, true);
  // Operator
  await limeToken.setExcludedFromAntiWhale("", true);
};
