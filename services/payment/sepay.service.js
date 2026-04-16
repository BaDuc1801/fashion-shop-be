export const createSePayPayload = (order) => {
  const bankInfo = {
    bankName: process.env.SEPAY_BANK_NAME,
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,
    accountName: process.env.SEPAY_ACCOUNT_NAME,
  };

  return {
    ...bankInfo,
    amount: order.total,
    content: order.orderCode,
    qr: `https://img.vietqr.io/image/${bankInfo.bankName}-${bankInfo.accountNumber}-compact.png?amount=${order.total}&addInfo=${order.orderCode}`,
  };
};
