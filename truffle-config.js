const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

module.exports = {
  plugins: ["truffle-plugin-verify"],
  api_keys: {
    bscscan: process.env.BSCSCAN_API_KEY,
  },

  networks: {
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
    },
    execScripts: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      provider: () => new HDWalletProvider(process.env.OPERATOR_PK, `http://127.0.0.1:8545`),
    },
    testnet: {
      networkCheckTimeout: 10000000,
      provider: () => new HDWalletProvider(process.env.OPERATOR_PK, process.env.PROVIDER_URL),
      network_id: 97,
      confirmations: 3,
      timeoutBlocks: 2000,
      skipDryRun: true,
    },
    bsc: {
      provider: () =>
        new HDWalletProvider(process.env.OPERATOR_PK, `https://bsc-dataseed1.binance.org`),
      network_id: 56,
      confirmations: 3,
      timeoutBlocks: 200,
      skipDryRun: false,
      gasPrice: 6000000000, // 5 GWei
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.2", // Fetch exact version from solc-bin (default: truffle's version)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: false,
          runs: 200,
        },
      },
    },
  },

  // Truffle DB is currently disabled by default; to enable it, change enabled: false to enabled: true
  //
  // Note: if you migrated your contracts prior to enabling this field in your Truffle project and want
  // those previously migrated contracts available in the .db directory, you will need to run the following:
  // $ truffle migrate --reset --compile-all

  db: {
    enabled: false,
  },
};
