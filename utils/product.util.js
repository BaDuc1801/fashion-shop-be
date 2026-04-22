export const calcStock = (variants = []) => {
  return variants.reduce((total, variant) => {
    return (
      total +
      (variant.skus?.reduce((sum, sku) => sum + (sku.quantity || 0), 0) || 0)
    );
  }, 0);
};
