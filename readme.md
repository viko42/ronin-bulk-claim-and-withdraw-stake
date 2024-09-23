# Ronin Network Token Management Script

This script automates the process of managing tokens on the Ronin network, including claiming rewards, undelegating tokens, and transferring balances.

## Features

- Process seed phrases from a CSV file
- Claim staking rewards
- Undelegate staked tokens
- Transfer remaining balance to a specified address

## Prerequisites

- Node.js
- npm

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```

## Configuration

1. Create a `seeds.csv` file in the root directory with your seed phrases. Format:
   ```
   seed
   your_seed_phrase_here
   another_seed_phrase_here
   ```

2. In `index.js`, replace the `sendToAddress` variable with your desired recipient address:
   ```javascript
   const sendToAddress = "your-address-here";
   ```

## Usage

Run the script with:

```bash
node index.js
```


The script will:
1. Read seed phrases from `seeds.csv`
2. For each seed phrase:
   - Create a wallet
   - Claim any available staking rewards
   - Undelegate all staked tokens
   - Transfer the remaining balance (minus gas fees) to the specified address

## Important Notes

- This script interacts with live blockchain transactions. Use with caution and at your own risk.
- Ensure you have sufficient RON tokens for gas fees in each wallet.
- The script includes a 10-second delay between undelegating and transferring to allow for transaction processing.

## Dependencies

- fs: File system operations
- csv-parser: CSV file parsing
- ethers: Ethereum wallet and contract interactions
- axios: HTTP requests for fetching staking data

## Security

- Never share your seed phrases or private keys.
- This script is intended for personal use. Review and understand the code before running it with real assets.

## Disclaimer

This script is provided as-is, without any warranties. Users are responsible for any consequences resulting from the use of this script.
