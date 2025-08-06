const express = require('express');
const router = express.Router();

// Placeholder para rutas de usuarios
router.get('/', (req, res) => {
  res.json({ message: 'Users endpoint - En desarrollo' });
});

module.exports = router;