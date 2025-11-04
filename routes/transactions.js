const express = require('express');
const { addTransaction,getTransactions } = require('../controllers/transactionContrller');
const authMiddleware = require('../middlewares/authMiddleware');


const router = express.Router();


router.post('/:userId/:assessmentId',authMiddleware,addTransaction)

router.get('/:userId',authMiddleware,getTransactions)
module.exports = router;
