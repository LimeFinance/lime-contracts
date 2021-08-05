const DAY_SECONDS = 86400;
const BN = require("bn.js");

tokens = (amount) => {
  return web3.utils.toWei(amount);
};
tokensBN = (amount) => {
  return new BN(tokens(amount));
};
fromTokens = (amount) => {
  return web3.utils.fromWei(amount);
};
advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        const newBlockHash = web3.eth.getBlock("latest").hash;

        return resolve(newBlockHash);
      }
    );
  });
};

advanceBlocks = async (amount) => {
  for (let i = 0; i < amount; i++) {
    await advanceBlock();
  }
};

takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_snapshot",
        id: new Date().getTime(),
      },
      (err, snapshotId) => {
        if (err) {
          return reject(err);
        }
        return resolve(snapshotId);
      }
    );
  });
};

revertToSnapShot = (id) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_revert",
        params: [id],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

advanceTimeAndBlock = async (time) => {
  await advanceTime(time);
  await advanceBlock();
  return Promise.resolve(web3.eth.getBlock("latest"));
};
getTimeUntilHarvesting = async () => {
  const blockNumber = await web3.eth.getBlockNumber();
  const block = await web3.eth.getBlock(blockNumber);
  const timestamp = block.timestamp;

  const r = (timestamp + DAY_SECONDS * 2) % (DAY_SECONDS * 14);
  const a = DAY_SECONDS * 14;
  const secondsUntilHarvesting = a - r;
  return secondsUntilHarvesting;
};
advanceUntilHarvesting = async (tokenFarm) => {
  await advanceTime(await getTimeUntilHarvesting());
};

module.exports = {
  advanceTime,
  tokens,
  tokensBN,
  fromTokens,
  advanceBlock,
  advanceBlocks,
  advanceTimeAndBlock,
  advanceUntilHarvesting,
  takeSnapshot,
  revertToSnapShot,
};
