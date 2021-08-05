require("dotenv").config();

const LimeToken = artifacts.require("LimeToken");
const Lottery = artifacts.require("Lottery");
const PancakeRouter = require("../abis/PancakeRouter.json");

const tokens = (amount) => web3.utils.toWei(amount);


module.exports = async (cb) => {
  const limeToken = await LimeToken.deployed();
  const lottery = await Lottery.deployed();
  const accounts = await web3.eth.getAccounts(); 

	await limeToken.transfer(process.env.OPERATOR_ADDRESS, tokens("10000"))


  cb();
};
