// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

import "./interfaces/ILotteryGovernance.sol";
import "./interfaces/ILottery.sol";

contract RandomNumberConsumer is VRFConsumerBase {
  bytes32 internal keyHash;
  uint256 internal fee;

  mapping(uint256 => uint256) public randomNumber;
  mapping(bytes32 => uint256) public requestIds;

  event RequestedRandomness(bytes32 requestId);

  ILotteryGovernance public governance;
  uint256 public mostRecentRandom;
  address vrfCoordinator;

  constructor(
    address _governance,
    bytes32 _keyHash,
    uint256 _linkFee,
    address _vrfCoordinator,
    address _link
  ) VRFConsumerBase(_vrfCoordinator, _link) {
    keyHash = _keyHash;
    fee = _linkFee; // 0.1 LINK
    vrfCoordinator = _vrfCoordinator;
    governance = ILotteryGovernance(_governance);
  }

  /**
   * Requests randomness from a user-provided seed
   */
  function getRandomNumber(uint256 lotteryId) external {
    require(LINK.balanceOf(address(this)) > fee, "Not enough LINK");
    bytes32 _requestId = requestRandomness(keyHash, fee);
    requestIds[_requestId] = lotteryId;
    emit RequestedRandomness(_requestId);
  }

  /**
   * Callback function used by VRF Coordinator
   */
  function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
    require(msg.sender == vrfCoordinator, "Fulillment only permitted by Coordinator");
    mostRecentRandom = randomness;
    uint256 lotteryId = requestIds[requestId];
    randomNumber[lotteryId] = randomness;
    ILottery(governance.lottery()).fulfillRandomness(randomness);
  }
}
