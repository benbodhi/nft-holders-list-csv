require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Web3 = require('web3');

const app = express();
const port = process.env.PORT || 3000;
app.listen(process.env.PORT || 3000, '0.0.0.0', function(){
  console.log('Server listening on port ' + (process.env.PORT || 3000));
});

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

async function fetchMintedTokenIdsByDateRange(contractAddress, tokenDateStart, tokenDateEnd, apiKey, ownerType) {
  const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${contractAddress}&startblock=0&endblock=999999999&sort=asc&apikey=${apiKey}`;
  const response = await axios.get(url);
  const transfers = response.data.result;

  const tokenDataByTokenId = new Map();

  transfers.forEach(tx => {
    const txDate = new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0];
    const isMintTransaction = tx.from === '0x0000000000000000000000000000000000000000';
    if ((!tokenDateStart || txDate >= tokenDateStart) && (!tokenDateEnd || txDate <= tokenDateEnd) && isMintTransaction) {
      const tokenId = parseInt(tx.tokenID);
      const toAddress = tx.to;

      if (ownerType === 'current') {
        if (tokenDataByTokenId.has(tokenId)) {
          const oldToAddress = tokenDataByTokenId.get(tokenId).toAddress;
          if (oldToAddress === '0x0000000000000000000000000000000000000000') {
            tokenDataByTokenId.set(tokenId, { toAddress });
          }
        } else {
          if (toAddress !== '0x0000000000000000000000000000000000000000') {
            tokenDataByTokenId.set(tokenId, { toAddress });
          }
        }
      } else {
        tokenDataByTokenId.set(tokenId, { toAddress });
      }
    }
  });

  const tokenIds = Array.from(tokenDataByTokenId.keys());

  if (ownerType === 'current') {
    return tokenIds.filter(tokenId => tokenDataByTokenId.get(tokenId).toAddress !== '0x0000000000000000000000000000000000000000');
  } else {
    return tokenIds;
  }
}

async function fetchAllTokenIds(contractAddress, apiKey) {
  const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${contractAddress}&startblock=0&endblock=999999999&sort=asc&apikey=${apiKey}`;
  const response = await axios.get(url);
  const transfers = response.data.result;

  const tokenIds = new Set();

  transfers.forEach(tx => {
    const tokenId = parseInt(tx.tokenID);
    tokenIds.add(tokenId);
  });

  return Array.from(tokenIds);
}

app.post('/fetch-token-holders', async (req, res) => {
  const { contractAddress, tokenIds, tokenRange, tokenDateStart, tokenDateEnd, combined, ownerType, fetchAll } = req.body;
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const web3 = new Web3();
  const tokenHolders = [];

  let tokenIdsToFetch = tokenIds || [];

  if (fetchAll) {
    tokenIdsToFetch = await fetchAllTokenIds(contractAddress, apiKey);
  } else {
    if (tokenDateStart && tokenDateEnd) {
      tokenIdsToFetch = await fetchMintedTokenIdsByDateRange(contractAddress, tokenDateStart, tokenDateEnd, apiKey, ownerType);
    }

    if (tokenRange) {
      const [start, end] = tokenRange.split('-').map(Number);
      const rangeIds = [];
      for (let i = start; i <= end; i++) {
        rangeIds.push(i);
      }
      tokenIdsToFetch = tokenIdsToFetch.concat(rangeIds);
    }
  }

  console.log('Fetching token holders for:', {
    contractAddress,
    dateRange: [tokenDateStart, tokenDateEnd],
    tokenIds: tokenIdsToFetch,
    ownerType
  });

  const allHolders = new Map();

  for (const tokenId of tokenIdsToFetch) {
    const url = `https://api.etherscan.io/api?module=account&action=tokennfttx&contractaddress=${contractAddress}&startblock=0&endblock=999999999&sort=asc&apikey=${apiKey}&tokenId=${tokenId}`;
    const response = await axios.get(url);
    const transfers = response.data.result.filter(tx => parseInt(tx.tokenID) === parseInt(tokenId));

    const holders = new Map();

    console.log(`Token ID ${tokenId} transfers:`, transfers);

    for (const tx of transfers) {
      const isMintTransaction = tx.from === '0x0000000000000000000000000000000000000000';

      if (ownerType === 'original' && !isMintTransaction) {
        continue;
      }

      console.log(`Token ID ${tokenId} transfer from ${tx.from} to ${tx.to}`);

      if (ownerType === 'current') {
        if (isMintTransaction) {
          holders.set(tx.to, tokenId);
          console.log(`(1) Setting holder (original minter) ${tx.to} for Token ID ${tokenId}`);
        } else {
          holders.delete(tx.from);
          console.log(`Removing Previous Holder ${tx.from} for Token ID ${tokenId}`);
          holders.set(tx.to, tokenId);
          console.log(`(2) Setting holder (new owner) ${tx.to} for Token ID ${tokenId}`);
        }
      } else {
        if (isMintTransaction) {
          holders.set(tx.to, tokenId);
          console.log(`(3) Setting holder (original minter) ${tx.to} for Token ID ${tokenId}`);
        }
      }
    }

    if (combined) {
      for (const [holder, tokenId] of holders.entries()) {
        if (allHolders.has(holder)) {
          const oldTokenIds = allHolders.get(holder);
          allHolders.set(holder, oldTokenIds.concat(tokenId));
        } else {
          allHolders.set(holder, [tokenId]);
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