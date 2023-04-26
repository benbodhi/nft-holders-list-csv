require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Web3 = require('web3');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

async function fetchTokenIdsByDateRange(contractAddress, tokenDateStart, tokenDateEnd, apiKey) {
  const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${contractAddress}&startblock=0&endblock=999999999&sort=asc&apikey=${apiKey}`;
  const response = await axios.get(url);
  const transfers = response.data.result;

  const mintedTokenIds = new Set();

  transfers.forEach(tx => {
    const txDate = new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0];
    if ((!tokenDateStart || txDate >= tokenDateStart) && (!tokenDateEnd || txDate <= tokenDateEnd)) {
      mintedTokenIds.add(parseInt(tx.tokenID));
    }
  });

  return Array.from(mintedTokenIds);
}

app.post('/fetch-token-holders', async (req, res) => {
  const { contractAddress, tokenIds, tokenRange, tokenDateStart, tokenDateEnd, combined, ownerType } = req.body;
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const web3 = new Web3();
  const tokenHolders = [];

  let tokenIdsToFetch = tokenIds || [];

  if (tokenRange) {
    const [start, end] = tokenRange.split('-').map(Number);
    const rangeIds = [];
    for (let i = start; i <= end; i++) {
      rangeIds.push(i);
    }
    tokenIdsToFetch = tokenIdsToFetch.concat(rangeIds);
  }

  console.log('Fetching token holders for:', {
    contractAddress,
    tokenIds: tokenIdsToFetch,
    dateRange: [tokenDateStart, tokenDateEnd],
  });

  const allHolders = new Map();

  for (const tokenId of tokenIdsToFetch) {
    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${contractAddress}&startblock=0&endblock=999999999&sort=asc&apikey=${apiKey}`;
    const response = await axios.get(url);
    const transfers = response.data.result.filter(tx => parseInt(tx.tokenID) === parseInt(tokenId));

    const holders = new Map();

    for (const tx of transfers) {
      const txDate = new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0];

      if ((!tokenDateStart || txDate >= tokenDateStart) && (!tokenDateEnd || txDate <= tokenDateEnd)) {
        const fromAddress = tx.from;
        const toAddress = tx.to;
        const value = parseInt(tx.value, 10);

        if (fromAddress === '0x0000000000000000000000000000000000000000') {
          if (ownerType === 'current') {
            if (holders.has(toAddress)) {
              const oldValue = holders.get(toAddress);
              holders.set(toAddress, oldValue + value);
            } else {
              holders.set(toAddress, value);
            }
          } else if (ownerType === 'original' && !holders.has(toAddress)) {
            holders.set(toAddress, value);
          }
        } else if (ownerType === 'current') {
          if (holders.has(fromAddress)) {
            const oldValue = holders.get(fromAddress);
            holders.set(fromAddress, Math.max(oldValue - value, 0));
          }

          if (holders.has(toAddress)) {
            const oldValue = holders.get(toAddress);
            holders.set(toAddress, oldValue + value);
          } else {
            holders.set(toAddress, value);
          }
        }
      }
    }

    if (combined) {
      for (const [holder, value] of holders.entries()) {
        if (allHolders.has(holder)) {
          const oldValue = allHolders.get(holder);
          allHolders.set(holder, oldValue + value);
        } else {
          allHolders.set(holder, value);
        }
      }
    } else {
      tokenHolders.push({ tokenId, holders: Array.from(holders.entries()) });
    }
  }

  if (combined) {
    res.json([{ tokenId: 'combined', holders: Array.from(allHolders.entries()) }]);
  } else {
    res.json(tokenHolders);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});