// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./LimeToken.sol";
import "./interfaces/IRandomness.sol";
import "./interfaces/ILotteryGovernance.sol";

contract Lottery is ChainlinkClient, ReentrancyGuard, Ownable {
  LOTTERY_STATE public lotteryState;
  uint256 public currLotteryId;

  ILotteryGovernance public governance;
  LimeToken public limeToken;

  uint256 MAX_TICKET_PURCHASE = 49;
  uint256 MAX_LOTTERY_NUMBER = 100000;

  struct Ticket {
    address payable owner;
    uint32 number;
  }

  // Track the number of participations.
  // A participation is when a user buys tickets.
  // It's almost a one-to-one relationship with participants, but less expensive.
  uint256 public currLotteryParticipations;

  // The current winner. Could be a mapping for lottery id,
  // but this is cheaper and info can be retrieved using
  // the event LotteryWon
  Ticket public currWinner;
  
  uint256 public lastWonAmount;

  // Using three mappings:
  // - lotteryId => Ticket[]: To pick the winner
  // - lotteryId => (ticketNumber => bool): To check if a number is used
  // - lotteryId => (userAddress => numbers): To check which numbers a user bought

  mapping(uint256 => Ticket[]) public lotteryTickets;
  mapping(uint256 => mapping(uint32 => bool)) numbersInUse;
  mapping(uint256 => mapping(address => uint32[])) userNumbers;

  enum LOTTERY_STATE {
    OPEN,
    CLOSED,
    CALCULATING_WINNER
  }

  modifier notContract() {
    require(!Address.isContract(msg.sender), "Contract not allowed");
    require(msg.sender == tx.origin, "Proxy contract not allowed");
    _;
  }

  event LotteryWon(address winner, uint256 amount);

  receive() external payable {}

  constructor(
    ILotteryGovernance _governance,
    address _link,
    LimeToken _limeToken
  ) {
    setChainlinkToken(_link);
    currLotteryParticipations = 0;
    currLotteryId = 1;
    lotteryState = LOTTERY_STATE.CLOSED;
    governance = _governance;
    limeToken = _limeToken;
  }

  function startNewLottery() public onlyOwner {
    require(lotteryState == LOTTERY_STATE.CLOSED, "Can't start a new lottery yet");
    lotteryState = LOTTERY_STATE.OPEN;
  }

  function endLottery() public onlyOwner {
    require(lotteryState == LOTTERY_STATE.OPEN, "The lottery hasn't even started!");
    lotteryState = LOTTERY_STATE.CALCULATING_WINNER;
    pickWinner();
  }

  function buyTickets(uint32[] calldata _numbers) external nonReentrant notContract {
    require(_numbers.length != 0, "No ticket specified");
    require(lotteryState == LOTTERY_STATE.OPEN, "Lottery must be open");

    uint32[] storage currUserNumbers = userNumbers[currLotteryId][msg.sender];

    require(
      currUserNumbers.length + _numbers.length <= MAX_TICKET_PURCHASE,
      "Can't buy more than 49 tickets"
    );

    // Burn LIME to participate
    limeToken.burnFrom(msg.sender, _numbers.length * getTicketPrice());

    for (uint256 index = 0; index < _numbers.length; index++) {
      uint32 currentNumber = _numbers[index];

      require(
        numbersInUse[currLotteryId][currentNumber] == false,
        "One of the numbers is already taken."
      );
      require(currentNumber <= MAX_LOTTERY_NUMBER, "Number is higher than the max");

      numbersInUse[currLotteryId][currentNumber] = true;
      lotteryTickets[currLotteryId].push(
        Ticket({ number: currentNumber, owner: payable(msg.sender) })
      );
      currUserNumbers.push(currentNumber);
    }
   
    currLotteryParticipations++;
  }

  function pickWinner() private {
    require(lotteryState == LOTTERY_STATE.CALCULATING_WINNER, "You aren't at that stage yet!");
    IRandomness(governance.randomness()).getRandomNumber(currLotteryId);
    //this kicks off the request and returns through fulfill_random
  }

  function fulfillRandomness(uint256 randomness) external {
    require(lotteryState == LOTTERY_STATE.CALCULATING_WINNER, "You aren't at that stage yet!");
    require(randomness > 0, "random-not-found");
    assert(msg.sender == governance.randomness());

    uint256 index = randomness % lotteryTickets[currLotteryId].length;
    address payable winner = lotteryTickets[currLotteryId][index].owner;

    currWinner = lotteryTickets[currLotteryId][index];
    lastWonAmount = getPot();
    emit LotteryWon(winner, getPot());
    Address.sendValue(winner, getPot());

    currLotteryId++;
    currLotteryParticipations = 0;
    lotteryState = LOTTERY_STATE.CLOSED;
  }

  // ----- VIEW FUNCTIONS ------

  function getPot() public view returns (uint256) {
    return address(this).balance;
  }

  function getTicketPrice() public view returns (uint256) {
    // 0.1% of totalSupp
    return limeToken.totalSupply() / 1000;
  }

  function getUserNumbers() external view returns (uint32[] memory _numbers) {
    _numbers = userNumbers[currLotteryId][msg.sender];
  }

  function isNumberUsed(uint32 _number) external view returns (bool used) {
    used = numbersInUse[currLotteryId][_number];
  }

  function getTotalTicketsBought() external view returns (uint256 _amount) {
    return lotteryTickets[currLotteryId].length;
  }
}
