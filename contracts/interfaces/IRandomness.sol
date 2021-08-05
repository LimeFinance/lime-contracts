// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IRandomness {
  function randomNumber(uint256) external view returns (uint256);

  function getRandomNumber(uint256 lotteryId) external;
}
