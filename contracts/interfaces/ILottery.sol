// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILottery {
  function fulfillRandomness(uint256) external;
}
