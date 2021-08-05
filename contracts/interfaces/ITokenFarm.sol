// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITokenFarm {
  struct Pool {
    uint256 poolSize;
    uint256 limePerBlock;
    bool taxFree;
    bool isLp;
    // The actual token to be staked
    IERC20 token;
  }
  struct UserInfo {
    uint256 stakedAmount;
    uint256 stakeBlock;
    uint256 debt;
  }
  // Events
  event Deposit(address indexed user, uint256 indexed poolIndex, uint256 amount);
  event Withdrawal(address indexed user, uint256 indexed poolIndex, uint256 amount);

  /**
   * @dev Deposit `_amount` tokens in the pool `_poolIndex` for harvesting.
   * Calls transferRewardsToDebt to store the current rewards.
   * Calls transferFrom in the desired token.
   * Increases taxed(`_amount`) from poolSize
   * Charge 0.9% tax on it (if not tax-free pool)
   */
  function depositTokens(uint256 _amount, uint128 _poolIndex) external returns (bool);

  /**
   * @dev Withdraw `_amount` tokens from the harvesting pool `_poolIndex`.
   * Calls transferRewardsToDebt to store the current rewards
   * Reduces `_amount` from poolSize
   * Charge 3.5% tax on it (if not tax-free pool)
   */
  function withdrawTokens(uint256 _amount, uint128 _poolIndex) external returns (bool);

  /**
   * @dev Harvest the earned tokens in the pool `_poolIndex`, which are:
   * UserInfo.debt + calculateAmount(pool, holdings)
   * Can only be called on harvesting periods
   */
  function harvestLimes(uint128 _poolIndex) external;

  /**
   * @dev Create a pool with the token `_token`
   * Determine if the pool charges taxes with `_taxFree`
   * Determine how much LIME it's multiplied with the block delta with `_limePerBlock`
   * Can only be called by the owner
   */
  function createPool(
    IERC20 _token,
    uint256 _limePerBlock,
    bool _taxFree
  ) external;

  /**
   * @dev Function that transfers rewards to debt in the pool `poolIndex`
   * creating a "Checkpoint", meaning that the earned tokens are now
   * fixed.
   */
  function checkpoint(uint128 _poolIndex) external;

  /**
   * @dev View function to check if harvesting is enabled
   * Will check if the timestamp is divisible by 14 days
   */
  function isHarvestingPeriod() external view returns (bool);

  /**
   * @dev View function to check how many pools there are
   */
  function totalPools() external view returns (uint256);

  /**
   * @dev View function to check how much stake a user has in
   * the pool `_poolIndex`
   */
  function userStakeInPool(uint128 _poolIndex) external view returns (uint256);

  /**
   * @dev View function to check how much debt a user has pending
   * (Useful for differentiating checkpoints)
   */
  function userDebtInPool(uint128 _poolIndex) external view returns (uint256);

  /**
   * @dev View function to check how much LIME the user would receive
   * if they harvested in the moment
   * in the pool `_poolIndex`
   */
  function userAvailableHarvest(uint128 _poolIndex) external view returns (uint256);

  /**
   * @dev View function to check the pool size of `_poolIndex`
   */
  function getPoolSize(uint128 _poolIndex) external view returns (uint256);

  /**

     * @dev View function to get the pools
     */
  function getPools() external view returns (Pool[] memory);
}
