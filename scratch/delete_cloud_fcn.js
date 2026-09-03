async function deleteFcn() {
  const id = 'fcn-1785203593862';
  const url = `https://fcn-tracking.zeabur.app/api/fcns/${id}`;
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-admin-password': '940929'
      }
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

deleteFcn();
