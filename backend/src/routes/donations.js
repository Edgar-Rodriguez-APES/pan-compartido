const express = require('express');
const router = express.Router();

// Placeholder para rutas de donaciones
router.get('/', (req, res) => {
  res.json({ message: 'Donations endpoint - En desarrollo' });
});

module.exports = router;