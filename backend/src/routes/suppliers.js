const express = require('express');
const router = express.Router();

// Placeholder para rutas de proveedores
router.get('/', (req, res) => {
  res.json({ message: 'Suppliers endpoint - En desarrollo' });
});

module.exports = router;