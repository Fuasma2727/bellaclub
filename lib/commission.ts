export const BELLACLUB_COMMISSION_RATE = 0.05;

export const calculateCommission = (amount: number) => {
  const totalAmount = Math.floor(Number(amount || 0));
  const commissionAmount = Math.floor(totalAmount * BELLACLUB_COMMISSION_RATE);
  const releasedAmount = totalAmount - commissionAmount;

  return {
    totalAmount,
    commissionAmount,
    releasedAmount,
    commissionRate: BELLACLUB_COMMISSION_RATE,
  };
};
