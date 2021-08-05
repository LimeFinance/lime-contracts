const Lottery = artifacts.require("Lottery");

module.exports = async (cb) => {
  try {
    const lottery = await Lottery.deployed();
    await lottery.startNewLottery();
  } catch (e) {
    console.error(e);
  }
  cb();
};
