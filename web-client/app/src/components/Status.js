import React, { useState, useEffect } from 'react';

function Status() {
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/admin/status')
      .then(res => res.json())
      .then(data => setStatus(data.status));
  }, []);

  return (
    <div>
      <h1>Admin Panel Status</h1>
      <p>{status}</p>
    </div>
  );
}

export default Status;
