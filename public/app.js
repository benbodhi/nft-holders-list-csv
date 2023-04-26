const tokenForm = document.getElementById('token-form');
const contractAddressInput = document.getElementById('contract-address');
const tokenIdsInput = document.getElementById('token-ids');
const csvLinksContainer = document.getElementById('csv-links');
const downloadAllLink = document.getElementById('download-all');
const tokenRangeInput = document.getElementById('token-range');
const tokenDateRangeInput = document.getElementById('token-date-range');
const ownerTypeInput = document.getElementsByName('owner-type');
let ownerType = 'original';

for (const radio of ownerTypeInput) {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      ownerType = radio.value;
    }
  });
}

const litepicker = new Litepicker({
  element: tokenDateRangeInput,
  format: 'YYYY-MM-DD',
  delimiter: ' to ',
  singleMode: false,
  autoApply: false,
  numberOfMonths: 2,
  numberOfColumns: 2,
  disableMobile: true,
  onSelect: (start, end) => {
    tokenDateRangeInput.value = start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD');
  }
});

contractAddressInput.addEventListener('input', () => {
  const isContractAddressFilled = contractAddressInput.value.trim() !== '';
  tokenIdsInput.disabled = !isContractAddressFilled;
  tokenRangeInput.disabled = !isContractAddressFilled;
  tokenDateRangeInput.disabled = !isContractAddressFilled;
});

const optionalInputs = [tokenIdsInput, tokenRangeInput, tokenDateRangeInput];
optionalInputs.forEach(input => {
  input.addEventListener('input', () => {
    if (input.value.trim() !== '') {
      optionalInputs.filter(other => other !== input).forEach(other => {
        other.disabled = true;
      });
    } else {
      optionalInputs.forEach(other => {
        other.disabled = contractAddressInput.value.trim() === '';
      });
    }
  });

  input.addEventListener('change', () => {
    if (input.value.trim() === '') {
      optionalInputs.forEach(other => {
        other.disabled = contractAddressInput.value.trim() === '';
      });
    }
  });
});

tokenForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  csvLinksContainer.innerHTML = '';

  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;
  const loader = document.createElement('div');
  loader.innerText = 'Loading...';
  csvLinksContainer.appendChild(loader);

  const contractAddress = contractAddressInput.value.trim();
  const tokenIds = tokenIdsInput.value ? tokenIdsInput.value.split(',').map(tokenId => tokenId.trim()) : [];
  const tokenRange = tokenRangeInput.value.trim();
  const tokenDateRange = tokenDateRangeInput.value.trim();
  const [tokenDateStart, tokenDateEnd] = tokenDateRange.split('to').map(date => date.trim());
  const combined = false;

  const response = await fetch('/fetch-token-holders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contractAddress, tokenIds, tokenRange, tokenDateStart, tokenDateEnd, combined, ownerType })
  });

  const tokenHolders = await response.json();
  console.log('Received token holders:', tokenHolders);
  const zip = new JSZip();

  for (const { tokenId, holders } of tokenHolders) {
    const csvContent = 'data:text/csv;charset=utf-8,' + holders.map(([h, value]) => `${h},${value}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `token_${tokenId}_holders.csv`);
    link.innerText = `Download CSV for Token ID ${tokenId}`;
    csvLinksContainer.appendChild(link);
    const lineBreak = document.createElement('br');
    csvLinksContainer.appendChild(lineBreak);
    const csvString = holders.map(([h, value]) => `${h},${value}`).join('\n');
    zip.file(`token_${tokenId}_holders.csv`, csvString);
  }

  if (tokenHolders.length > 1) {
    const content = await zip.generateAsync({ type: 'blob' });
    downloadAllLink.href = URL.createObjectURL(content);
    downloadAllLink.style.display = 'block';
  } else {
    downloadAllLink.style.display = 'none';
  }

  submitButton.disabled = false;
  loader.remove();
});
