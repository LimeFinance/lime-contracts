const { tokens, tokensBN, fromTokens } = require("./utils");

const Lottery = artifacts.require("Lottery");
const LimeToken = artifacts.require("LimeToken");
const RandomNumberConsumer = artifacts.require("RandomNumberConsumer");
const VRFCoordinatorMock = artifacts.require("VRFCoordinatorMock");
const BEP20 = artifacts.require("MockBEP20");

const { reverts } = require("truffle-assertions");
const { SAFE_GAS, ADDRESSES } = require("../constants");

const { LINK } = ADDRESSES.testnet;

contract("Lottery", ([owner, alice, bob, carlos]) => {
  before(async () => {
    lottery = await Lottery.deployed();
    randomness = await RandomNumberConsumer.deployed();
    vrfCoordinatorMock = await VRFCoordinatorMock.deployed();
    linkToken = await BEP20.at(LINK);
    limeToken = await LimeToken.deployed();

    await limeToken.transfer(alice, tokens("1000"));
    await limeToken.transfer(bob, tokens("1000"));
    await limeToken.transfer(carlos, tokens("1000"));
    await limeToken.approve(lottery.address, tokens("1000"), { from: alice });
    await limeToken.approve(lottery.address, tokens("1000"), { from: bob });
    await limeToken.approve(lottery.address, tokens("1000"), { from: carlos });
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    snapshotId = snapshot.result;
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  it("Allows the users to participate burning lime", async () => {
    await lottery.startNewLottery();

    await lottery.buyTickets([1, 2, 3, 4, 5, 6, 7, 8], { from: alice });
    // Balance after - 0.8% of totalSupp
    const aliceBalance = await limeToken.balanceOf(alice);
    assert(aliceBalance.eq(tokensBN("840")), "Alice's balance is incorrect");

    await lottery.buyTickets([9, 10, 11, 12, 13], { from: bob });
    const bobBalance = await limeToken.balanceOf(bob);
    // Balance after - 0.5% of totalSupp
    assert(bobBalance.eq(tokensBN("900.8")), "Bob's balance is incorrect");

    assert((await limeToken.totalSupply()).eq(tokensBN("19740.8")), "Total supply is incorrect");
  });

  it("Does not allow invalid ticket purcahses", async () => {
    // Buying when the lottery is closed
    await reverts(lottery.buyTickets([1, 2, 3, 4, 5, 6, 7, 8], { from: alice }));

    await lottery.startNewLottery();

    await lottery.buyTickets([1, 2, 3, 4, 5, 6, 7, 8], { from: alice });
    // Buying the same number as another user
    await reverts(
      lottery.buyTickets([9, 10, 8, 12, 13], { from: bob }),
      "One of the numbers is already taken"
    );

    // Buying more than 49 tickets
    await reverts(
      lottery.buyTickets(
        Array.from({ length: 50 }, (x, i) => i),
        { from: carlos }
      ),
      "Can't buy more than 49 tickets"
    );

    // Buying some tickets below the limit and then surpassing the limit
    // (Alice has already bought 8 -> Has 41 remaining)
    await reverts(
      lottery.buyTickets(
        Array.from({ length: 42 }, (x, i) => i),
        { from: alice }
      ),
      "Can't buy more than 49 tickets"
    );

    // Buying repeated numbers
    await reverts(
      lottery.buyTickets([1, 2, 3, 1], { from: bob }),
      "One of the numbers is already taken"
    );

    // Buying a higher number than the max. (100_000)
    await reverts(
      lottery.buyTickets([100, 200, 100001], { from: alice }),
      "Number is higher than the max"
    );
  });

  it("Plays correctly and picks the winner", async () => {
    await web3.eth.sendTransaction({ from: owner, to: lottery.address, value: tokens("10") });
    await lottery.startNewLottery();

    // Participants
    await lottery.buyTickets([1, 2, 3, 4, 5, 6, 7, 8], { from: alice, gas: SAFE_GAS });
    await lottery.buyTickets([9, 10, 11, 12, 13, 14], { from: bob, gas: SAFE_GAS });
    await lottery.buyTickets([15, 16, 17, 18, 19, 20], { from: carlos, gas: SAFE_GAS });

    const tx = await lottery.endLottery({ gas: SAFE_GAS + 1000000 });

    await vrfCoordinatorMock.callBackWithRandomness(
      tx.receipt.rawLogs[3].topics[0],
      "777",
      randomness.address
    );

    const winnerTicket = await lottery.currWinner();

    const aliceEtherBalance = await web3.eth.getBalance(alice);
    const bobEtherBalance = await web3.eth.getBalance(bob);
    const carlosEtherBalance = await web3.eth.getBalance(carlos);

    console.log("Winner: ", winnerTicket.number.toString(), winnerTicket.owner);

    console.log("Alice ether: ", aliceEtherBalance);
    console.log("Bob ether: ", bobEtherBalance);
    console.log("Carlos ether: ", carlosEtherBalance);
  });

  it("Reverts the burning when a transaction is invalid", async () => {
    await lottery.startNewLottery();
    await reverts(lottery.buyTickets([1, 2, 3, 4, 5, 6, 7, 1], { from: alice }));

    // She didn't lose any LIME
    assert((await limeToken.balanceOf(alice)).eq(tokensBN("1000")));
  });
});
