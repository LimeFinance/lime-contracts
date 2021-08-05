require("dotenv").config();
const { ADDRESSES } = require("../constants");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const Web3 = require("web3");
const RandomNumberConsumer = artifacts.require("RandomNumberConsumer");
const LotteryGovernance = artifacts.require("LotteryGovernance");
const Lottery = artifacts.require("Lottery");
const BEP20 = artifacts.require("MockBEP20");
const ILINK = artifacts.require("LinkTokenInterface");
const VRFCoordinatorMock = artifacts.require("VRFCoordinatorMock");
const IERC20 = require("../abis/IERC20.json");

module.exports = async (deployer, network) => {
  if (network === "bsc") return;
  const { VRF, LINK, KEY_HASH, linkFee } = ADDRESSES[network !== "bsc" ? "testnet" : "bsc"];

  const lotteryGovernance = await LotteryGovernance.deployed();
  const lottery = await Lottery.deployed();

  let randomness;
  if (network === "development") {
    const linkToken = await ILINK.at(LINK);
    const vrfCoordinator = await deployer.deploy(VRFCoordinatorMock, linkToken.address);

    await deployer.deploy(
      RandomNumberConsumer,
      lotteryGovernance.address,
      KEY_HASH,
      linkFee,
      vrfCoordinator.address,
      linkToken.address
    );
    randomness = await RandomNumberConsumer.deployed();

    _web3 = new Web3(new HDWalletProvider(process.env.OPERATOR_PK, `http://127.0.0.1:8545`));
    const linkTokenw3 = new _web3.eth.Contract(IERC20.abi, LINK);
    await linkTokenw3.methods
      .transfer(randomness.address, web3.utils.toWei("2.5"))
      .send({ from: process.env.OPERATOR_ADDRESS });
    await linkTokenw3.methods
      .transfer(lottery.address, web3.utils.toWei("2.5"))
      .send({ from: process.env.OPERATOR_ADDRESS });
  } else {
    await deployer.deploy(
      RandomNumberConsumer,
      lotteryGovernance.address,
      KEY_HASH,
      linkFee,
      VRF,
      LINK
    );
    randomness = await RandomNumberConsumer.deployed();
    const linkToken = await ILINK.at(LINK);
    await linkToken.transfer(randomness.address, web3.utils.toWei("5"));
  }

  console.log(lottery.address, randomness.address);
  await lotteryGovernance.init(lottery.address, randomness.address);
};
