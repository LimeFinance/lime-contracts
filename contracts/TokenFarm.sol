// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./LimeToken.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./interfaces/ITokenFarm.sol";
import "./interfaces/IDistribution.sol";

contract TokenFarm is Ownable, ITokenFarm {
  string public name = "LIME Token Farm";

  // The LIME token
  LimeToken public limeToken;

  IDistribution public distribution;

  Pool[] public pools;

  // holdings stores how many tokens are staked by each user
  // mapping(poolIndex => mapping(userAddress => UserInfo))

  mapping(uint256 => mapping(address => UserInfo)) public holdings;

  modifier onHarvestingPeriod() {
    require((block.timestamp + 2 days) % 14 days < 1 days, "LIME_FARM: Not in harvesting period");
    _;
  }

  constructor(IDistribution _distribution, LimeToken _limeToken) {
    limeToken = _limeToken;
    distribution = _distribution;
  }

  function createPool(
    IERC20 _token,
    uint256 _limePerBlock,
    bool _taxFree
  ) external override onlyOwner {
    if ((pools.length >= 6 && _taxFree) || _limePerBlock > 250 ether) {
      revert("LIME_FARM: Ambitious pool creation");
    }
    // TODO: Restrict for governance

    bool _isLp = checkLP(address(_token));

    pools.push(
      Pool({
        poolSize: 0,
        token: _token,
        limePerBlock: _limePerBlock,
        taxFree: _taxFree,
        isLp: _isLp
      })
    );
  }

  function depositTokens(uint256 _amount, uint128 _poolIndex) external override returns (bool) {
    require(_amount > 0, "LIME_FARM: Amount must be greater than 0");

    Pool storage pool = pools[_poolIndex];
    UserInfo storage _userInfo = holdings[_poolIndex][address(msg.sender)];

    if (_userInfo.stakedAmount > 0) {
      // Store current rewards as debt and reset the block
      transferRewardsToDebt(_poolIndex);
    } else {
      _userInfo.stakeBlock = block.number;
    }

    uint256 amountToDeposit;

    if (pool.taxFree) {
      // Transfer the tokens to the contract
      pool.token.transferFrom(address(msg.sender), address(this), _amount);
      amountToDeposit = _amount;
    } else {
      // Dist commission (0.9% in deposits)
      uint256 fee = (_amount * 90) / 10000;
      amountToDeposit = (_amount * 991) / 1000;

      pool.token.transferFrom(address(msg.sender), address(distribution), fee);
      pool.token.transferFrom(address(msg.sender), address(this), amountToDeposit);

      distribution.receiveTokensAndConvertToETH(fee, address(pool.token), pool.isLp);
    }

    _userInfo.stakedAmount += amountToDeposit;

    pools[_poolIndex].poolSize += amountToDeposit;

    emit Deposit(address(msg.sender), _poolIndex, amountToDeposit);

    return true;
  }

  function withdrawTokens(uint256 _amount, uint128 _poolIndex) external override returns (bool) {
    Pool storage pool = pools[_poolIndex];
    UserInfo storage _userInfo = holdings[_poolIndex][address(msg.sender)];

    // Amount shouldn't be 0 and the user needs to have the balance
    require(
      _amount > 0 && _userInfo.stakedAmount >= _amount,
      "LIME_FARM: Invalid withdrawal amount"
    );

    transferRewardsToDebt(_poolIndex);

    _userInfo.stakedAmount -= _amount;
    pool.poolSize -= _amount;

    if (pool.taxFree) {
      pool.token.transfer(address(msg.sender), _amount);
    } else {
      // Dev comission (3.5% in withdrawals)
      uint256 fee = (_amount * 350) / 10000;

      pool.token.transfer(address(distribution), fee);
      distribution.receiveTokensAndConvertToETH(fee, address(pool.token), pool.isLp);

      pool.token.transfer(address(msg.sender), (_amount * 965) / 1000);
    }

    emit Withdrawal(address(msg.sender), _poolIndex, _amount);

    return true;
  }

  function harvestLimes(uint128 _poolIndex) external override onHarvestingPeriod {
    Pool storage pool = pools[_poolIndex];
    UserInfo storage _userInfo = holdings[_poolIndex][address(msg.sender)];

    uint256 debt = _userInfo.debt;
    uint256 lastRewards = calculateRewards(
      block.number - _userInfo.stakeBlock,
      pool.limePerBlock,
      _userInfo.stakedAmount,
      pool.poolSize
    );

    // Reset the block and debt
    _userInfo.stakeBlock = block.number;
    _userInfo.debt = 0;

    limeToken.mint(address(msg.sender), debt + lastRewards);
  }

  function checkpoint(uint128 _poolIndex) external override {
    transferRewardsToDebt(_poolIndex);
  }

  /**
   * @dev Internal function that checks the user staked amount,
   * calculates the rewards for it and stores them as debt. Then it
   * resets the stakeBlock to the current block number.
   */
  function transferRewardsToDebt(uint128 _poolIndex) internal {
    Pool storage pool = pools[_poolIndex];
    UserInfo storage _userInfo = holdings[_poolIndex][address(msg.sender)];
    uint256 rewards = calculateRewards(
      block.number - _userInfo.stakeBlock,
      pool.limePerBlock,
      _userInfo.stakedAmount,
      pool.poolSize
    );
    _userInfo.debt += rewards;
    _userInfo.stakeBlock = block.number;
  }

  /**
   * @dev Pure function that calculates how much LIME the user needs to get.
   * Amount = blocks holded * LIME per block * (stake / poolSize)
   *
   */
  function calculateRewards(
    uint256 _blocksHolded,
    uint256 _limePerBlock,
    uint256 _stake,
    uint256 _poolSize
  ) internal pure returns (uint256) {
    require(_stake <= _poolSize, "LIME_FARM: Invalid rewards calculation");
    return (_blocksHolded * _limePerBlock * _stake) / _poolSize;
  }

  // --------- VIEW FUNCTIONS -----------

  function checkLP(address token) internal view returns (bool) {
    bool isLp;
    try IUniswapV2Pair(token).token0() {
      isLp = true;
    } catch {
      isLp = false;
    }
    return isLp;
  }

  function isHarvestingPeriod() external view override returns (bool) {
    return (block.timestamp - 2 days) % 14 days < 1 days;
  }

  function userStakeInPool(uint128 _poolIndex) external view override returns (uint256) {
    return holdings[_poolIndex][address(msg.sender)].stakedAmount;
  }

  function userDebtInPool(uint128 _poolIndex) external view override returns (uint256) {
    return holdings[_poolIndex][address(msg.sender)].debt;
  }

  function userAvailableHarvest(uint128 _poolIndex) external view override returns (uint256) {
    UserInfo storage _userInfo = holdings[_poolIndex][address(msg.sender)];
    Pool storage _poolInfo = pools[_poolIndex];

    uint256 additionalRewards;

    if (_userInfo.stakedAmount > 0) {
      additionalRewards = calculateRewards(
        block.number - _userInfo.stakeBlock,
        _poolInfo.limePerBlock,
        _userInfo.stakedAmount,
        _poolInfo.poolSize
      );
    } else {
      additionalRewards = 0;
    }
    return _userInfo.debt + additionalRewards;
  }

  function totalPools() external view override returns (uint256) {
    return pools.length;
  }

  function getPoolSize(uint128 _poolIndex) external view override returns (uint256) {
    return pools[_poolIndex].poolSize;
  }

  function getPools() external view override returns (Pool[] memory) {
    return pools;
  }
}
