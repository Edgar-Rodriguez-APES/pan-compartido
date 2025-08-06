const express = require('express');
const router = express.Router();

// Placeholder para rutas de campañas
router.get('/', (req, res) => {
  res.json({ message: 'Campaigns endpoint - En desarrollo' });
});

module.exports = router;