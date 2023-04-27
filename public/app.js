const tokenForm = document.getElementById('token-form');
const contractAddressInput = document.getElementById('contract-address');
const tokenIdsInput = document.getElementById('token-ids');
const csvLinksContainer = document.getElementById('csv-links');
const downloadAllLink = document.getElementById('download-all');
const tokenRangeInput = document.getElementById('token-range');
const tokenDateRangeInput = document.getElementById('token-date-range');
const optionalInputs = [tokenIdsInput, tokenRangeInput, tokenDateRangeInput];

const toggleSwitch = document.querySelector('.toggle__input');

function switchTheme(event) {
  const toggleLabel = document.querySelector('.toggle__label');
  if (event.target.checked) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    toggleLabel.querySelector('.toggle__icon--light').style.display = 'inline-block';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    toggleLabel.querySelector('.toggle__icon--dark').style.display = 'inline-block';
  }
}

toggleSwitch.addEventListener('change', switchTheme, false);

const inputs = document.querySelectorAll('.input-container input');

inputs.forEach(input => {
  const clearIcon = input.nextElementSibling;

  clearIcon.addEventListener('click', () => {
    input.value = '';
  });
});

function clearOtherInputs(currentInput) {
  optionalInputs.filter(other => other !== currentInput).forEach(other => {
    other.value = '';
  });
}

function validateTokenIds(tokenIds) {
  const idsPattern = /^\d+(,\s*\d+)*$/;
  return idsPattern.test(tokenIds);
}

function validateTokenRange(tokenRange) {
  const rangePattern = /^\d+\s*-\s*\d+$/;
  return rangePattern.test(tokenRange);
}

function validateTokenDateRange(tokenDateRange) {
  const dateRangePattern = /^\d{4}-\d{2}-\d{2}\s*to\s*\d{4}-\d{2}-\d{2}$/;
  return dateRangePattern.test(tokenDateRange);
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

function createCSV(tokenId, holders) {
  const csvContent = `data:text/csv;charset=utf-8,${holders.map(([h, value]) => `${h}`).join('\n')}`;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `token_${tokenId}_holders.csv`);
  link.innerText = `Download CSV for Token ID ${tokenId}`;
  link.classList.add('button');
  csvLinksContainer.appendChild(link);
  const lineBreak = document.createElement('br');
  csvLinksContainer.appendChild(lineBreak);
  return link;
}

function createCombinedCSV(tokenHolders) {
  const combinedHolders = new Set();
  tokenHolders.forEach(({ tokenId, holders }) => {
    holders.forEach(([h, value]) => combinedHolders.add(h));
  });
  const csvContent = `data:text/csv;charset=utf-8,${Array.from(combinedHolders).join('\n')}`;
  const encodedUri = encodeURI(csvContent);
  const link = document.getElementById('download-combined');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'combined_holders.csv');
  link.style.display = 'block';
}

contractAddressInput.addEventListener('input', () => {
  const isContractAddressFilled = contractAddressInput.value.trim() !== '';
  tokenIdsInput.disabled = !isContractAddressFilled;
  tokenRangeInput.disabled = !isContractAddressFilled;
  tokenDateRangeInput.disabled = !isContractAddressFilled;
});

optionalInputs.forEach(input => {
  input.addEventListener('focus', () => {
    if (input.value.trim() === '') {
      clearOtherInputs(input);
    }
  });

  input.addEventListener('input', () => {
    if (input.value.trim() !== '') {
      clearOtherInputs(input);
    }
  });
});

tokenForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Initially hide the "Download Combined CSV" button & "Download All" button
  document.getElementById('download-combined').classList.add('hidden');
  document.getElementById('download-all').classList.add('hidden');

  // Validate token IDs format
  if (tokenIdsInput.value && !validateTokenIds(tokenIdsInput.value)) {
    alert('Invalid Token IDs format. Please use a comma-separated list of numbers (e.g., "1,2,3")');
    return;
  }

  // Validate token range format
  if (tokenRangeInput.value && !validateTokenRange(tokenRangeInput.value)) {
    alert('Invalid Token ID Range format. Please use the format: "start-end" (e.g., "1-100")');
    return;
  }

  // Validate date range format
  if (tokenDateRangeInput.value && !validateTokenDateRange(tokenDateRangeInput.value)) {
    alert('Invalid Token Date Range format. Please use the format: "YYYY-MM-DD to YYYY-MM-DD" (e.g., "2022-01-01 to 2022-12-31")');
    return;
  }

  csvLinksContainer.innerHTML = '';

  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;
  const loader = document.createElement('div');
  loader.innerText = 'Loading...';
  csvLinksContainer.appendChild(loader);

  const ownerTypeInput = document.getElementsByName('owner-type');
  let ownerType = 'original';

  for (const radio of ownerTypeInput) {
    if (radio.checked) {
      ownerType = radio.value;
    }
  }

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

  csvLinksContainer.innerHTML = '';
  loader.remove();

  const csvLinks = [];
  tokenHolders.forEach(({ tokenId, holders }) => {
    const link = createCSV(tokenId, holders);
    csvLinks.push(link);
  });

  createCombinedCSV(tokenHolders);

  // Show the "Download Combined CSV" button
  document.getElementById('download-combined').classList.remove('hidden');
  // Show the "Download All CSVs" button
  document.getElementById('download-all').classList.remove('hidden');

  submitButton.disabled = false;
});

downloadAllLink.addEventListener('click', async (event) => {
  event.preventDefault();

  const zip = new JSZip();

  const allLinks = Array.from(csvLinksContainer.querySelectorAll('a'));
  for (const link of allLinks) {
    const response = await fetch(link.href);
    const text = await response.text();
    const filename = link.getAttribute('download');
    zip.file(filename, text);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(content);
  const tempLink = document.createElement('a');
  tempLink.href = zipUrl;
  tempLink.setAttribute('download', 'all_token_holders.zip');
  tempLink.style.display = 'none';
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
});

// TODO download all csvs button is hidden
// TODO download all and combined buttons need to be equal half width
// TODO download all button should download the combined CSV in the package too
