async function addFcn() {
  const fcnData = {
    "name": "FCN 2026SN4351",
    "bank": "DBS",
    "currency": "USD",
    "principal": 50000,
    "annualCouponRate": 15.5,
    "couponFrequency": "Monthly",
    "tradeDate": "2026-07-24",
    "startDate": "2026-07-24",
    "maturityDate": "2027-03-01",
    "observationFrequency": "Monthly",
    "isKnockedIn": false,
    "isEuropeanKi": true,
    "lockInMonths": 1,
    "note": "7-month FCN linked to NVDA, TSM, MU, and GOOG with a 15.50% annual coupon rate, 55% strike, 50% KI, and 100% KO.",
    "couponPaymentDates": [
      "2026-09-02",
      "2026-10-02",
      "2026-11-04",
      "2026-12-02",
      "2027-01-05",
      "2027-02-03",
      "2027-03-03"
    ],
    "stocks": [
      {
        "symbol": "NVDA",
        "name": "輝達",
        "initialPrice": 206.84,
        "koPercent": 100,
        "kiPercent": 50,
        "strikePercent": 55
      },
      {
        "symbol": "TSM",
        "name": "台積電",
        "initialPrice": 403.41,
        "koPercent": 100,
        "kiPercent": 50,
        "strikePercent": 55
      },
      {
        "symbol": "MU",
        "name": "美光",
        "initialPrice": 920.95,
        "koPercent": 100,
        "kiPercent": 50,
        "strikePercent": 55
      },
      {
        "symbol": "GOOG",
        "name": "谷歌",
        "initialPrice": 319.09,
        "koPercent": 100,
        "kiPercent": 50,
        "strikePercent": 55
      }
    ]
  };

  const url = `https://fcn-tracking.zeabur.app/api/fcns`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': '940929'
      },
      body: JSON.stringify(fcnData)
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

addFcn();
