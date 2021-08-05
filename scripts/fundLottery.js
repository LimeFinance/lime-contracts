require("dotenv").config();

const LimeToken = artifacts.require("LimeToken");
const Lottery = artifacts.require("Lottery");
const PancakeRouter = require("../abis/PancakeRouter.json");

const tokens = (amount) => web3.utils.toWei(amount);


module.exports = async (cb) => {
  const limeToken = await LimeToken.deployed();
  const lottery = await Lottery.deployed();
  const accounts = await web3.eth.getAccounts(); 

  await web3.eth.sendTransaction({from:accounts[0], to:lottery.address, value:tokens("10.12312")})


  cb();
};
