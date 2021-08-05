const Lottery = artifacts.require("Lottery");
const VRFCoordinatorMock = artifacts.require("VRFCoordinatorMock");
const Randomness = artifacts.require("RandomNumberConsumer");

module.exports = async (cb) => {
  try {
    const lottery = await Lottery.at("0x8bD0B15177B67676a3f27b7240FEfC8228f67108");
    // const vrfCoordinatorMock = await VRFCoordinatorMock.deployed();
    // const randomness = await Randomness.deployed();

    const tx = await lottery.endLottery();
    console.log(tx);

    // // Comment the following if not in development
    // await vrfCoordinatorMock.callBackWithRandomness(
    //   tx.receipt.rawLogs[3].topics[0],
    //   "777",
    //   randomness.address
    // );
  } catch (e) {
    console.error(e);
  }
  cb();
};
