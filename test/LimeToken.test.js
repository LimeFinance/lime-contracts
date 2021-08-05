require("dotenv").config();

const truffleAssert = require("truffle-assertions");

const LimeToken = artifacts.require("LimeToken");
const BEP20 = artifacts.require("MockBEP20");

const PancakeRouter = require("../abis/PancakeRouter.json");
const PancakeFactory = require("../abis/PancakeFactory.json");
const PancakePair = require("../abis/PancakePair.json");
const { ADDRESSES, SAFE_GAS } = require("../constants");
const truffleAssertions = require("truffle-assertions");
const { revertToSnapShot, takeSnapshot, tokens } = require("./utils");

const {
  pancakeRouter: pancakeRouterAddr,
  pancakeFactory: pancakeFactoryAddr,
  WBNB,
  BUSD,
} = ADDRESSES["testnet"];

contract("LimeToken", ([owner, whale, alice, bob, dev]) => {
  before(async () => {
    limeToken = await LimeToken.new();
    busdToken = await BEP20.at(BUSD);
    wbnbToken = await BEP20.at(WBNB);
    pancakeRouter = new web3.eth.Contract(PancakeRouter, pancakeRouterAddr);
    pancakeFactory = new web3.eth.Contract(PancakeFactory, pancakeFactoryAddr);

    await wbnbToken.approve(pancakeRouterAddr, tokens("10000"));

    await pancakeRouter.methods
      .swapExactETHForTokens(tokens("100"), [WBNB, BUSD], owner, Date.now() + 1e12)
      .send({
        from: owner,
        value: tokens("1"),
        gas: SAFE_GAS,
      });

    await limeToken.approve(pancakeRouterAddr, tokens("1000000"), { from: owner });
    await busdToken.approve(pancakeRouterAddr, tokens("1000000"), { from: owner });
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    snapshotId = snapshot.result;
  });

  // afterEach(async () => {
  //   await revertToSnapShot(snapshotId);
  // });

  it("allows the owner to provide liquidity", async () => {
    await pancakeRouter.methods
      .addLiquidity(
        limeToken.address,
        BUSD,
        tokens("1000"), // more than 5%
        tokens("10"),
        tokens("0.1"),
        tokens("0.1"),
        owner,
        Date.now() + 1e12
      )
      .send({ from: owner, gas: 5000000 });
  });

  it("Prevents whales", async () => {
    await pancakeRouter.methods
      .addLiquidity(
        limeToken.address,
        BUSD,
        tokens("10000"), // more than 5%
        tokens("10"),
        tokens("0.1"),
        tokens("0.1"),
        owner,
        Date.now() + 1e12
      )
      .send({ from: owner, gas: SAFE_GAS });

    busdToken.transfer(whale, tokens("100"));
    busdToken.approve(pancakeRouterAddr, tokens("1000000"), { from: whale });

    await truffleAssert.reverts(
      pancakeRouter.methods
        .swapTokensForExactTokens(
          tokens("1001"), // More than 5% - It doesn't work
          tokens("100"),
          [BUSD, limeToken.address],
          whale,
          Date.now() + 1e12
        )
        .send({ from: whale, gas: SAFE_GAS }),
      "Pancake: TRANSFER_FAILED"
    );
    await pancakeRouter.methods
      .swapTokensForExactTokens(
        tokens("999"), // Less than 5% - It works
        tokens("100"),
        [BUSD, limeToken.address],
        whale,
        Date.now() + 1e12
      )
      .send({ from: whale, gas: SAFE_GAS });
  });
});
