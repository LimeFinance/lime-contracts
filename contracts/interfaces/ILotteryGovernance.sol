// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILotteryGovernance {
  function lottery() external view returns (address);

  function randomness() external view returns (address);
}
