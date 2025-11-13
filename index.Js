// server.js - Backend API untuk Wedding Invitation
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Database
const db = new sqlite3.Database('./wedding.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    
    // Create table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        qr_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      }
    });
  }
});

// Generate unique ID
function generateUniqueId() {
  return crypto.randomBytes(16).toString('hex');
}

// API Routes

// 1. Create new guest (from admin web)
app.post('/api/guests', async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  try {
    const uniqueId = generateUniqueId();
    
    // Generate QR Code URL - ini akan di-scan tamu saat datang
    const qrCodeUrl = `https://your-event-checkin.com/scan/${uniqueId}`;
    
    // Generate QR code as base64 image
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);
    
    // Generate invitation URL - ini URL yang dikirim ke tamu
    const invitationUrl = `https://your-invitation-web.com/invitation/${uniqueId}`;
    
    // Insert to database
    db.run(
      'INSERT INTO guests (unique_id, name, qr_code) VALUES (?, ?, ?)',
      [uniqueId, name, qrCodeImage],
      function(err) {
        if (err) {
          console.error('Error inserting guest:', err.message);
          return res.status(500).json({ error: 'Failed to create guest' });
        }
        
        res.json({
          success: true,
          data: {
            id: this.lastID,
            uniqueId,
            name,
            qrCode: qrCodeImage,
            invitationUrl
          }
        });
      }
    );
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// 2. Get guest by unique ID (for invitation page)
app.get('/api/guests/:uniqueId', (req, res) => {
  const { uniqueId } = req.params;
  
  db.get(
    'SELECT * FROM guests WHERE unique_id = ?',
    [uniqueId],
    (err, row) => {
      if (err) {
        console.error('Error fetching guest:', err.message);
        return res.status(500).json({ error: 'Failed to fetch guest' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      
      res.json({
        success: true,
        data: {
          name: row.name,
          qrCode: row.qr_code,
          uniqueId: row.unique_id
        }
      });
    }
  );
});

// 3. Get all guests (for admin web)
app.get('/api/guests', (req, res) => {
  db.all('SELECT * FROM guests ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Error fetching guests:', err.message);
      return res.status(500).json({ error: 'Failed to fetch guests' });
    }
    
    res.json({
      success: true,
      data: rows
    });
  });
});

// 4. Delete guest (for admin web)
app.delete('/api/guests/:uniqueId', (req, res) => {
  const { uniqueId } = req.params;
  
  db.run(
    'DELETE FROM guests WHERE unique_id = ?',
    [uniqueId],
    function(err) {
      if (err) {
        console.error('Error deleting guest:', err.message);
        return res.status(500).json({ error: 'Failed to delete guest' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      
      res.json({
        success: true,
        message: 'Guest deleted successfully'
      });
    }
  );
});

// 5. Update guest (for admin web)
app.put('/api/guests/:uniqueId', (req, res) => {
  const { uniqueId } = req.params;
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  db.run(
    'UPDATE guests SET name = ? WHERE unique_id = ?',
    [name, uniqueId],
    function(err) {
      if (err) {
        console.error('Error updating guest:', err.message);
        return res.status(500).json({ error: 'Failed to update guest' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      
      res.json({
        success: true,
        message: 'Guest updated successfully'
      });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 API ready to accept requests`);
});