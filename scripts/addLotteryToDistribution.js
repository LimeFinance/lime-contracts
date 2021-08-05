const Lottery = artifacts.require("Lottery");
const Distribution = artifacts.require("Distribution");

module.exports = async (cb) => {
  try {
    // const lottery = await Lottery.at("");
    const distribution = await Distribution.at("");

    await distribution.addProduct("", 1);
  } catch (e) {
    console.error(e);
  }
  cb();
};
