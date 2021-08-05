require("dotenv").config();
const BN = require("bn.js");

const {
  takeSnapshot,
  revertToSnapShot,
  tokens,
  advanceTimeAndBlock,
  advanceUntilHarvesting,
  tokensBN,
  advanceTime,
  advanceBlocks,
} = require("./utils");

const truffleAssert = require("truffle-assertions");
const { ADDRESSES, SAFE_GAS_PRICE } = require("../constants");

const LimeToken = artifacts.require("LimeToken");
const TokenFarm = artifacts.require("TokenFarm");
const Distribution = artifacts.require("Distribution");
const MockBEP20 = artifacts.require("MockBEP20");
const PancakeRouter = require("../abis/PancakeRouter.json");
const WETH = require("../abis/WETH.json");

const DAY_SECONDS = 86400;
const { BUSD, WBNB, USDT, LINK, pancakeRouter: pancakeRouterAddr } = ADDRESSES.testnet;

contract("TokenFarm", async ([owner, investor, otherInvestor]) => {
  beforeEach(async () => {
    snapshot = await takeSnapshot();
    snapshotId = snapshot.result;
  });

  before(async () => {
    limeToken = await LimeToken.new();
    distribution = await Distribution.new(process.env.DEV_ADDRESS, pancakeRouterAddr);
    tokenFarm = await TokenFarm.new(distribution.address, limeToken.address);
    token1 = await MockBEP20.at(BUSD);
    token2 = await MockBEP20.at(USDT);
    token3 = await MockBEP20.new();
    wbnb = new web3.eth.Contract(WETH, WBNB);
    pancakeRouter = new web3.eth.Contract(PancakeRouter, pancakeRouterAddr);

    await limeToken.transferOwnership(tokenFarm.address);

    await wbnb.methods.deposit().send({ from: owner, value: tokens("90") });
    await wbnb.methods.approve(pancakeRouterAddr, tokens("1000000")).send({ from: owner });

    await pancakeRouter.methods
      .swapExactTokensForTokens(tokens("10"), tokens("300"), [WBNB, USDT], owner, Date.now() + 1e12)
      .send({
        from: owner,
        gas: 1000000,
      });
    await pancakeRouter.methods
      .swapExactTokensForTokens(tokens("80"), tokens("300"), [WBNB, BUSD], owner, Date.now() + 1e12)
      .send({
        from: owner,
        gas: 1000000,
      });

    await token1.approve(pancakeRouterAddr, tokens("10000"));
    await token2.approve(pancakeRouterAddr, tokens("10000"));
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  it("Indicates the harvesting period correctly", async () => {
    let periodCount = 0;

    for (let i = 0; i < 28; i++) {
      const isHarvestingPeriod = await tokenFarm.isHarvestingPeriod();

      if (isHarvestingPeriod) {
        periodCount++;
      }

      await advanceTimeAndBlock(DAY_SECONDS); // advance one day
    }

    // There should be 2 harvesting periods in 28 days
    assert.equal(periodCount, 2);
  });

  it("Denies access to non-owners", async () => {
    await truffleAssert.reverts(
      tokenFarm.createPool(token1.address, tokens("1"), false, {
        from: investor,
      }),
      "Ownable: caller is not the owner"
    );
  });

  it("Creates pools correctly", async () => {
    const totalPoolsBefore = await tokenFarm.totalPools();
    assert.equal(totalPoolsBefore, 0, "There is more than 1 pool");

    await tokenFarm.createPool(token1.address, tokens("1"), false);
    await tokenFarm.createPool(token2.address, tokens("1"), false);
    await tokenFarm.createPool(token3.address, tokens("1"), false);

    const totalPoolsAfter = await tokenFarm.totalPools();
    assert.equal(totalPoolsAfter.toNumber(), 3);
  });

  it("Deposits the tokens correctly", async () => {
    // First give the investor some money
    await token1.transfer(investor, tokens("100"));
    await token2.transfer(investor, tokens("1000"));
    await token2.transfer(otherInvestor, tokens("1000"));

    const investorBalanceStart1 = await token1.balanceOf(investor);
    const investorBalanceStart2 = await token2.balanceOf(investor);
    const otherInvestorBalance = await token2.balanceOf(otherInvestor);

    // Make sure they recieved it
    assert.equal(investorBalanceStart1, tokens("100"));
    assert.equal(investorBalanceStart2, tokens("1000"));
    assert.equal(otherInvestorBalance, tokens("1000"));

    // Create the pools
    await tokenFarm.createPool(token1.address, tokens("1"), false);
    await tokenFarm.createPool(token2.address, tokens("1"), false);

    // Approve and deposit as the investor
    await token1.approve(tokenFarm.address, tokens("100"), {
      from: investor,
    });
    await token2.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });
    await token2.approve(tokenFarm.address, tokens("1000"), {
      from: otherInvestor,
    });

    await tokenFarm.depositTokens(tokens("100"), 0, {
      from: investor,
      gas: SAFE_GAS_PRICE,
    });
    await tokenFarm.depositTokens(tokens("600"), 1, {
      from: investor,
      gas: SAFE_GAS_PRICE,
    });
    await tokenFarm.depositTokens(tokens("400"), 1, {
      from: investor,
      gas: SAFE_GAS_PRICE,
    });
    await tokenFarm.depositTokens(tokens("1000"), 1, {
      from: otherInvestor,
      gas: SAFE_GAS_PRICE,
    });

    // Test if the balace has been substracted
    const investorBalanceEnd1 = await token1.balanceOf(investor);
    const investorBalanceEnd2 = await token2.balanceOf(investor);
    const otherInvestorBalanceEnd = await token2.balanceOf(otherInvestor);

    assert.equal(investorBalanceEnd1, 0);
    assert.equal(investorBalanceEnd2, 0);
    assert.equal(otherInvestorBalanceEnd, 0);

    const investorPoolBalance1 = await tokenFarm.userStakeInPool(0, {
      from: investor,
    });
    const investorPoolBalance2 = await tokenFarm.userStakeInPool(1, {
      from: investor,
    });

    const poolSize = await tokenFarm.getPoolSize(1);

    assert.equal(poolSize, tokens("1982"));

    // There is balance and it's taxed correctly
    assert.equal(investorPoolBalance1, tokens("99.1"));
    assert.equal(investorPoolBalance2, tokens("991"));

    // There is balance and it's taxed correctly
    const devBalance = new BN(await web3.eth.getBalance(process.env.DEV_ADDRESS));

    // 0.056655050939276667
    assert.equal(devBalance.gt(tokensBN("0.05")), devBalance.lt(tokensBN("0.055")));
  });

  it("Withdraws the tokens correctly", async () => {
    await tokenFarm.createPool(token1.address, tokens("1"), false);
    await token1.transfer(investor, tokens("1000"));
    await token1.transfer(otherInvestor, tokens("200"));
    await token1.approve(tokenFarm.address, tokens("1000"), { from: investor });
    await token1.approve(tokenFarm.address, tokens("200"), { from: otherInvestor });

    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });
    await tokenFarm.depositTokens(tokens("200"), 0, { from: otherInvestor });

    await tokenFarm.withdrawTokens(tokens("100"), 0, { from: investor });
    const investorBalanceAfter = await token1.balanceOf(investor);
    const investorStakeAfter = await tokenFarm.userStakeInPool(0, { from: investor });
    const devBalanceAfter = await token1.balanceOf(process.env.DEV_ADDRESS);
    const poolSizeAfter = await tokenFarm.getPoolSize(0);

    assert.equal(investorBalanceAfter, tokens("96.5"));
    assert.equal(investorStakeAfter, tokens("891"));
    // assert.equal(devBalanceAfter, tokens("14.3"));
    assert.equal(poolSizeAfter, tokens("1089.2"));
  });

  it("Prevents invalid deposits", async () => {
    await tokenFarm.createPool(token1.address, tokens("1"), false);
    await tokenFarm.createPool(token2.address, tokens("1"), false);

    await token1.approve(tokenFarm.address, tokens("100"), { from: investor });

    // Try to deposit without the needed funds
    await truffleAssert.reverts(
      tokenFarm.depositTokens(tokens("10"), 0, {
        from: investor,
      }),
      "BEP20: transfer amount exceeds balance"
    );

    await token1.transfer(investor, tokens("100"));

    await truffleAssert.reverts(
      tokenFarm.depositTokens(0, 1, { from: investor }),
      "LIME_FARM: Amount must be greater than 0"
    );

    await truffleAssert.reverts(
      tokenFarm.withdrawTokens(1, 0, { from: investor }),

      "LIME_FARM: Invalid withdrawal amount"
    );

    // Cannot deposit 0 tokens
    await truffleAssert.reverts(
      tokenFarm.depositTokens(tokens("0"), 0, {
        from: investor,
      }),
      "LIME_FARM: Amount must be greater than 0"
    );

    // Try to deposit tokens in a non-exisitng pool
    await truffleAssert.reverts(
      tokenFarm.depositTokens(tokens("100"), 10, {
        from: investor,
      })
    );
  });

  it("Prevents invalid withdrawals", async () => {
    await token1.transfer(investor, tokens("1000"));
    await tokenFarm.createPool(token1.address, tokens("1"), false);

    // Try to withdraw in an existing pool without funds
    await truffleAssert.reverts(
      tokenFarm.withdrawTokens(tokens("10"), 0),
      "LIME_FARM: Invalid withdrawal amount"
    );

    // Try to withdraw in a non-existing pool
    await truffleAssert.reverts(tokenFarm.withdrawTokens(tokens("10"), 5));

    await token1.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });

    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });
    await tokenFarm.withdrawTokens(tokens("500"), 0, { from: investor });
    await truffleAssert.reverts(
      tokenFarm.withdrawTokens(tokens("500"), 0),
      "LIME_FARM: Invalid withdrawal amount"
    );
  });

  it("Harvests tokens correctly", async () => {
    await tokenFarm.createPool(token1.address, tokens("100"), false);
    // Inital transfers and approvals
    await token1.transfer(investor, tokens("1000"));
    await token1.transfer(otherInvestor, tokens("10000"));
    await token1.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });
    await token1.approve(tokenFarm.address, tokens("10000"), {
      from: otherInvestor,
    });

    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });
    await tokenFarm.depositTokens(tokens("10000"), 0, { from: otherInvestor });

    await advanceBlocks(8);

    await tokenFarm.withdrawTokens(tokens("800"), 0, { from: investor });

    await advanceBlocks(19);

    await token1.approve(tokenFarm.address, tokens("50"), { from: investor });
    await tokenFarm.depositTokens(tokens("50"), 0, { from: investor });

    await advanceBlocks(18);

    await tokenFarm.withdrawTokens(tokens("240.55"), 0, { from: investor });

    await advanceUntilHarvesting(tokenFarm);

    await tokenFarm.harvestLimes(0, { from: investor });

    const poolSize = await tokenFarm.getPoolSize(0);
    const userStake = await tokenFarm.userStakeInPool(0, { from: investor });
    const userTokenBalance = await token1.balanceOf(investor);
    const devBalance = new BN(await web3.eth.getBalance(process.env.DEV_ADDRESS));
    const userLimes = await limeToken.balanceOf(investor);

    assert(poolSize.eq(tokensBN("9910")), "Pool size is not correct");
    assert(userStake.eq(tokensBN("0")), "User stake is not correct");
    assert(userTokenBalance.eq(tokensBN("954.13075")), "User Token balance is not correct");
    assert(
      devBalance.gt(tokensBN("1")) && devBalance.lt(tokensBN("2")),
      "Dev Token balance is not correct"
    );
    assert(
      userLimes.gt(tokensBN("175")) && userLimes.lt(tokensBN("177")),
      "User Limes balance is not correct"
    );
  });

  it("Denies harvesting in non-harvesting periods", async () => {
    await tokenFarm.createPool(token1.address, tokens("100"), false);
    await token1.transfer(investor, tokens("1000"));
    await token1.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });
    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });

    await advanceUntilHarvesting(tokenFarm);
    await advanceTime(DAY_SECONDS);

    await truffleAssert.reverts(
      tokenFarm.harvestLimes(0, { from: investor }),
      "LIME_FARM: Not in harvesting period"
    );
  });

  it("Creates tax-free pools", async () => {
    await tokenFarm.createPool(token1.address, tokens("10"), true);
    await token1.transfer(investor, tokens("1000"));
    await token1.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });
    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });
    const userStakeWhenDeposit = await tokenFarm.userStakeInPool(0, { from: investor });
    assert.equal(userStakeWhenDeposit, tokens("1000"));

    await tokenFarm.withdrawTokens(tokens("1000"), 0, { from: investor });
    const userBalance = await token1.balanceOf(investor);
    assert.equal(userBalance, tokens("1000"));
  });
  it("Indicates the harvesting amount correctly", async () => {
    await tokenFarm.createPool(token1.address, tokens("100"), false);

    // Inital transfers and approvals
    await token1.transfer(investor, tokens("1000"));
    await token1.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });
    await token1.transfer(otherInvestor, tokens("10000"));
    await token1.approve(tokenFarm.address, tokens("10000"), {
      from: otherInvestor,
    });

    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });
    await tokenFarm.depositTokens(tokens("10000"), 0, { from: otherInvestor });

    await advanceBlocks(18);

    await tokenFarm.withdrawTokens(tokens("900"), 0, { from: investor });

    await advanceBlocks(19);

    const availableHarvest = await tokenFarm.userAvailableHarvest(0, { from: investor });

    assert(availableHarvest.gt(tokensBN("199")) && availableHarvest.lt(tokensBN("201")));
  });

  it("Prevents ambitious pools", async () => {
    await truffleAssert.reverts(
      tokenFarm.createPool(token1.address, tokens("101"), false),
      "LIME_FARM: Ambitious pool creation"
    );
    await tokenFarm.createPool(token1.address, tokens("100"), false);
    await tokenFarm.createPool(token2.address, tokens("100"), false);
    await tokenFarm.createPool(token3.address, tokens("100"), false);
    await tokenFarm.createPool(token2.address, tokens("100"), false);
    await truffleAssert.reverts(
      tokenFarm.createPool(token3.address, tokens("100"), true),
      "LIME_FARM: Ambitious pool creation"
    );
  });

  it("Checkpoints the pool correctly", async () => {
    await tokenFarm.createPool(token1.address, tokens("100"), false);

    // Inital transfers and approvals
    await token1.transfer(investor, tokens("1000"));
    await token1.approve(tokenFarm.address, tokens("1000"), {
      from: investor,
    });
    await token1.transfer(otherInvestor, tokens("10000"));
    await token1.approve(tokenFarm.address, tokens("10000"), {
      from: otherInvestor,
    });

    await tokenFarm.depositTokens(tokens("1000"), 0, { from: investor });

    await advanceBlocks(20); // 20 blocks, earn rewards
    const availableHarvestBefore = await tokenFarm.userAvailableHarvest(0, { from: investor });
    assert(availableHarvestBefore.eq(tokensBN("2000")), "Before: Rewards not correct");

    // CHECKPOINT the available harvest
    await tokenFarm.checkpoint(0, { from: investor });

    await tokenFarm.depositTokens(tokens("1000"), 0, { from: otherInvestor });
    const availableHarvestAfter = await tokenFarm.userAvailableHarvest(0, { from: investor });
    assert(
      availableHarvestAfter.lt(tokensBN("2160")) && availableHarvestAfter.gt(tokensBN("2110")),
      "After: Rewards not correct"
    );
  });
});
