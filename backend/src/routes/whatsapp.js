const express = require('express');
const router = express.Router();

// Placeholder para rutas de WhatsApp
router.get('/', (req, res) => {
  res.json({ message: 'WhatsApp endpoint - En desarrollo' });
});

module.exports = router;