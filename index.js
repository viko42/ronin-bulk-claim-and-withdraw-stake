/**
 * @fileoverview Script to process seed phrases, claim rewards, undelegate tokens, and transfer balances on the Ronin network.
 * @requires fs
 * @requires csv-parser
 * @requires ethers
 * @requires axios
 */

const fs = require("fs");
const csv = require("csv-parser");
const { ethers } = require("ethers");
const axios = require("axios");

/** @type {string[]} Array to store seed phrases */
const seeds = [];
/** @type {ethers.JsonRpcProvider} Ethereum provider for Ronin network */
const provider = new ethers.JsonRpcProvider("https://ronin.lgns.net/rpc");
/** @type {string} Address to send funds to */
const sendToAddress = "-your-address-here-";

/** @type {string} Address of the staking contract */
const stackingContract = "0x545edb750eb8769c868429be9586f5857a768758";
/** @type {Array<Object>} ABI for the staking contract */
const stackingAbi = [
  {
    inputs: [
      {
        internalType: "TConsensus[]",
        name: "consensusAddrs",
        type: "address[]",
      },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    name: "bulkUndelegate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "TConsensus[]",
        name: "consensusAddrList",
        type: "address[]",
      },
    ],
    name: "claimRewards",
    outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "TConsensus", name: "consensusAddr", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "undelegate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "TConsensus", name: "consensusAddr", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Read and process the CSV file
fs.createReadStream("seeds.csv")
  .pipe(csv({ separator: ";" }))
  .on("data", (row) => {
    seeds.push(row.seed);
  })
  .on("end", async () => {
    console.log("CSV file successfully processed");
    for (const seed of seeds) {
      console.log(`Processing seed: ${seed}`);
      const hdNode = ethers.HDNodeWallet.fromPhrase(seed);
      const wallet = new ethers.Wallet(hdNode.privateKey, provider);
      await unstackTokens(wallet, sendToAddress);
    }
  });

/**
 * Claims rewards for a given wallet and consensus addresses
 * @param {ethers.Wallet} wallet - The wallet to claim rewards for
 * @param {string[]} consensusAddresses - Array of consensus addresses
 */
const claimRewards = async (wallet, consensusAddresses) => {
  console.log(`Claim rewards tokens for wallet: ${wallet.address}`);
  try {
    const stackingContractInstance = new ethers.Contract(
      stackingContract,
      stackingAbi,
      wallet
    );
    const tx = await stackingContractInstance.claimRewards(consensusAddresses);
    const receipt = await tx.wait();
    console.log(
      `Claim rewards transaction hash: ${receipt.hash} for ${wallet.address}`
    );
  } catch (error) {
    console.error("Error claiming rewards:", error);
  }
};

/**
 * Fetches staking data for a given wallet address
 * @param {string} address - The wallet address to fetch staking data for
 * @returns {Promise<Array<{validatorAddress: string, amount: string}>>} Array of staking data
 */
const getStackingForWallet = async (address) => {
  try {
    const response = await axios.post(
      "https://indexer.roninchain.com/query",
      {
        query: `query MyOverviewStaking($address: String!, $from: Int!, $limit: Int!, $fromTime: Int!, $toTime: Int!, $orderStaked: String, $orderApr: String) {
        MyOverviewStaking(from: $from, limit: $limit, address: $address, fromTime: $fromTime, toTime: $toTime, orderStaked: $orderStaked, orderApr: $orderApr) {
          total
          totalClaimedReward
          data {
            totalStaked
            totalReward
            validator
            averageStaking
            averageReward
            claimable
            startDate
            aprLive
          }
        }
      }`,
        variables: {
          address: address,
          fromTime: 0,
          toTime: 0,
          from: 0,
          limit: 0,
          orderApr: "",
          orderStaked: "",
        },
      },
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          "content-type": "application/json",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          Referer: "https://app.roninchain.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      }
    );

    const stakingData = response.data.data.MyOverviewStaking.data;
    return stakingData.map((item) => ({
      validatorAddress: item.validator,
      amount: item.totalStaked,
    }));
  } catch (error) {
    console.error("Error fetching staking data:", error);
    return [];
  }
};

/**
 * Undelegates tokens for a given wallet, consensus address, and amount
 * @param {ethers.Wallet} wallet - The wallet to undelegate from
 * @param {string} consensusAddress - The consensus address to undelegate from
 * @param {string} amount - The amount to undelegate
 */
async function undelegate(wallet, consensusAddress, amount) {
  console.log(`Undelegate tokens for wallet: ${wallet.address}`);
  try {
    const stackingContractInstance = new ethers.Contract(
      stackingContract,
      stackingAbi,
      wallet
    );
    const tx = await stackingContractInstance.undelegate(
      consensusAddress,
      BigInt(amount)
    );
    const receipt = await tx.wait();
    console.log(
      `Undelegate transaction hash: ${receipt.hash} for ${wallet.address}`
    );
  } catch (error) {
    console.error("Error undelegate rewards:", error);
  }
}

/**
 * Unstakes tokens, claims rewards, and transfers balance for a given wallet
 * @param {ethers.Wallet} wallet - The wallet to process
 */
async function unstackTokens(wallet) {
  const stakingData = await getStackingForWallet(wallet.address);

  const minimumAmountToClaim = stakingData
    .map((item) => item.amount)
    .reduce((a, b) => a + Number(b), 0);
  if (minimumAmountToClaim > 0) {
    await claimRewards(
      wallet,
      stakingData.map((item) => item.validatorAddress)
    );
  }
  for (const key in stakingData) {
    const element = stakingData[key];

    if (Number(element.amount) > 0) {
      await undelegate(wallet, element.validatorAddress, element.amount);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 10000));

  const balance = await wallet.provider.getBalance(wallet.address);
  console.log(
    `Balance: ${ethers.formatEther(balance)} $RON for ${wallet.address}`
  );

  const fee = ethers.parseEther("0.00042");
  const value = balance - fee;
  const tx = {
    to: sendToAddress,
    value,
    gasPrice: ethers.parseUnits("20", "gwei"),
    gasLimit: 21000,
  };

  if (Number(value) > 0) {
    const transaction = await wallet.sendTransaction(tx);
    await transaction.wait();
    console.log(`Transaction hash: ${transaction.hash}`);
  }
}
